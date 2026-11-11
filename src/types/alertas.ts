/**
 * ══════════════════════════════════════════════════════
 * Alertas (HU17–19) — espejo de modules/alertas (backend).
 * ══════════════════════════════════════════════════════
 */

import type { ConsultaPaginada } from './common';

export type NivelAlerta = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

export type CanalAlerta =
  | 'VOZ'
  | 'SONIDO'
  | 'VIBRACION'
  | 'VOZ_VIBRACION'
  | 'MULTICANAL';

export interface Alerta {
  id_alerta: number;
  id_usuario: number;
  id_deteccion?: number | null;
  tipo_alerta: string;
  nivel: NivelAlerta;
  /** Texto listo para TTS */
  mensaje: string;
  /** 1–5 (5 = máxima urgencia) */
  prioridad: number;
  canal: CanalAlerta;
  atendida: boolean;
  fecha_generacion: string;
  fecha_atencion?: string | null;
}

export interface AlertaQuery extends ConsultaPaginada {
  nivel?: NivelAlerta;
  tipo_alerta?: string;
  atendida?: 'true' | 'false';
}

export interface ResumenAlertas {
  por_nivel: Record<string, number>;
  por_tipo: { tipo_alerta: string; total: number }[];
  total_pendientes: number;
  total_hoy: number;
}