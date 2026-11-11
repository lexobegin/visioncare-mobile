/**
 * ══════════════════════════════════════════════════════
 * API de ayuda (CU20) — SPRINT 2.
 *
 * solicitarAyuda(): el backend guarda la ubicación, notifica
 * a los contactos autorizados y devuelve mensaje_voz listo
 * para TTS. El GPS es opcional (nunca bloquea la emergencia).
 * ══════════════════════════════════════════════════════
 */

import type {
  SolicitudAyuda,
  SolicitudAyudaQuery,
  RespuestaPaginada,
  CrearSolicitudPayload,
} from '@/types';
import { api } from './client';

/** CU20 — Solicitar ayuda (tipo: AYUDA | EMERGENCIA | ASISTENCIA) */
export async function solicitarAyuda(
  payload: CrearSolicitudPayload,
): Promise<SolicitudAyuda> {
  const { data } = await api.post<SolicitudAyuda>('/ayuda/solicitar', payload);
  return data;
}

/** Mis solicitudes (paginado) */
export async function listarMisSolicitudes(
  query: SolicitudAyudaQuery,
): Promise<RespuestaPaginada<SolicitudAyuda>> {
  const { data } = await api.get<RespuestaPaginada<SolicitudAyuda>>(
    '/ayuda/solicitudes',
    { params: query },
  );
  return data;
}

/** Detalle con destinatarios + ubicación */
export async function obtenerSolicitud(
  id: number,
): Promise<SolicitudAyuda> {
  const { data } = await api.get<SolicitudAyuda>(`/ayuda/solicitudes/${id}`);
  return data;
}

/** "Me ayudaron" — cierra la solicitud */
export async function atenderSolicitud(
  id: number,
): Promise<{ mensaje: string }> {
  const { data } = await api.patch<{ mensaje: string }>(
    `/ayuda/solicitudes/${id}/atender`,
  );
  return data;
}

/** Cancelar por error (activación accidental) */
export async function cancelarSolicitud(
  id: number,
): Promise<{ mensaje: string }> {
  const { data } = await api.patch<{ mensaje: string }>(
    `/ayuda/solicitudes/${id}/cancelar`,
  );
  return data;
}