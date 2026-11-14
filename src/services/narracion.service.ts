import { AppState } from 'react-native';

import { analizarFotograma } from '@/api/capturas.api';
import { compartirUbicacion } from '@/api/ayuda.api';
import type {
  AnalisisContinuoResponse,
  NivelNovedad,
} from '@/types';
import {
  vibrarAdvertencia,
  vibrarEmergencia,
} from './haptics.service';
import { obtenerUbicacion } from './location.service';
import { ttsService } from './tts.service';

/**
 * ══════════════════════════════════════════════════════
 * NARRACIÓN — Motor del MODO CONTINUO (CU09 + HU17-19).
 *
 * Bucle de asistencia manos libres (dispositivo en el pecho):
 *
 *   activar(config)
 *     └─► ciclo():
 *          1. capturarFotograma()   ← inyectada por la pantalla
 *             (CameraView.takePictureAsync — con dimensiones)
 *          2. analizarFotograma()   ← POST /capturas/analizar
 *             (efímero: la imagen NUNCA se persiste)
 *          3. manejarRespuesta():
 *               SILENCIO → nada (escena conocida — HU17)
 *               INFO     → narrar si no hay alerta en curso
 *               ALERTA   → interrumpe: háptica (HU19) + voz (HU18)
 *          4. programar siguiente ciclo con meta.siguiente_analisis_ms
 *             (el backend regula el ritmo: 3s/6s/2s)
 *
 * PRIORIDAD DE NARRACIÓN:
 *   - ALERTA SIEMPRE interrumpe (ttsService corta al anunciar)
 *   - INFO NO interrumpe una alerta (ventana de protección 5s)
 *
 * VOZ vs CU03:
 *   - nivel CRITICO → forzar:true (excepción de seguridad: el
 *     riesgo se comunica aunque el usuario tenga la voz apagada)
 *   - resto → respeta voz_habilitada (anunciar normal)
 *
 * HÁPTICA (HU19) según canal + vibracion_habilitada (CU03):
 *   canal con VIBRACION → CRITICO: 3 pulsos pesados | ALTO: advertencia
 *
 * RESILIENCIA:
 *   - Fallo de red/IA → reintento a 8s, aviso por voz UNA vez
 *   - App a segundo plano → pausa; al volver → reanuda
 *   - desactivar() → limpia timer, detiene TTS, resetea estado
 *
 * El servicio NO anuncia activación/desactivación: lo hace la
 * pantalla (evita duplicar el respuesta_voz del comando de voz).
 * ══════════════════════════════════════════════════════
 */

/** Fotograma que la pantalla entrega al servicio */
export interface FotogramaCapturado {
  uri: string;
  ancho: number;
  alto: number;
}

/** Configuración al activar (preferencias CU03 + cámara) */
export interface ConfigNarracion {
  /** Captura un fotograma desde la cámara activa (o null si no lista) */
  capturarFotograma: () => Promise<FotogramaCapturado | null>;
  /** CU03 — modo_bajo_consumo (el backend alarga el intervalo) */
  bajoConsumo: boolean;
  /** CU03 — vibracion_habilitada (HU19) */
  vibracionHabilitada: boolean;
  /** T19 — true = lectura continua de texto (OCR efímero) */
  modoLectura?: boolean;
}

/** Estado observable para la UI (chip de estado, indicadores) */
export interface EstadoNarracion {
  activo: boolean;
  procesando: boolean;
  /** T19 — variante activa del modo continuo */
  modo: 'objetos' | 'lectura';
  /** Último mensaje narrado (o null si SILENCIO) */
  ultimoMensaje: string | null;
  ultimoNivel: NivelNovedad | null;
  error: string | null;
}

const INTERVALO_REINTENTO_MS = 8000;
const INTERVALO_SIN_CAMARA_MS = 1500;
const VENTANA_PROTECCION_ALERTA_MS = 5000;
const CACHE_UBICACION_MS = 30_000;

type OyenteEstado = (estado: EstadoNarracion) => void;

