/**
 * ══════════════════════════════════════════════════════
 * API de autenticación (CU01 registro + CU02 login).
 * El AuthContext (Tanda 3) orquesta token + perfil.
 * ══════════════════════════════════════════════════════
 */

import type {
  LoginPayload,
  RegistroPayload,
  TokenResponse,
  Usuario,
} from '@/types';
import { api } from './client';

/** CU02 — Validar credenciales. NO guarda el token. */
export async function iniciarSesion(
  payload: LoginPayload,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', payload);
  return data;
}

/** CU01 — Crear cuenta + perfil (rol USUARIO fijo en backend). */
export async function registrarUsuario(
  payload: RegistroPayload,
): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>(
    '/auth/registro',
    payload,
  );
  return data;
}

/** Perfil completo del usuario autenticado (con Perfil 1:1). */
export async function obtenerPerfilActual(): Promise<Usuario> {
  const { data } = await api.get<Usuario>('/usuarios/me');
  return data;
}