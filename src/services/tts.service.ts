import type { SpeechOptions } from 'expo-speech';
import type { AlertaRiesgo } from '@/types/alerta';

/**
 * ══════════════════════════════════════════════════════
 * TTS — Servicio de síntesis de voz (expo-speech).
 *
 * Singleton configurado con las preferencias de
 * accesibilidad del usuario (CU03, vía useTTS):
 *   - voz_habilitada  → ON/OFF global
 *   - velocidad_voz   → 0.5–3.0 (backend) → rate de la API
 *   - volumen_voz     → 0–100 (backend)  → volume 0–1
 *   - idioma          → 'es' → 'es-ES' | 'en' → 'en-US'
 *   - alertas_sonoras → ON/OFF de alertas de riesgo (CU18)
 *
 * Priorización y Concurrencia (CU18):
 *   - Prioridades: 1 (INFO / Anuncio general) a 5 (CRITICO).
 *   - Una alerta crítica (prioridad 5) puede interrumpir mensajes
 *     de menor prioridad (await Speech.stop()).
 *   - Mensajes o alertas de menor prioridad NO interrumpen una
 *     alerta crítica en curso.
 *   - La inyección de MotorSpeech permite pruebas unitarias
 *     completas y deterministas sin emulador nativo.
 * ══════════════════════════════════════════════════════
 */

export interface MotorSpeech {
  speak(text: string, options?: SpeechOptions): void;
  stop(): Promise<void>;
  isSpeakingAsync(): Promise<boolean>;
}

let motorNativoResuelto: MotorSpeech | null = null;

function resolverMotorNativo(): MotorSpeech {
  if (!motorNativoResuelto) {
    try {
      motorNativoResuelto = require('expo-speech');
    } catch {
      motorNativoResuelto = {
        speak: (_text: string, options?: SpeechOptions) => {
          options?.onDone?.();
        },
        stop: async () => {},
        isSpeakingAsync: async () => false,
      };
    }
  }
  return motorNativoResuelto!;
}

export interface ConfigTTS {
  habilitada: boolean;
  /** 0.5–3.0 (viene de preferencias_accesibilidad.velocidad_voz) */
  velocidad: number;
  /** 0–100 (viene de preferencias_accesibilidad.volumen_voz) */
  volumen: number;
  /** 'es' | 'en' (viene del perfil) */
  idioma: string;
  /** CU03: Si las alertas sonoras están activas */
  alertasSonoras: boolean;
}

const DEFAULTS: ConfigTTS = {
  habilitada: true,
  velocidad: 1.0,
  volumen: 80,
  idioma: 'es',
  alertasSonoras: true,
};

export class TTSService {
  private motor: MotorSpeech | null = null;
  private config: ConfigTTS = { ...DEFAULTS };

  /**
   * Nivel de prioridad de la locución que actualmente se está hablando.
   * 0 indica que el motor está inactivo.
   */
  private prioridadEnCurso: number = 0;

  constructor(motorPersonalizado?: MotorSpeech) {
    if (motorPersonalizado) {
      this.motor = motorPersonalizado;
    }
  }

  private obtenerMotor(): MotorSpeech {
    if (!this.motor) {
      this.motor = resolverMotorNativo();
    }
    return this.motor;
  }

  /** Permite inyectar un motor simulado para pruebas unitarias */
  establecerMotor(motor: MotorSpeech): void {
    this.motor = motor;
  }

  /** Retorna una copia de la configuración actual (para inspección / CU18) */
  obtenerConfig(): Readonly<ConfigTTS> {
    return { ...this.config };
  }

  /** Retorna la prioridad del audio reproduciéndose actualmente (0 si ninguno) */
  obtenerPrioridadEnCurso(): number {
    return this.prioridadEnCurso;
  }

  /** Sincroniza preferencias (lo llama useTTS cuando cambian) */
  configurar(parcial: Partial<ConfigTTS>): void {
    this.config = { ...this.config, ...parcial };
  }

  /** Restaura defaults (al cerrar sesión) */
  resetear(): void {
    this.config = { ...DEFAULTS };
    this.prioridadEnCurso = 0;
  }