class NarracionService {
  // ─── Configuración activa ───
  private config: ConfigNarracion | null = null;

  // ─── Estado del bucle ───
  private activo = false;
  private procesando = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private pausadoPorFondo = false;

  // ─── Prioridad de narración ───
  private nivelEnCurso: 'ninguno' | 'info' | 'alerta' = 'ninguno';
  private ultimaAlertaMs = 0;

  // ─── Avisos de error (una sola vez hasta recuperarse) ───
  private avisandoErrorConexion = false;

  // ─── GPS con caché (alertas persistentes llevan ubicación) ───
  private ubicacionCache: {
    latitud: number;
    longitud: number;
    precisionGps?: number;
    ts: number;
  } | null = null;

  // ─── 🆕 CU21 — compartir ubicación mientras el modo corre ───
  // (el asistente activo ES el consentimiento: el usuario lo
  //  encendió; el personal puede ver dónde está en el mapa web)
  private ultimoCompartidoMs = 0;
  private static readonly MIN_ENTRE_PINGS_MS = 60_000;

  // ─── Estado observable ───
  private estado: EstadoNarracion = {
    activo: false,
    procesando: false,
    modo: 'objetos',
    ultimoMensaje: null,
    ultimoNivel: null,
    error: null,
  };
  private oyentes = new Set<OyenteEstado>();

  // ═══════════════ SUSCRIPCIÓN (UI) ═══════════════

  /** Suscribe un oyente; devuelve la función de cancelación */
  suscribir(oyente: OyenteEstado): () => void {
    this.oyentes.add(oyente);
    oyente(this.estado); // estado inicial inmediato
    return () => {
      this.oyentes.delete(oyente);
    };
  }

  estadoActual(): EstadoNarracion {
    return this.estado;
  }

  estaActivo(): boolean {
    return this.activo;
  }

  // ═══════════════ ACTIVAR / DESACTIVAR ═══════════════

  /** Inicia el bucle (la pantalla se encarga del anuncio de voz) */
  activar(config: ConfigNarracion): void {
    if (this.activo) this.desactivar(); // re-activación limpia

    this.config = config;
    this.activo = true;
    this.pausadoPorFondo = false;
    this.avisandoErrorConexion = false;
    this.nivelEnCurso = 'ninguno';

    // GPS inicial (no bloquea: el ciclo no espera el fix)
    void this.refrescarUbicacion();

    // Pausa/reanudación con el ciclo de vida de la app
    this.appStateSub = AppState.addEventListener('change', (estado) => {
      if (estado === 'background' || estado === 'inactive') {
        this.pausar();
      } else if (estado === 'active' && this.activo) {
        this.reanudar();
      }
    });

    // 🆕 FIX T11 (bug real reportado en pruebas): el estado observable
    // nunca reflejaba la activación — faltaba `activo: true`. El bucle
    // SÍ corría (flag interno) pero el Switch de la cámara, el chip y
    // el <EscudoTactilGlobal/> (que leen estado.activo) quedaban en
    // false → "parece que no se habilitó" y escudo invisible.
    this.estado = {
      ...this.estado,
      activo: true,
      modo: config.modoLectura ? 'lectura' : 'objetos',
      error: null,
    };

    this.emitir();
    this.programarCiclo(600); // primer análisis casi inmediato
  }

  /** Detiene todo (la pantalla se encarga del anuncio de voz) */
  desactivar(): void {
    this.activo = false;
    this.procesando = false;
    this.pausadoPorFondo = false;
    this.limpiarTimer();
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.nivelEnCurso = 'ninguno';
    this.config = null;

    void ttsService.detener(); // corta cualquier narración en curso

    this.estado = {
      activo: false,
      procesando: false,
      modo: 'objetos',
      ultimoMensaje: this.estado.ultimoMensaje,
      ultimoNivel: this.estado.ultimoNivel,
      error: null,
    };
    this.emitir();
  }

  // ═══════════════ PAUSA (segundo plano) ═══════════════

