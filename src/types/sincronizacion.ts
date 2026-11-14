/**
 * ══════════════════════════════════════════════════════
 * Tipos del módulo sincronización — espejo de
 * modules/sincronizacion (CU25–CU26: cola offline móvil).
 * ══════════════════════════════════════════════════════
 */

/** Entidades que acepta POST /sincronizacion/subir */
export type EntidadSync =
  | 'NAVEGACION'
  | 'PUNTO_NAVEGACION'
  | 'HISTORIAL_ACTIVIDAD';

/** Un cambio offline dentro del lote */
export interface CambioSync {
  entidad: EntidadSync;
  /** ID local (UUID de la app) — idempotencia */
  identificador_local: string;
  version_local?: number;
  payload: Record<string, unknown>;
}

/** Resultado por cambio */
export interface CambioResultadoSync {
  identificador_local: string;
  entidad: string;
  estado: 'SINCRONIZADO' | 'ERROR' | 'OMITIDO_DUPLICADO';
  identificador_servidor?: number | null;
  mensaje?: string | null;
}

/** POST /sincronizacion/subir — respuesta */
export interface SubirResultadoSync {
  dispositivo_id: string;
  total: number;
  sincronizados: number;
  omitidos_duplicados: number;
  errores: number;
  resultados: CambioResultadoSync[];
}

/** POST /sincronizacion/bajar — cuerpo */
export interface BajarPayloadSync {
  dispositivo_id: string;
  /** Si falta: últimos 7 días */
  ultima_fecha_sincronizacion?: string;
}

/** Punto descargado */
export interface PuntoOfflineSync {
  id_punto: number;
  orden: number;
  latitud: number;
  longitud: number;
  instruccion?: string | null;
  referencia_entorno?: string | null;
}

/** Navegación descargada (cache offline) */
export interface NavegacionOfflineSync {
  id_navegacion: number;
  origen_latitud?: number | null;
  origen_longitud?: number | null;
  destino_latitud?: number | null;
  destino_longitud?: number | null;
  destino_descripcion?: string | null;
  modo: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  puntos: PuntoOfflineSync[];
}

/** Actividad descargada (cache offline) */
export interface HistorialOfflineSync {
  id_historial: number;
  tipo_actividad: string;
  referencia_id?: number | null;
  descripcion?: string | null;
  fecha_actividad: string;
}

/** POST /sincronizacion/bajar — respuesta */
export interface BajarResultadoSync {
  /** Guardar y enviar como ultima_fecha_sincronizacion en el próximo pull */
  fecha_servidor: string;
  desde: string;
  navegaciones: NavegacionOfflineSync[];
  historial: HistorialOfflineSync[];
}

/** Fila de la bitácora GET /sincronizacion */
export interface SincronizacionBitacora {
  id_sincronizacion: number;
  id_usuario: number;
  dispositivo_id: string;
  direccion: 'SUBIDA' | 'BAJADA' | 'BIDIRECCIONAL';
  entidad?: string | null;
  identificador_local?: string | null;
  identificador_servidor?: number | null;
  conflicto_detectado: boolean;
  resolucion_conflicto?: string | null;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'SINCRONIZADO' | 'ERROR' | 'CONFLICTO';
  fecha_sincronizacion: string;
}