  /**
   * Habla un texto (respeta voz_habilitada salvo `forzar`).
   *
   * @param texto        mensaje a anunciar
   * @param opciones     forzar, prioridad (1 a 5), alTerminar, onError
   * @returns true si se inició la reproducción; false si fue suprimido o rechazado
   */
  async anunciar(
    texto: string,
    opciones?: {
      forzar?: boolean;
      prioridad?: number;
      alTerminar?: () => void;
      onError?: (error?: unknown) => void;
    },
  ): Promise<boolean> {
    const limpio = texto.trim();
    if (!limpio) {
      opciones?.alTerminar?.();
      return false;
    }

    if (!this.config.habilitada && !opciones?.forzar) {
      opciones?.alTerminar?.();
      return false;
    }

    const nuevaPrioridad = opciones?.prioridad ?? 1;

    // Regla CU18: Si hay una locución en curso de mayor severidad (ej: CRITICO = 5),
    // un mensaje con menor severidad (ej: anuncio normal = 1) NO debe interrumpirla.
    if (this.prioridadEnCurso > nuevaPrioridad) {
      opciones?.alTerminar?.();
      return false;
    }

    try {
      // Si la nueva prioridad es mayor o igual, corta el anuncio previo
      await this.obtenerMotor().stop();
      this.prioridadEnCurso = nuevaPrioridad;

      this.obtenerMotor().speak(limpio, {
        language: this.config.idioma === 'en' ? 'en-US' : 'es-ES',
        // rate nativo: 1.0 = normal (Android/iOS aceptan 0.5–3)
        rate: Math.min(3, Math.max(0.5, this.config.velocidad)),
        // volume nativo: 0–1
        volume: Math.min(1, Math.max(0, this.config.volumen / 100)),
        pitch: 1,
        onDone: () => {
          this.prioridadEnCurso = 0;
          opciones?.alTerminar?.();
        },
        onStopped: () => {
          this.prioridadEnCurso = 0;
          opciones?.alTerminar?.();
        },
        onError: (err) => {
          this.prioridadEnCurso = 0;
          opciones?.onError?.(err);
          opciones?.alTerminar?.();
        },
      });
      return true;
    } catch (e) {
      this.prioridadEnCurso = 0;
      opciones?.onError?.(e);
      opciones?.alTerminar?.();
      return false;
    }
  }

  /**
   * Reproduce una alerta de riesgo priorizada (CU18).
   * Respeta voz_habilitada, alertas_sonoras y vigencia TTL.
   */
  async reproducirAlerta(
    alerta: AlertaRiesgo,
    opciones?: {
      alTerminar?: () => void;
      onError?: (error?: unknown) => void;
    },
  ): Promise<boolean> {
    // 1. Verificación de preferencias de accesibilidad de CU03
    if (!this.config.habilitada || !this.config.alertasSonoras) {
      opciones?.alTerminar?.();
      return false;
    }

    // 2. Verificación de vigencia (evitar reproducir alertas obsoletas)
    const ahora = Date.now();
    if (ahora - alerta.timestamp > alerta.ttlMs) {
      opciones?.alTerminar?.();
      return false;
    }

    // 3. Verificación de precedencia de prioridades
    if (this.prioridadEnCurso > alerta.prioridad) {
      opciones?.alTerminar?.();
      return false;
    }

    return this.anunciar(alerta.mensaje, {
      prioridad: alerta.prioridad,
      alTerminar: opciones?.alTerminar,
      onError: opciones?.onError,
    });
  }

  /** Detiene la voz en curso (logout, navegación, etc.) */
  async detener(): Promise<void> {
    try {
      this.prioridadEnCurso = 0;
      await this.obtenerMotor().stop();
    } catch {
      // silencioso
    }
  }

  /** ¿Está hablando ahora? (para indicadores en UI) */
  async estaHablando(): Promise<boolean> {
    try {
      return await this.obtenerMotor().isSpeakingAsync();
    } catch {
      return false;
    }
  }
}

/** Instancia única de la app */
export const ttsService = new TTSService();