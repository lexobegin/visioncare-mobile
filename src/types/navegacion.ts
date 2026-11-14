/**
 * ══════════════════════════════════════════════════════
 * Tipos del módulo navegación — espejo de modules/navegacion
 * (CU24) y de los payloads offline de sincronización.
 * ══════════════════════════════════════════════════════
 */

/** BD: ck_navegacion_modo */
export type ModoNavegacion = 'ASISTIDA' | 'VOZ' | 'MAPA';

/** BD: ck_navegacion_estado */
export type EstadoNavegacion =
  | 'INICIADA'
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'ERROR';

/** Estados de cierre que acepta PATCH /navegaciones/:id/finalizar */
export type EstadoFinalNavegacion = 'COMPLETADA' | 'CANCELADA' | 'ERROR';

/** Punto GPS de la traza (respuesta) */
export interface PuntoNavegacion {
  id_punto: number;
  orden: number;
  latitud: number;
  longitud: number;
  instruccion?: string | null;
  referencia_entorno?: string | null;
}

/** Navegación (respuesta; métricas y traza solo en el detalle) */
export interface Navegacion {
  id_navegacion: number;
  id_usuario: number;
  origen_latitud?: number | null;
  origen_longitud?: number | null;
  destino_latitud?: number | null;
  destino_longitud?: number | null;
  destino_descripcion?: string | null;
  modo: ModoNavegacion;
  estado: EstadoNavegacion;
  fecha_inicio: string;
  fecha_fin?: string | null;
  puntos?: PuntoNavegacion[];
  /** Metros (Haversine sobre la traza) — detalle */
  distancia_metros?: number | null;
  /** Segundos — detalle */
  duracion_segundos?: number | null;
  mensaje_voz?: string | null;
}

/** POST /navegaciones */
export interface CrearNavegacionPayload {
  modo?: ModoNavegacion;
  destino_descripcion?: string;
  origen_latitud?: number;
  origen_longitud?: number;
  destino_latitud?: number;
  destino_longitud?: number;
}

/** POST /navegaciones/:id/puntos */
export interface AgregarPuntoPayload {
  latitud: number;
  longitud: number;
  orden?: number;
  instruccion?: string;
  referencia_entorno?: string;
}

/** PATCH /navegaciones/:id/finalizar */
export interface FinalizarNavegacionPayload {
  estado_final: EstadoFinalNavegacion;
}

// ─── Payloads offline (CU25 — cola del móvil) ───

/** Punto offline: referencia el servidor o el ID local del lote */
export interface PuntoNavegacionOfflinePayload {
  /** ID en el servidor (navegación ya creada) */
  id_navegacion?: number;
  /** ID local generado por la app (misma subida: NAVEGACION primero) */
  id_navegacion_local?: string;
  latitud: number;
  longitud: number;
  orden?: number;
  instruccion?: string;
  referencia_entorno?: string;
}

/**
 * Navegación completa offline (crea navegación + puntos en un
 * solo cambio; `estado` cierra la navegación directamente).
 */
export interface NavegacionOfflinePayload {
  modo?: ModoNavegacion;
  estado?: EstadoNavegacion;
  destino_descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  origen_latitud?: number;
  origen_longitud?: number;
  destino_latitud?: number;
  destino_longitud?: number;
  puntos?: {
    latitud: number;
    longitud: number;
    orden?: number;
    instruccion?: string;
    referencia_entorno?: string;
  }[];
}
