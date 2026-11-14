import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

import {
  bajarDatosSync,
  listarBitacoraSync,
  subirCambiosSync,
} from '@/api/sincronizacion.api';
import type {
  BajarResultadoSync,
  CambioSync,
  EntidadSync,
  SincronizacionBitacora,
} from '@/types';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * SINCRONIZACIÓN OFFLINE — CU25/CU26 (móvil).
 *
 * Cola de cambios en SQLite local + cache de descarga:
 *
 *   encolar(entidad, payload)  → registra cambio pendiente
 *                                (identificador_local único)
 *   sincronizarAhora()         → 1) SUBE hasta 100 cambios
 *                                    (borra los aceptados:
 *                                    SINCRONIZADO/OMITIDO —
 *                                    los ERROR quedan para
 *                                    reintentar)
 *                                2) BAJA navegaciones +
 *                                    historial desde la última
 *                                    fecha y guarda cache
 *   obtenerEstado()            → pendientes + cache + última fecha
 *   obtenerCache()             → datos para consultar sin conexión
 *
 * `dispositivo_id` estable: se genera UNA vez y queda en
 * SecureStore (el backend lo usa para la idempotencia).
 * ══════════════════════════════════════════════════════
 */

const NOMBRE_BD = 'visioncare.db';
const CLAVE_DISPOSITIVO = 'vc_dispositivo_id';
const CLAVE_ULTIMA_FECHA = 'vc_ultima_sync';

/** Fila de la cola (SQLite) */
interface FilaCola {
  id: number;
  identificador_local: string;
  entidad: string;
  payload: string; // JSON
}

const db = SQLite.openDatabaseSync(NOMBRE_BD);

/** Crea las tablas locales una sola vez (best-effort al importar) */
let inicializada: Promise<void> | null = null;
function inicializar(): Promise<void> {
  if (!inicializada) {
    inicializada = (async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cola_sync (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          identificador_local TEXT NOT NULL UNIQUE,
          entidad TEXT NOT NULL,
          payload TEXT NOT NULL,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS cache_sync (
          clave TEXT PRIMARY KEY,
          datos TEXT NOT NULL,
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    })().catch(() => {
      // Si falla (disco lleno, etc.), reintenta en la próxima llamada
      inicializada = null;
    });
  }
  return inicializada;
}

/** ID estable del dispositivo (SecureStore) */
let dispositivoIdCache: string | null = null;
async function obtenerDispositivoId(): Promise<string> {
  if (dispositivoIdCache) return dispositivoIdCache;

  try {
    const guardado = await SecureStore.getItemAsync(CLAVE_DISPOSITIVO);
    if (guardado) {
      dispositivoIdCache = guardado;
      return guardado;
    }
  } catch {
    // SecureStore no disponible: id volátil para esta sesión
  }

  const generado = `movil-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  dispositivoIdCache = generado;

  try {
    await SecureStore.setItemAsync(CLAVE_DISPOSITIVO, generado);
  } catch {
    // sin persistencia: la idempotencia será por sesión
  }
  return generado;
}

/** ID local único para la cola */
function generarIdLocal(entidad: string): string {
  return `${entidad.toLowerCase()}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

// ═══════════════════ COLA (CU25) ═══════════════════

/** Encola un cambio offline (best-effort: nunca rompe el flujo del caller) */
export async function encolar(
  entidad: EntidadSync,
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    await inicializar();
    const identificador = generarIdLocal(entidad);
    await db.runAsync(
      'INSERT OR IGNORE INTO cola_sync (identificador_local, entidad, payload) VALUES (?, ?, ?)',
      [identificador, entidad, JSON.stringify(payload)],
    );
    return identificador;
  } catch {
    return null;
  }
}

/** Cambios pendientes (orden de creación, hasta 100) */
export async function obtenerCola(): Promise<CambioSync[]> {
  await inicializar();
  const filas = await db.getAllAsync<FilaCola>(
    'SELECT id, identificador_local, entidad, payload FROM cola_sync ORDER BY id ASC LIMIT 100',
  );
  return filas.map((f) => ({
    entidad: f.entidad as EntidadSync,
    identificador_local: f.identificador_local,
    payload: JSON.parse(f.payload) as Record<string, unknown>,
  }));
}

async function quitarDeCola(identificadores: string[]): Promise<void> {
  for (const id of identificadores) {
    await db.runAsync('DELETE FROM cola_sync WHERE identificador_local = ?', [
      id,
    ]);
  }
}

// ═══════════════════ CACHE (CU26) ═══════════════════

async function guardarCache(clave: string, datos: unknown): Promise<void> {
  await db.runAsync(
    `INSERT INTO cache_sync (clave, datos, actualizado_en)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(clave) DO UPDATE SET datos = excluded.datos,
       actualizado_en = excluded.actualizado_en`,
    [clave, JSON.stringify(datos)],
  );
}

async function leerCache<T>(clave: string): Promise<T | null> {
  await inicializar();
  const fila = await db.getFirstAsync<{ datos: string }>(
    'SELECT datos FROM cache_sync WHERE clave = ?',
    [clave],
  );
  if (!fila) return null;
  try {
    return JSON.parse(fila.datos) as T;
  } catch {
    return null;
  }
}

// ═══════════════════ ÚLTIMA FECHA ═══════════════════

async function obtenerUltimaFecha(): Promise<string | undefined> {
  try {
    return (await SecureStore.getItemAsync(CLAVE_ULTIMA_FECHA)) ?? undefined;
  } catch {
    return undefined;
  }
}

async function guardarUltimaFecha(fecha: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(CLAVE_ULTIMA_FECHA, fecha);
  } catch {
    // sin persistencia: el próximo pull repite los 7 días (idempotente)
  }
}

