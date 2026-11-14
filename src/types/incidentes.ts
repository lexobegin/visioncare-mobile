/**
 * ══════════════════════════════════════════════════════
 * Tipos del módulo incidentes — espejo de modules/incidentes
 * (CU22 móvil: reportar con GPS + evidencias).
 * ══════════════════════════════════════════════════════
 */

import type { ConsultaPaginada } from './common';

/** BD: ck_incidente_estado */
export type EstadoIncidente =
  | 'ABIERTO'
  | 'EN_REVISION'
  | 'RESUELTO'
  | 'CERRADO';

/** BD: ck_incidente_severidad */
export type SeveridadIncidente = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type TipoArchivoEvidencia =
  | 'IMAGEN'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENTO';

/** Evidencia (archivo en R2) */
export interface EvidenciaIncidente {
  id_evidencia: number;
  tipo_archivo: TipoArchivoEvidencia;
  nombre_archivo?: string | null;
  mime_type?: string | null;
  tamano_bytes?: number | null;
  fecha_registro: string;
  /** URL pública (null si R2_PUBLIC_BASE_URL no está configurado) */
  url_publica?: string | null;
}

/** Incidente (respuesta; evidencias solo en el detalle) */
export interface Incidente {
  id_incidente: number;
  id_usuario: number;
  id_ubicacion?: number | null;
  tipo_incidente: string;
  descripcion?: string | null;
  severidad: SeveridadIncidente;
  estado: EstadoIncidente;
  fecha_incidente: string;
  fecha_cierre?: string | null;
  url_mapa?: string | null;
  evidencias?: EvidenciaIncidente[];
  mensaje_voz?: string | null;
}

/** PATCH /incidentes/:id/estado (dueño: solo RESUELTO o reabrir) */
export interface ActualizarEstadoIncidentePayload {
  estado: EstadoIncidente;
  severidad?: SeveridadIncidente;
}

/** Filtros de GET /incidentes (hereda page/limit/buscar) */
export interface IncidenteQuery extends ConsultaPaginada {
  estado?: EstadoIncidente;
  severidad?: SeveridadIncidente;
}

/** Evidencia capturada en el dispositivo antes de subir */
export interface EvidenciaLocal {
  uri: string;
  mimeType: string;
  nombre: string;
}

/** Tipos frecuentes para los chips de reporte (el campo es texto libre) */
export const TIPOS_INCIDENTE = [
  'OBSTRUCCION',
  'BORDILLO_FALTANTE',
  'CALLE_DANADA',
  'SENALIZACION_CAIDA',
  'ANIMAL_EN_VIA',
  'VEHICULO_MAL_ESTACIONADO',
  'OTRO',
] as const;