  private pausar(): void {
    if (!this.activo) return;
    this.pausadoPorFondo = true;
    this.limpiarTimer();
  }

  private reanudar(): void {
    if (!this.activo || !this.pausadoPorFondo) return;
    this.pausadoPorFondo = false;
    this.programarCiclo(1000); // retomar pronto al volver al frente
  }

  // ═══════════════ BUCLE ═══════════════

  private programarCiclo(ms: number): void {
    if (!this.activo) return;
    this.limpiarTimer();
    this.timer = setTimeout(() => {
      void this.ciclo();
    }, ms);
  }

  private limpiarTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async ciclo(): Promise<void> {
    if (!this.activo || !this.config || this.procesando) return;

    // App en segundo plano entre programación y ejecución
    if (this.pausadoPorFondo) return;

    this.procesando = true;
    this.emitir();

    let msSiguiente = INTERVALO_REINTENTO_MS;

    try {
      // ─── 1. Capturar fotograma (cámara de la pantalla) ───
      const fotograma = await this.config.capturarFotograma();

      if (!fotograma) {
        // Cámara no lista (permiso, montaje) → reintentar pronto
        msSiguiente = INTERVALO_SIN_CAMARA_MS;
      } else {
        // ─── 2. Analizar (efímero — backend prioriza HU17) ───
        const ubicacion = this.ubicacionCache ?? undefined;

        const respuesta = await analizarFotograma({
          uri: fotograma.uri,
          ancho: fotograma.ancho,
          alto: fotograma.alto,
          bajoConsumo: this.config.bajoConsumo,
          // T19 — lectura continua: OCR efímero en el backend
          ...(this.config.modoLectura && { tipoAnalisis: 'OCR' as const }),
          ...(ubicacion && {
            latitud: ubicacion.latitud,
            longitud: ubicacion.longitud,
            precisionGps: ubicacion.precisionGps,
          }),
        });

        // ─── 3. Narración con prioridad ───
        this.manejarRespuesta(respuesta);

        // ─── 4. Ritmo que manda el backend ───
        msSiguiente = respuesta.meta.siguiente_analisis_ms;
      }
    } catch {
      // Red/backend caído: NO romper el bucle, avisar una sola vez
      msSiguiente = INTERVALO_REINTENTO_MS;
      this.marcarErrorConexion();
    } finally {
      this.procesando = false;
      this.emitir();
    }

    // Refrescar GPS en background cada ~30s (sin bloquear)
    void this.refrescarUbicacion();

    this.programarCiclo(msSiguiente);
  }

  // ═══════════════ NARRACIÓN PRIORITARIA ═══════════════

  private manejarRespuesta(respuesta: AnalisisContinuoResponse): void {
    // ─── SILENCIO: escena conocida → no molestar (HU17) ───
    if (respuesta.nivel_novedad === 'SILENCIO' || !respuesta.mensaje_voz) {
      this.actualizarEstadoSilencio();
      return;
    }

    if (respuesta.nivel_novedad === 'ALERTA' && respuesta.alerta) {
      this.narrarAlerta(respuesta.alerta, respuesta.mensaje_voz);
      return;
    }

    // ─── INFO: narración breve, sin interrumpir alertas ───
    const alertaReciente =
      this.nivelEnCurso === 'alerta' &&
      Date.now() - this.ultimaAlertaMs < VENTANA_PROTECCION_ALERTA_MS;

    if (alertaReciente) {
      // La alerta en curso tiene prioridad: se descarta el INFO
      return;
    }

    this.nivelEnCurso = 'info';
    ttsService.anunciar(respuesta.mensaje_voz, {
      alTerminar: () => {
        if (this.nivelEnCurso === 'info') this.nivelEnCurso = 'ninguno';
      },
    });

    this.estado = {
      ...this.estado,
      ultimoMensaje: respuesta.mensaje_voz,
      ultimoNivel: 'INFO',
      error: null,
    };
    this.emitir();
  }

