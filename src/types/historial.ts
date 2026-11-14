/**
 * ══════════════════════════════════════════════════════
 * Tipos del módulo historial — espejo de modules/historial
 * (CU23: feed consolidado de actividades).
 * ══════════════════════════════════════════════════════
 */

import type { ConsultaPaginada } from './common';

/** Origen de la fila del feed */
export type FuenteActividad = 'EVENTO' | 'VOZ' | 'CAPTURA';

/** Actividad (fila del feed consolidado) */
export interface Actividad {
  fuente: FuenteActividad;
  tipo_actividad: string;
  descripcion?: string | null;
  referencia_id?: number | null;
  fecha: string;
}

/** GET /historial — filtros (hereda page/limit/buscar del backend) */
export interface HistorialQuery extends ConsultaPaginada {
  tipo_actividad?: string;
  /** YYYY-MM-DD */
  fecha_desde?: string;
  fecha_hasta?: string;
  /** true (default) = fusiona eventos + voz + capturas */
  consolidado?: boolean;
}

/** GET /historial/resumen — conteos por tipo */
export interface ResumenActividad {
  tipo_actividad: string;
  fuente: string;
  total: number;
}
