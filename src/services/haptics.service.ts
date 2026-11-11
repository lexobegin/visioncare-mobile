import * as Haptics from 'expo-haptics';

/**
 * ══════════════════════════════════════════════════════
 * Háptica (HU19) — patrones por severidad.
 *
 * La app decide CUÁNDO (priorización backend) y aquí CÓMO:
 *   - notificacion()      → toques suaves (info)
 *   - advertencia()       → doble toque (riesgo medio)
 *   - emergencia(x3)      → triple pulso pesado (CRITICO)
 * El caller respeta preferencias.vibracion_habilitada (CU03)
 * vía useTTS/hook (se conecta en T17).
 * ══════════════════════════════════════════════════════
 */

export async function vibrarNotificacion(): Promise<void> {
  try {
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );
  } catch {
    // sin motor háptico: silencioso
  }
}

export async function vibrarAdvertencia(): Promise<void> {
  try {
    await Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    );
  } catch {
    // silencioso
  }
}

/** Riesgo CRITICO: 3 pulsos pesados espaciados (inconfundible) */
export async function vibrarEmergencia(
  repeticiones = 3,
): Promise<void> {
  try {
    for (let i = 0; i < repeticiones; i++) {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      if (i < repeticiones - 1) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
  } catch {
    // silencioso
  }
}