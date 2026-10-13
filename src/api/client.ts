import axios, { AxiosError } from 'axios';

import { ENV } from '@/config/env';
import { eliminarToken, obtenerToken } from './token';

const apiBaseUrl = ENV.apiUrl
  .trim()
  .replace(/([^:]\/)\/+/g, '$1')
  .replace(/\/+$/, '');

/**
 * ══════════════════════════════════════════════════════
 * Cliente HTTP único de la app móvil (axios).
 *
 * - baseURL: EXPO_PUBLIC_API_URL (localhost + túnel ADB
 *   con dispositivo físico por USB).
 * - Interceptor de petición: inyecta Bearer desde SecureStore.
 * - Interceptor 401: limpia el token y notifica al
 *   AuthContext (Tanda 3) mediante un evento de sesión —
 *   el navigate se ejecuta desde la capa de UI.
 * ══════════════════════════════════════════════════════
 */

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Interceptor de PETICIÓN ───
api.interceptors.request.use(async (config) => {
  const token = await obtenerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor de RESPUESTA ───
api.interceptors.response.use(
  (respuesta) => respuesta,

  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    const esLoginORegistro =
      url.includes('/auth/login') || url.includes('/auth/registro');

    // 401 fuera de login/registro → sesión inválida:
    // limpiar y avisar a la UI (AuthContext navega a Login).
    if (error.response?.status === 401 && !esLoginORegistro) {
      void eliminarToken();
      emitterSesionExpirada();
    }

    return Promise.reject(error);
  },
);

// ══════════════════════════════════════════════════════
// Emisor simple de "sesión expirada" (pub/sub sin deps).
// El AuthContext se suscribe en la Tanda 3.
// ══════════════════════════════════════════════════════

type OyenteSesion = () => void;
const oyentes = new Set<OyenteSesion>();

export function alExpirarSesion(oyente: OyenteSesion): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente); // función de cancelación
}

function emitterSesionExpirada(): void {
  oyentes.forEach((o) => o());
}