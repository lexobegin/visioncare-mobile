/**
 * ══════════════════════════════════════════════════════
 * Solicitudes de ayuda (CU20) — espejo de modules/ayuda.
 * ══════════════════════════════════════════════════════
 */

import type { ConsultaPaginada } from './common';

export type TipoSolicitud = 'AYUDA' | 'EMERGENCIA' | 'ASISTENCIA';

export type EstadoSolicitud =
  | 'PENDIENTE'
  | 'ENVIADA'
  | 'ATENDIDA'
  | 'CANCELADA';

export interface CrearSolicitudPayload {
  tipo: TipoSolicitud;
  mensaje?: string;
  latitud?: number;
  longitud?: number;
  precision_metros?: number;
}

export interface DestinatarioResponse {
  id_destinatario: number;
  id_contacto: number;
  nombre_contacto: string;
  canal: string;
  estado_envio: string;
  fecha_envio?: string | null;
}

export interface SolicitudAyuda {
  id_solicitud: number;
  id_usuario: number;
  id_ubicacion?: number | null;
  tipo: TipoSolicitud;
  mensaje?: string | null;
  estado: EstadoSolicitud;
  fecha_solicitud: string;
  fecha_resolucion?: string | null;
  ubicacion?: {
    latitud: number;
    longitud: number;
    precision_metros: number | null;
  } | null;
  url_mapa?: string | null;
  destinatarios?: DestinatarioResponse[];
  /** Texto listo para TTS (en la respuesta de solicitar) */
  mensaje_voz?: string | null;
}

export interface SolicitudAyudaQuery extends ConsultaPaginada {}