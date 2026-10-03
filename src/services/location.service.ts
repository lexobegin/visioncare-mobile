import * as Location from 'expo-location';

/**
 * ══════════════════════════════════════════════════════
 * GPS — Servicio de ubicación (expo-location).
 *
 * REGLA: obtenerUbicacion() NUNCA lanza ni bloquea —
 * devuelve null si no hay permiso o timeout. Los flujos
 * que la usan (capturas CU07, ayuda Sprint 3) continúan
 * sin ubicación en lugar de romperse (el backend acepta
 * lat/long opcionales).
 * ══════════════════════════════════════════════════════
 */

export interface UbicacionGPS {
  latitud: number;
  longitud: number;
  /** Precisión en metros (menor = mejor) o null */
  precision: number | null;
}

/** Pide permiso en primer plano. true = concedido */
export async function pedirPermisoUbicacion(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** ¿Permiso ya concedido? (sin mostrar diálogo) */
export async function tienePermisoUbicacion(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Posición actual con permiso implícito y timeout.
 *
 * @param opciones.timeoutMs  límite de espera del fix GPS
 *                            (default 8000 ms)
 * @returns coordenadas o null (sin permiso / sin fix / error)
 */
export async function obtenerUbicacion(opciones?: {
  timeoutMs?: number;
}): Promise<UbicacionGPS | null> {
  const timeoutMs = opciones?.timeoutMs ?? 8_000;

  try {
    // ─── Permiso (pedido rápido si no estaba concedido) ───
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const pedido = await Location.requestForegroundPermissionsAsync();
      if (pedido.status !== 'granted') return null;
    }

    // ─── Fix GPS con carrera contra el timeout ───
    const posicion = await Promise.race([
      Location.getCurrentPositionAsync({
        // Balanced: buen equilibrio precisión/batería para capturas
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs),
      ),
    ]);

    if (!posicion) return null; // timeout sin fix

    return {
      latitud: posicion.coords.latitude,
      longitud: posicion.coords.longitude,
      precision: posicion.coords.accuracy ?? null,
    };
  } catch {
    // GPS apagado, error del proveedor, etc. → flujo continúa
    return null;
  }
}