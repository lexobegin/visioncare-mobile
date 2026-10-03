// ══════════ visioncare-mobile/src/api/accesibilidad.api.ts ══════════

import type {
  ActualizarPreferenciasPayload,
  PreferenciasAccesibilidad,
} from '@/types';
import { api } from './client';

/** CU03 — Mis preferencias (las crea con defaults si no existen) */
export async function obtenerMisPreferencias(): Promise<PreferenciasAccesibilidad> {
  const { data } = await api.get<PreferenciasAccesibilidad>(
    '/accesibilidad/me',
  );
  return data;
}

/** CU03 — Actualizar mis preferencias (parcial) */
export async function actualizarMisPreferencias(
  payload: ActualizarPreferenciasPayload,
): Promise<PreferenciasAccesibilidad> {
  const { data } = await api.patch<PreferenciasAccesibilidad>(
    '/accesibilidad/me',
    payload,
  );
  return data;
}