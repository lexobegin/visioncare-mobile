import * as Speech from 'expo-speech';

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
 *
 * Estrategia "último gana": cada anuncio corta al anterior
 * (evita discursos superpuestos al navegar rápido).
 * ══════════════════════════════════════════════════════
 */

export interface ConfigTTS {
  habilitada: boolean;
  /** 0.5–3.0 (viene de preferencias_accesibilidad.velocidad_voz) */
  velocidad: number;
  /** 0–100 (viene de preferencias_accesibilidad.volumen_voz) */
  volumen: number;
  /** 'es' | 'en' (viene del perfil) */
  idioma: string;
}

const DEFAULTS: ConfigTTS = {
  habilitada: true,
  velocidad: 1.0,
  volumen: 80,
  idioma: 'es',
};

class TTSService {
  private config: ConfigTTS = { ...DEFAULTS };

  /** Sincroniza preferencias (lo llama useTTS cuando cambian) */
  configurar(parcial: Partial<ConfigTTS>): void {
    this.config = { ...this.config, ...parcial };
  }

  /** Restaura defaults (al cerrar sesión) */
  resetear(): void {
    this.config = { ...DEFAULTS };
  }

  /**
   * Habla un texto (respeta voz_habilitada salvo `forzar`).
   *
   * @param texto        mensaje a anunciar
   * @param opciones     forzar (anuncia aunque esté OFF) y
   *                     callback alTerminar
   */
  async anunciar(
    texto: string,
    opciones?: { forzar?: boolean; alTerminar?: () => void },
  ): Promise<void> {
    const limpio = texto.trim();
    if (!limpio) return;

    if (!this.config.habilitada && !opciones?.forzar) {
      opciones?.alTerminar?.();
      return;
    }

    try {
      // Corta cualquier anuncio previo (anti-encimado)
      await Speech.stop();

      Speech.speak(limpio, {
        language: this.config.idioma === 'en' ? 'en-US' : 'es-ES',
        // rate nativo: 1.0 = normal (Android/iOS aceptan 0.5–3)
        rate: Math.min(3, Math.max(0.5, this.config.velocidad)),
        // volume nativo: 0–1
        volume: Math.min(1, Math.max(0, this.config.volumen / 100)),
        pitch: 1,
        onDone: () => opciones?.alTerminar?.(),
        onStopped: () => opciones?.alTerminar?.(),
        onError: () => {
          // El TTS nunca debe romper la app: solo descartamos
          opciones?.alTerminar?.();
        },
      });
    } catch {
      // Fallo del motor de voz (raro): la app sigue funcionando
    }
  }

  /** Detiene la voz en curso (logout, navegación, etc.) */
  async detener(): Promise<void> {
    try {
      await Speech.stop();
    } catch {
      // silencioso
    }
  }

  /** ¿Está hablando ahora? (para indicadores en UI) */
  async estaHablando(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch {
      return false;
    }
  }
}

/** Instancia única de la app */
export const ttsService = new TTSService();