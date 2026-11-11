/**
 * ══════════════════════════════════════════════════════
 * API de alertas (HU17–19) — SPRINT 2.
 *
 * Ciclo del móvil:
 *   1. listarPendientes() → reproducir (voz forzada + vibración
 *      según canal y preferencias CU03)
 *   2. atenderLote(ids) → marcar reproducidas (no se repiten)
 * ══════════════════════════════════════════════════════
 */

import type {
  Alerta,
  AlertaQuery,
  RespuestaPaginada,
  ResumenAlertas,
} from '@/types';
import { api } from './client';

/** HU18 — Alertas sin atender (prioridad DESC: CRITICO primero) */
export async function listarAlertasPendientes(
  page = 1,
  limit = 20,
): Promise<RespuestaPaginada<Alerta>> {
  const { data } = await api.get<RespuestaPaginada<Alerta>>(
    '/alertas/pendientes',
    { params: { page, limit } },
  );
  return data;
}

/** HU18 — Marcar N alertas como reproducidas (bulk) */
export async function atenderAlertasLote(
  ids: number[],
): Promise<{ atendidas: number }> {
  const { data } = await api.patch<{ atendidas: number }>(
    '/alertas/atender-lote',
    { ids },
  );
  return data;
}

/** Marcar una alerta individual */
export async function atenderAlerta(
  id: number,
): Promise<{ mensaje: string }> {
  const { data } = await api.patch<{ mensaje: string }>(
    `/alertas/${id}/atender`,
  );
  return data;
}

/** Historial con filtros (nivel, tipo, atendida) */
export async function listarAlertas(
  query: AlertaQuery,
): Promise<RespuestaPaginada<Alerta>> {
  const { data } = await api.get<RespuestaPaginada<Alerta>>('/alertas', {
    params: query,
  });
  return data;
}

/** Conteos para indicadores en la UI */
export async function obtenerResumenAlertas(): Promise<ResumenAlertas> {
  const { data } = await api.get<ResumenAlertas>('/alertas/resumen');
  return data;
}