  private narrarAlerta(alerta: NonNullable<AnalisisContinuoResponse['alerta']>, mensaje: string): void {
    // ALERTA interrumpe TODO (ttsService corta al anunciar)
    this.nivelEnCurso = 'alerta';
    this.ultimaAlertaMs = Date.now();
    this.avisandoErrorConexion = false; // si hay análisis, hay conexión

    const canalIncluye = (partes: string[]): boolean =>
      partes.some((p) => alerta.canal.includes(p));

    // ─── Háptica (HU19): canal + preferencia CU03 ───
    if (
      this.config?.vibracionHabilitada &&
      canalIncluye(['VIBRACION', 'MULTICANAL'])
    ) {
      if (alerta.nivel === 'CRITICO') {
        void vibrarEmergencia(3);
      } else {
        void vibrarAdvertencia();
      }
    }

    // ─── Voz (HU18): CRITICO fuerza; resto respeta CU03 ───
    const forzarVoz = alerta.nivel === 'CRITICO';

    ttsService.anunciar(mensaje, {
      forzar: forzarVoz,
      alTerminar: () => {
        if (this.nivelEnCurso === 'alerta') this.nivelEnCurso = 'ninguno';
      },
    });

    this.estado = {
      ...this.estado,
      ultimoMensaje: mensaje,
      ultimoNivel: 'ALERTA',
      error: null,
    };
    this.emitir();
  }

  private actualizarEstadoSilencio(): void {
    // SILENCIO no borra el último mensaje (la UI puede seguir
    // mostrándolo) — solo indica el nivel del ciclo actual
    if (this.estado.ultimoNivel !== 'SILENCIO') {
      this.estado = { ...this.estado, ultimoNivel: 'SILENCIO' };
      this.emitir();
    }
  }

  private marcarErrorConexion(): void {
    if (this.avisandoErrorConexion) return; // sin spam
    this.avisandoErrorConexion = true;

    const mensaje =
      'El asistente perdió conexión con el servidor. ' +
      'Seguirá intentando automáticamente.';

    // Aviso una sola vez (respetando voz_habilitada — no es CRITICO)
    ttsService.anunciar(mensaje, {
      alTerminar: () => {
        if (this.nivelEnCurso === 'info') this.nivelEnCurso = 'ninguno';
      },
    });

    this.estado = {
      ...this.estado,
      ultimoMensaje: mensaje,
      ultimoNivel: 'INFO',
      error: 'Sin conexión con el servidor — reintentando…',
    };
    this.emitir();
  }

  // ═══════════════ GPS CON CACHÉ ═══════════════

  private async refrescarUbicacion(): Promise<void> {
    const ahora = Date.now();
    if (
      this.ubicacionCache &&
      ahora - this.ubicacionCache.ts < CACHE_UBICACION_MS
    ) {
      return; // caché vigente
    }

    try {
      const u = await obtenerUbicacion({ timeoutMs: 4000 });
      if (u) {
        this.ubicacionCache = {
          latitud: u.latitud,
          longitud: u.longitud,
          precisionGps: u.precision ?? undefined,
          ts: ahora,
        };

        // 🆕 CU21 — compartir con el servidor máx. 1 ping/min
        // (best-effort: si falla, el siguiente ciclo reintenta;
        //  NO interrumpe el bucle de narración)
        const hanPasado =
          ahora - this.ultimoCompartidoMs >=
          NarracionService.MIN_ENTRE_PINGS_MS;
        if (hanPasado) {
          this.ultimoCompartidoMs = ahora;
          void compartirUbicacion({
            latitud: u.latitud,
            longitud: u.longitud,
            ...(u.precision != null && { precision_metros: u.precision }),
          }).catch(() => {
            // sin conexión: el próximo ping lo reintenta
          });
        }
      }
    } catch {
      // GPS no disponible: las alertas se persisten sin ubicación
    }
  }

  // ═══════════════ EMISIÓN DE ESTADO ═══════════════

  private emitir(): void {
    this.oyentes.forEach((o) => o(this.estado));
  }
}

/** Instancia única de la app */
export const narracionService = new NarracionService();