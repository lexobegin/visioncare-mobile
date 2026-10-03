// ══════════ visioncare-mobile/src/api/usuarios.api.ts ══════════

import type { ActualizarPerfilPayload, Usuario } from '@/types';
import { api } from './client';

/** CU04 — Actualizar mi perfil (parcial) */
export async function actualizarMiPerfil(
  payload: ActualizarPerfilPayload,
): Promise<Usuario> {
  const { data } = await api.patch<Usuario>('/usuarios/me', payload);
  return data;
}

/** CU04 — Cambiar mi contraseña */
export async function cambiarMiContrasena(payload: {
  contrasena_actual: string;
  contrasena_nueva: string;
}): Promise<{ mensaje: string }> {
  const { data } = await api.patch<{ mensaje: string }>(
    '/usuarios/me/contrasena',
    payload,
  );
  return data;
}