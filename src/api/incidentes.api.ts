/**
 * ══════════════════════════════════════════════════════
 * API de incidentes — espejo de modules/incidentes.
 * CU22 (móvil): reportar con GPS + evidencias, mis incidentes,
 * detalle y ciclo de estado (RESUELTO / reabrir).
 * ══════════════════════════════════════════════════════
 */

import type {
  ActualizarEstadoIncidentePayload,
  EvidenciaLocal,
  Incidente,
  IncidenteQuery,
  RespuestaPaginada,
  SeveridadIncidente,
} from '@/types';

import { api } from './client';

/** Archivo multipart en React Native (mismo patrón de capturas) */
function archivoDesdeUri(uri: string, mimeType: string, nombre: string): Blob {
  return {
    uri,
    name: nombre,
    type: mimeType,
  } as unknown as Blob;
}

/**
 * CU22 — Reportar incidente (GPS + hasta 5 evidencias).
 * El backend clasifica la severidad si no se envía.
 */
export async function reportarIncidente(params: {
  tipo_incidente: string;
  descripcion?: string;
  severidad?: SeveridadIncidente;
  latitud?: number;
  longitud?: number;
  precision_metros?: number;
  evidencias?: EvidenciaLocal[];
}): Promise<Incidente> {
  const {
    tipo_incidente,
    descripcion,
    severidad,
    latitud,
    longitud,
    precision_metros,
    evidencias = [],
  } = params;

  const formData = new FormData();

  formData.append('tipo_incidente', tipo_incidente);
  if (descripcion) formData.append('descripcion', descripcion);
  if (severidad) formData.append('severidad', severidad);
  if (latitud !== undefined) formData.append('latitud', String(latitud));
  if (longitud !== undefined) formData.append('longitud', String(longitud));
  if (precision_metros !== undefined) {
    formData.append('precision_metros', String(precision_metros));
  }

  for (const evidencia of evidencias.slice(0, 5)) {
    formData.append(
      'evidencias',
      archivoDesdeUri(evidencia.uri, evidencia.mimeType, evidencia.nombre),
    );
  }

  const { data } = await api.post<Incidente>('/incidentes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000, // subida de evidencias puede tardar
  });
  return data;
}

/** CU22 — Mis incidentes (paginado + filtros) */
export async function listarMisIncidentes(
  query: IncidenteQuery,
): Promise<RespuestaPaginada<Incidente>> {
  const { data } = await api.get<RespuestaPaginada<Incidente>>(
    '/incidentes',
    { params: query },
  );
  return data;
}

/** CU22 — Detalle con evidencias y url_mapa */
export async function obtenerDetalleIncidente(
  idIncidente: number,
): Promise<Incidente> {
  const { data } = await api.get<Incidente>(`/incidentes/${idIncidente}`);
  return data;
}

/**
 * CU22 — Cambiar estado. Como dueño solo acepta RESUELTO
 * (o reabrir con ABIERTO); la severidad la maneja la web (CU38).
 */
export async function cambiarEstadoIncidente(
  idIncidente: number,
  payload: ActualizarEstadoIncidentePayload,
): Promise<Incidente> {
  const { data } = await api.patch<Incidente>(
    `/incidentes/${idIncidente}/estado`,
    payload,
  );
  return data;
}

/** CU22 — Agregar una evidencia más (campo 'evidencia') */
export async function agregarEvidenciaIncidente(
  idIncidente: number,
  evidencia: EvidenciaLocal,
): Promise<Incidente> {
  const formData = new FormData();
  formData.append(
    'evidencia',
    archivoDesdeUri(evidencia.uri, evidencia.mimeType, evidencia.nombre),
  );

  const { data } = await api.post<Incidente>(
    `/incidentes/${idIncidente}/evidencias`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    },
  );
  return data;
}

/** CU22 — Quitar una evidencia propia */
export async function quitarEvidenciaIncidente(
  idIncidente: number,
  idEvidencia: number,
): Promise<Incidente> {
  const { data } = await api.delete<Incidente>(
    `/incidentes/${idIncidente}/evidencias/${idEvidencia}`,
  );
  return data;
}
