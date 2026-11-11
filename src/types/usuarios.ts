/**
 * ══════════════════════════════════════════════════════
 * Tipos de autenticación y usuarios (S1 — sin cambios S2).
 * ══════════════════════════════════════════════════════
 */

// ─── Auth ───

export type Rol = 'USUARIO' | 'ADMIN' | 'INSTITUCION';
export type EstadoUsuario = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

export interface UsuarioAuth {
  id_usuario: number;
  correo: string;
  rol: Rol;
  nombres: string;
  apellidos?: string;
}

export interface TokenResponse {
  ok: true;
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  usuario: UsuarioAuth;
}

export interface LoginPayload {
  correo: string;
  contrasena: string;
}

export interface RegistroPayload {
  correo: string;
  contrasena: string;
  perfil: {
    nombres: string;
    apellidos?: string;
    telefono?: string;
    fecha_nacimiento?: string;
    idioma?: 'es' | 'en';
  };
}

// ─── Usuario / perfil ───

export interface Perfil {
  id_perfil: number;
  nombres: string;
  apellidos?: string | null;
  telefono?: string | null;
  fecha_nacimiento?: string | null;
  idioma: string;
  foto_r2_key?: string | null;
}

export interface Usuario {
  id_usuario: number;
  correo: string;
  rol: Rol;
  estado: EstadoUsuario;
  id_institucion?: number | null;
  ultimo_acceso?: string | null;
  created_at: string;
  perfil?: Perfil | null;
}

export interface ActualizarPerfilPayload {
  nombres?: string;
  apellidos?: string;
  telefono?: string;
  fecha_nacimiento?: string;
  idioma?: 'es' | 'en';
}