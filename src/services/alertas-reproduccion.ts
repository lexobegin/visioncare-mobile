import type { Alerta } from '@/types';
import {
  vibrarAdvertencia,
  vibrarEmergencia,
  vibrarNotificacion,
} from './haptics.service';
import { ttsService } from './tts.service';

/**
 * ══════════════════════════════════════════════════════
 * Reproducción de alertas (HU18 + HU19) — helper central.
 *
 * Traduce (canal, nivel) + preferencias CU03 → acciones:
 *
 *   HÁPTICA (si vibracion_habilitada y canal la incluye):
 *     CRITICO → 3 pulsos pesados | ALTO → advertencia | resto → suave
 *
 *   VOZ (si canal la incluye):
 *     CRITICO → SIEMPRE suena (forzar — excepción de seguridad)
 *     resto   → respeta voz_habilitada (anunciar normal)
 *
 *   SONIDO puro → S2: vibración + voz de respaldo
 *     (nota: expo-audio con tonos reales queda para Sprint 3)
 *
 * Devuelve una promesa que resuelve al terminar la voz
 * (permite encadenar narraciones secuenciales).
 * ══════════════════════════════════════════════════════
 */

interface PreferenciasHaptica {
  vibracionHabilitada: boolean;
}

export function reproducirAlerta(
  alerta: Alerta,
  prefs: PreferenciasHaptica,
): Promise<void> {
  const canal = alerta.canal ?? 'VOZ';

  const incluyeVibracion =
    canal.includes('VIBRACION') || canal === 'MULTICANAL';
  const incluyeVoz = canal.includes('VOZ') || canal === 'MULTICANAL';

  // ─── Háptica (HU19) ───
  if (prefs.vibracionHabilitada && (incluyeVibracion || canal === 'SONIDO')) {
    if (alerta.nivel === 'CRITICO') {
      void vibrarEmergencia(3);
    } else if (alerta.nivel === 'ALTO') {
      void vibrarAdvertencia();
    } else {
      void vibrarNotificacion();
    }
  }

  // ─── Voz (HU18) ───
  const forzar = alerta.nivel === 'CRITICO';

  if (!incluyeVoz && canal !== 'SONIDO') {
    // Canal sin voz y sin respaldo → solo háptica
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    ttsService.anunciar(alerta.mensaje, {
      forzar,
      alTerminar: () => resolve(),
    });
    // Respaldo por si el motor de voz no dispara callbacks
    setTimeout(resolve, 6000);
  });
}