// ══════════ visioncare-mobile/src/api/contactos.api.ts ══════════

import type {
  ActualizarContactoPayload,
  Contacto,
  ContactoQuery,
  CrearContactoPayload,
  RespuestaPaginada,
} from '@/types';
import { api } from './client';

/** CU05 — Mis contactos (ordenados por prioridad) */
export async function listarMisContactos(
  query: ContactoQuery,
): Promise<RespuestaPaginada<Contacto>> {
  const { data } = await api.get<RespuestaPaginada<Contacto>>('/contactos', {
    params: query,
  });
  return data;
}

/** CU05 — Crear contacto */
export async function crearContacto(
  payload: CrearContactoPayload,
): Promise<Contacto> {
  const { data } = await api.post<Contacto>('/contactos', payload);
  return data;
}

/** CU05 — Actualizar contacto propio */
export async function actualizarContacto(
  id: number,
  payload: ActualizarContactoPayload,
): Promise<Contacto> {
  const { data } = await api.patch<Contacto>(`/contactos/${id}`, payload);
  return data;
}

/** CU05 — Desactivar contacto propio */
export async function desactivarContacto(
  id: number,
): Promise<{ mensaje: string }> {
  const { data } = await api.delete<{ mensaje: string }>(`/contactos/${id}`);
  return data;
}

/** CU05 — Reactivar contacto propio */
export async function activarContacto(id: number): Promise<{ mensaje: string }> {
  const { data } = await api.patch<{ mensaje: string }>(
    `/contactos/${id}/activar`,
  );
  return data;
}