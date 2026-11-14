/**
 * ══════════════════════════════════════════════════════
 * API de navegación asistida — espejo de modules/navegacion.
 * CU24 (móvil): iniciar, registrar traza, finalizar, listar.
 * ══════════════════════════════════════════════════════
 */

import type {
  AgregarPuntoPayload,
  CrearNavegacionPayload,
  FinalizarNavegacionPayload,
  Navegacion,
  RespuestaPaginada,
} from '@/types';

import { api } from './client';

/** CU24 — Iniciar navegación (origen GPS + destino conocido) */
export async function iniciarNavegacion(
  payload: CrearNavegacionPayload,
): Promise<Navegacion> {
  const { data } = await api.post<Navegacion>('/navegaciones', payload);
  return data;
}

/** CU24 — Registrar un punto GPS en la traza (orden automático) */
export async function agregarPuntoNavegacion(
  idNavegacion: number,
  payload: AgregarPuntoPayload,
): Promise<Navegacion> {
  const { data } = await api.post<Navegacion>(
    `/navegaciones/${idNavegacion}/puntos`,
    payload,
  );
  return data;
}

/** CU24 — Finalizar (COMPLETADA / CANCELADA / ERROR) */
export async function finalizarNavegacion(
  idNavegacion: number,
  payload: FinalizarNavegacionPayload,
): Promise<Navegacion> {
  const { data } = await api.patch<Navegacion>(
    `/navegaciones/${idNavegacion}/finalizar`,
    payload,
  );
  return data;
}

/** CU24/CU23 — Mis navegaciones (paginado) */
export async function listarMisNavegaciones(
  page = 1,
  limit = 10,
): Promise<RespuestaPaginada<Navegacion>> {
  const { data } = await api.get<RespuestaPaginada<Navegacion>>(
    '/navegaciones',
    { params: { page, limit } },
  );
  return data;
}

/** CU24 — Detalle con traza + distancia + duración */
export async function obtenerNavegacion(
  idNavegacion: number,
): Promise<Navegacion> {
  const { data } = await api.get<Navegacion>(`/navegaciones/${idNavegacion}`);
  return data;
}
