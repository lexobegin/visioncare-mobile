/**
 * ══════════════════════════════════════════════════════
 * STT — Servicio de reconocimiento de voz (voz → texto).
 *
 * Base: expo-speech-recognition (módulo NATIVO).
 * ⚠️ NO disponible en Expo Go → detección con probe real
 * + razones tipadas para que la UI active el FALLBACK POR
 * TECLADO (Tanda 9). Funciona completo en development builds.
 *
 * API principal: escucharUnaVez() — envuelve el flujo de
 * eventos nativo en una Promesa con timeout:
 *
 *   const r = await escucharUnaVez();
 *   if (r.ok) interpretarComando({ comando: r.texto, ... });
 *   else if (r.razon === 'no-disponible') → mostrar input
 * ══════════════════════════════════════════════════════
 */

// ─── Carga tolerante del módulo nativo (Expo Go → null) ───
let ExpoSpeechRecognitionModule: any = null;
try {
  const paquete = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = paquete.ExpoSpeechRecognitionModule ?? null;
} catch {
  ExpoSpeechRecognitionModule = null;
}

export type RazonFalloEscucha =
  | 'no-disponible'   // Expo Go / módulo nativo ausente
  | 'permiso-denegado'
  | 'sin-voz'         // end sin resultado (silencio)
  | 'cancelado'
  | 'timeout'
  | 'error';

export type ResultadoEscucha =
  | { ok: true; texto: string; confianza: number | null }
  | { ok: false; razon: RazonFalloEscucha; detalle?: string };

/** Cache del probe de disponibilidad */
let disponibilidadCache: boolean | null = null;

/**
 * ¿El dispositivo puede reconocer voz? (probe real:
 * en Expo Go el módulo nativo no existe → lanza → false)
 */
export async function sttDisponible(): Promise<boolean> {
  if (disponibilidadCache !== null) return disponibilidadCache;

  if (!ExpoSpeechRecognitionModule) {
    disponibilidadCache = false;
    return false;
  }

  try {
    // Llamada benigna que toca el módulo NATIVO
    const servicios: string[] | undefined =
      ExpoSpeechRecognitionModule.getSpeechRecognitionServices?.();
    disponibilidadCache = Array.isArray(servicios) && servicios.length > 0;
  } catch {
    disponibilidadCache = false;
  }

  return disponibilidadCache;
}

interface OpcionesEscucha {
  /** ms máximos de espera del resultado (default 12000) */
  tiempoMaximoMs?: number;
  /** idioma BCP-47 (default: es-BO con fallback es-ES) */
  idioma?: string;
}

/**
 * Escucha UNA frase y devuelve el texto reconocido.
 * Lleva el micrófono abierto, gestiona permisos, timeout
 * y limpieza de listeners — a prueba de escapes.
 */
export async function escucharUnaVez(
  opciones?: OpcionesEscucha,
): Promise<ResultadoEscucha> {
  const tiempoMaximoMs = opciones?.tiempoMaximoMs ?? 12_000;
  const idioma = opciones?.idioma ?? 'es-BO';

  // ─── 1. Disponibilidad del módulo nativo ───
  if (!(await sttDisponible())) {
    return { ok: false, razon: 'no-disponible' };
  }

  // ─── 2. Permisos de micrófono (+ reconocimiento iOS) ───
  try {
    const permisos =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permisos?.granted) {
      return { ok: false, razon: 'permiso-denegado' };
    }
  } catch (e) {
    return {
      ok: false,
      razon: 'no-disponible',
      detalle: (e as Error)?.message,
    };
  }

  // ─── 3. Flujo de escucha envuelto en promesa ───
  return new Promise<ResultadoEscucha>((resolver) => {
    let resuelto = false;
    const suscripciones: Array<{ remove: () => void }> = [];
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const terminar = (resultado: ResultadoEscucha) => {
      if (resuelto) return;
      resuelto = true;
      if (temporizador) clearTimeout(temporizador);
      suscripciones.forEach((s) => s.remove());
      // Corta el reconocimiento (best-effort)
      try {
        ExpoSpeechRecognitionModule?.stop?.();
      } catch {
        // silencioso
      }
      resolver(resultado);
    };

    // Timeout global
    temporizador = setTimeout(
      () => terminar({ ok: false, razon: 'timeout' }),
      tiempoMaximoMs,
    );

    // ─── Resultado final ───
    suscripciones.push(
      ExpoSpeechRecognitionModule.addListener(
        'result',
        (evento: {
          isFinal?: boolean;
          transcript?: string;
          confidence?: number;
        }) => {
          const texto = evento?.transcript?.trim() ?? '';
          if (evento?.isFinal !== false && texto.length > 0) {
            // confidence = -1 si el motor no lo reporta
            const confianza =
              typeof evento.confidence === 'number' && evento.confidence >= 0
                ? evento.confidence
                : null;
            terminar({ ok: true, texto, confianza });
          }
          // result sin isFinal (intermedios) → seguimos esperando
        },
      ),
    );

    // ─── End sin resultado → silencio ───
    suscripciones.push(
      ExpoSpeechRecognitionModule.addListener('end', () => {
        terminar({ ok: false, razon: 'sin-voz' });
      }),
    );

    // ─── Errores del motor ───
    suscripciones.push(
      ExpoSpeechRecognitionModule.addListener(
        'error',
        (evento: { error?: string; message?: string }) => {
          const codigo = evento?.error ?? '';

          // 'no-speech' también llega como error en algunos motores
          if (codigo === 'no-speech') {
            terminar({ ok: false, razon: 'sin-voz' });
            return;
          }
          if (
            codigo === 'not-authorized' ||
            codigo === 'service-not-allowed' ||
            codigo === 'audio-capture'
          ) {
            terminar({ ok: false, razon: 'permiso-denegado', detalle: codigo });
            return;
          }

          terminar({
            ok: false,
            razon: 'error',
            detalle: evento?.message ?? codigo,
          });
        },
      ),
    );

    // ─── Iniciar reconocimiento ───
    try {
      ExpoSpeechRecognitionModule.start({
        lang: idioma,
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (e) {
      terminar({
        ok: false,
        razon: 'no-disponible',
        detalle: (e as Error)?.message,
      });
    }
  });
}

/** Cancela una escucha en curso (botón ✕ de la UI) */
export function cancelarEscucha(): void {
  try {
    ExpoSpeechRecognitionModule?.abort?.();
  } catch {
    // silencioso
  }
}