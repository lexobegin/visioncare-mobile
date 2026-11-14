/**
 * ══════════════════════════════════════════════════════
 * API de historial — espejo de modules/historial.
 * CU23 (móvil): feed consolidado de actividades + resumen.
 * ══════════════════════════════════════════════════════
 */

import type {
  HistorialQuery,
  RespuestaPaginada,
  ResumenActividad,
  Actividad,
} from '@/types';

import { api } from './client';

/** CU23 — Feed consolidado (eventos + voz + capturas) */
export async function listarActividades(
  query: HistorialQuery,
): Promise<RespuestaPaginada<Actividad>> {
  const { data } = await api.get<RespuestaPaginada<Actividad>>('/historial', {
    params: query,
  });
  return data;
}

/** Conteos por tipo (para los filtros rápidos) */
export async function obtenerResumenActividad(): Promise<ResumenActividad[]> {
  const { data } = await api.get<ResumenActividad[]>('/historial/resumen');
  return data;
}