// ═══════════════════ SINCRONIZAR ═══════════════════

export interface ResultadoSincronizacion {
  subidos: number;
  omitidos: number;
  erroresSubida: number;
  navegacionesBajadas: number;
  actividadesBajadas: number;
  /** true si la cola quedó vacía */
  colaVacia: boolean;
  mensajeVoz: string;
}

/**
 * CU25+CU26 — Sincroniza ahora (sube cola y baja cache).
 * Lanza si no hay conexión: el caller lo anuncia y la cola
 * permanece intacta.
 */
export async function sincronizarAhora(): Promise<ResultadoSincronizacion> {
  await inicializar();
  const dispositivoId = await obtenerDispositivoId();

  // ─── 1. SUBIR cola pendiente (CU25) ───
  let subidos = 0;
  let omitidos = 0;
  let erroresSubida = 0;

  const cola = await obtenerCola();
  if (cola.length > 0) {
    const resultado = await subirCambiosSync(dispositivoId, cola);

    const aceptados = resultado.resultados
      .filter(
        (r) => r.estado === 'SINCRONIZADO' || r.estado === 'OMITIDO_DUPLICADO',
      )
      .map((r) => r.identificador_local);

    await quitarDeCola(aceptados);

    subidos = resultado.sincronizados;
    omitidos = resultado.omitidos_duplicados;
    erroresSubida = resultado.errores;
  }

  // ─── 2. BAJAR cache (CU26) ───
  const ultimaFecha = await obtenerUltimaFecha();
  const bajada = await bajarDatosSync({
    dispositivo_id: dispositivoId,
    ...(ultimaFecha && { ultima_fecha_sincronizacion: ultimaFecha }),
  });

  await guardarCache('navegaciones', bajada.navegaciones);
  await guardarCache('historial', bajada.historial);
  await guardarUltimaFecha(bajada.fecha_servidor);

  const pendientesRestantes = (await obtenerCola()).length;

  const partes: string[] = [];
  if (subidos > 0) partes.push(`${subidos} cambios subidos`);
  if (omitidos > 0) partes.push(`${omitidos} duplicados omitidos`);
  if (erroresSubida > 0) partes.push(`${erroresSubida} con error`);
  partes.push(
    `${bajada.navegaciones.length} navegaciones y ` +
      `${bajada.historial.length} actividades descargadas`,
  );
  if (pendientesRestantes > 0) {
    partes.push(`${pendientesRestantes} quedan pendientes`);
  }

  return {
    subidos,
    omitidos,
    erroresSubida,
    navegacionesBajadas: bajada.navegaciones.length,
    actividadesBajadas: bajada.historial.length,
    colaVacia: pendientesRestantes === 0,
    mensajeVoz: `Sincronización completa: ${partes.join(', ')}.`,
  };
}

// ═══════════════════ ESTADO / CACHE PÚBLICOS ═══════════════════

export interface EstadoSincronizacion {
  pendientes: number;
  fechaUltimaSync: string | null;
  navegacionesCache: BajarResultadoSync['navegaciones'] | null;
  historialCache: BajarResultadoSync['historial'] | null;
}

/** Estado resumido para la pantalla (lecturas locales, sin red) */
export async function obtenerEstado(): Promise<EstadoSincronizacion> {
  await inicializar();
  const fila = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM cola_sync',
  );
  const navegacionesCache =
    await leerCache<BajarResultadoSync['navegaciones']>('navegaciones');
  const historialCache =
    await leerCache<BajarResultadoSync['historial']>('historial');
  const fechaUltimaSync = await obtenerUltimaFecha();

  return {
    pendientes: fila?.total ?? 0,
    fechaUltimaSync: fechaUltimaSync ?? null,
    navegacionesCache,
    historialCache,
  };
}

/** Cache descargada (para consultar navegaciones sin conexión) */
export async function obtenerCache(): Promise<{
  navegaciones: BajarResultadoSync['navegaciones'] | null;
  historial: BajarResultadoSync['historial'] | null;
}> {
  return {
    navegaciones:
      await leerCache<BajarResultadoSync['navegaciones']>('navegaciones'),
    historial:
      await leerCache<BajarResultadoSync['historial']>('historial'),
  };
}

/** Bitácora del backend (página 1) */
export async function obtenerBitacora(): Promise<
  SincronizacionBitacora[]
> {
  try {
    const respuesta = await listarBitacoraSync(1, 10);
    return respuesta.datos;
  } catch {
    return [];
  }
}

/** Mensaje de error amigable para la pantalla de sync */
export function mensajeSyncError(err: unknown): string {
  return mensajeDeError(err);
}
