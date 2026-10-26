/**
 * ══════════════════════════════════════════════════════
 * Tipos del dominio — espejo de los DTOs del backend.
 * (Mismos contratos que visioncare-web/src/types)
 * ══════════════════════════════════════════════════════
 */

// ─── Comunes ───

export interface MetaPaginacion {
  page: number;
  limit: number;
  total: number;
  totalPaginas: number;
}

export interface RespuestaPaginada<T> {
  ok: true;
  datos: T[];
  meta: MetaPaginacion;
}

export interface ConsultaPaginada {
  page?: number;
  limit?: number;
  buscar?: string;
}

/** Cuerpo de error estándar (HttpExceptionFilter del backend) */
export interface ApiErrorBody {
  ok: false;
  codigo: number;
  error: string;
  mensaje: string;
  detalles?: string[];
  ruta: string;
  timestamp: string;
}

/** Extrae mensaje legible de cualquier error del backend */
export function mensajeDeError(err: unknown): string {
  const cuerpo = err as {
    response?: { data?: ApiErrorBody };
    code?: string;
    message?: string;
  };

  const api = cuerpo?.response?.data;
  if (api?.mensaje) {
    return api.detalles?.length
      ? `${api.mensaje} ${api.detalles.join(' ')}`
      : api.mensaje;
  }

  // Sin red (túnel ADB caído, backend apagado)
  if (cuerpo?.code === 'ECONNREFUSED' || cuerpo?.code === 'ERR_NETWORK') {
    return 'No hay conexión con el servidor. Verifica que el backend esté corriendo y el túnel ADB activo (adb reverse tcp:3000 tcp:3000).';
  }

  return 'Error de conexión. Intenta nuevamente.';
}

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

// ─── Usuarios ───

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

// ─── Accesibilidad ───

export interface PreferenciasAccesibilidad {
  id_preferencia: number;
  id_usuario: number;
  voz_habilitada: boolean;
  volumen_voz: number;
  velocidad_voz: number;
  alertas_sonoras: boolean;
  vibracion_habilitada: boolean;
  intensidad_vibracion: number;
  confirmaciones_por_voz: boolean;
  modo_bajo_consumo: boolean;
}

export interface ActualizarPreferenciasPayload {
  voz_habilitada?: boolean;
  volumen_voz?: number;
  velocidad_voz?: number;
  alertas_sonoras?: boolean;
  vibracion_habilitada?: boolean;
  intensidad_vibracion?: number;
  confirmaciones_por_voz?: boolean;
  modo_bajo_consumo?: boolean;
}

// ─── Contactos ───

export type EstadoContacto = 'ACTIVO' | 'INACTIVO';

export interface Contacto {
  id_contacto: number;
  id_usuario: number;
  nombre: string;
  parentesco?: string | null;
  telefono?: string | null;
  correo?: string | null;
  prioridad: number;
  autorizado_ubicacion: boolean;
  autorizado_emergencias: boolean;
  estado: EstadoContacto;
}

export interface ContactoQuery extends ConsultaPaginada {
  estado?: 'ACTIVO' | 'INACTIVO' | 'TODOS';
}

export interface CrearContactoPayload {
  nombre: string;
  parentesco?: string;
  telefono?: string;
  correo?: string;
  prioridad?: number;
  autorizado_ubicacion?: boolean;
  autorizado_emergencias?: boolean;
}

export type ActualizarContactoPayload = Partial<CrearContactoPayload>;

// ─── Voz ───

export interface InterpretarComandoPayload {
  comando: string;
  confianza_stt?: number;
}

export interface ComandoVozResponse {
  id_comando: number;
  comando: string;
  intencion: string;
  caso_uso: string | null;
  accion_app: string;
  respuesta_voz: string;
  confianza: number;
  fecha_ejecucion: string;
}

// ─── Capturas / IA ───

export interface DeteccionResponse {
  id_deteccion: number;
  etiqueta: string;
  etiqueta_es: string;
  categoria?: string | null;
  confianza: number;
  bbox?: {
    x_min: number | null;
    y_min: number | null;
    x_max: number | null;
    y_max: number | null;
  };
  modelo_nombre?: string | null;
  fecha_deteccion: string;
}

export interface CapturaResponse {
  id_captura: number;
  id_usuario: number;
  r2_key?: string | null;
  url_imagen?: string | null;
  tipo_captura: string;
  origen: string;
  latitud?: number | null;
  longitud?: number | null;
  fecha_captura: string;
  procesada: boolean;
  estado: string;
  detecciones?: DeteccionResponse[];
  /** Resumen listo para TTS (construido por el backend) */
  resumen_voz?: string | null;
  ia_disponible?: boolean;
}

// ─── Alertas (CU17 / CU18) ───
export * from './alerta';