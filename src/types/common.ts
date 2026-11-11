/**
 * ══════════════════════════════════════════════════════
 * Tipos comunes — paginación, errores y helpers.
 * (Espejo de los DTOs comunes del backend)
 * ══════════════════════════════════════════════════════
 */

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

  if (cuerpo?.code === 'ECONNREFUSED' || cuerpo?.code === 'ERR_NETWORK') {
    return 'No hay conexión con el servidor. Verifica que el backend esté corriendo y el túnel ADB activo (adb reverse tcp:3000 tcp:3000).';
  }

  return 'Error de conexión. Intenta nuevamente.';
}