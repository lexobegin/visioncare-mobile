/**
 * ══════════════════════════════════════════════════════
 * Cascada IA — orquesta el orden de motores (defensa P4):
 *
 *   N1  SERVIDOR (principal, si hay internet): el callback
 *       `analizarEnServidor` debe llamar al backend NestJS
 *       → FastAPI (modelos YOLOv8/EasyOCR locales en la MV).
 *       En producción se cablea con la capturas.api existente.
 *   N3  LOCAL (respaldo): modelo TF.js embebido — corre sin
 *       internet. (N2 = colas de datos CU25/26, ya existente.)
 *
 * Reglas:
 *   - Sin internet → LOCAL directo (ni intentamos servidor).
 *   - Servidor configurado pero caído/lento → LOCAL, y el
 *     motivo queda registrado para la bitácora/monitor.
 *   - El servidor siempre devuelve el resultado si responde:
 *     los modelos de la MV son más capaces que el embebido.
 * ══════════════════════════════════════════════════════
 */

import { hayInternet } from './conectividad';
import { predecirImagenLocal } from './modelo-local.servicio';
import type {
  MotivoCascada,
  ResultadoCascada,
  ResultadoInferencia,
} from './tipos';

/** Contrato del análisis en el servidor (N1) */
export interface AnalizadorServidor {
  (uri: string): Promise<{ etiqueta: string; confianza: number }>;
}

/** Corre `promesa` con tope de tiempo (ms) */
function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, rechazar) =>
      setTimeout(() => rechazar(new Error(`timeout ${ms} ms`)), ms),
    ),
  ]);
}

/**
 * Analiza una imagen usando la cascada N1 → N3.
 *
 * @param uri                     foto local (cámara) a analizar
 * @param analizarEnServidor      callback N1 (backend → FastAPI);
 *                                omitir si aún no se integra
 * @param timeoutServidorMs       tope de espera del servidor
 */
export async function analizarConCascada(
  uri: string,
  analizarEnServidor?: AnalizadorServidor,
  timeoutServidorMs = 10_000,
): Promise<ResultadoCascada> {
  let local: ResultadoInferencia | null = null;

  const usarLocal = async (motivo: MotivoCascada, detalle: string | null) => {
    if (!local) {
      local = await predecirImagenLocal(uri);
    }
    return { motor: 'LOCAL' as const, motivo, detalle, local, servidor: null };
  };

  // Sin internet → N3 directo (no perdemos tiempo con la red)
  if (!(await hayInternet())) {
    return usarLocal('SIN_INTERNET', null);
  }

  // ¿Hay camino N1 configurado?
  if (!analizarEnServidor) {
    return usarLocal('SERVIDOR_NO_CONFIGURADO', null);
  }

  // N1: servidor propio (FastAPI con modelos locales en la MV)
  try {
    const servidor = await conTimeout(
      analizarEnServidor(uri),
      timeoutServidorMs,
    );
    return {
      motor: 'SERVIDOR',
      motivo: 'HAY_INTERNET_SERVIDOR_OK',
      detalle: null,
      local: null,
      servidor,
    };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    return usarLocal('SERVIDOR_FALLO', detalle);
  }
}
