/**
 * ══════════════════════════════════════════════════════
 * API de ayuda (CU20 + CU21) — REEMPLAZA el original.
 *
 * CU20 (Sprint 2): solicitarAyuda() — el backend guarda la
 * ubicación, notifica a los contactos autorizados y devuelve
 * mensaje_voz listo para TTS.
 *
 * 🆕 CU21 (Sprint 3): compartirUbicacion() — pings GPS del
 * usuario mientras el asistente continuo está activo o el
 * toggle "Compartir mi ubicación" está ON. El personal
 * (ADMIN/INSTITUCION) los ve en el mapa web.
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

/* ═══════════════ 🆕 CU21 — UBICACIÓN COMPARTIDA ═══════════════ */

export interface PingUbicacionPayload {
  latitud: number;
  longitud: number;
  precision_metros?: number;
  altitud_metros?: number;
}

export interface PingUbicacionRespuesta {
  id_ubicacion: number;
  latitud: number;
  longitud: number;
  precision_metros: number | null;
  fecha_registro: string;
}

/**
 * CU21 — Enviar un ping GPS al servidor.
 * Se llama desde `ubicacion-compartida.service` (toggle manual,
 * cada 60 s) y desde `narracion.service` (mientras el asistente
 * continuo está activo). Best-effort: si falla la red NO lanza —
 * el siguiente ping reintenta.
 */
export async function compartirUbicacion(
  payload: PingUbicacionPayload,
): Promise<PingUbicacionRespuesta> {
  const { data } = await api.post<PingUbicacionRespuesta>(
    '/ayuda/ubicacion',
    payload,
  );
  return data;
}
