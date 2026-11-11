/**
 * ══════════════════════════════════════════════════════
 * Comandos de voz (CU06) — actualizado S2 con tipo_analisis.
 * ══════════════════════════════════════════════════════
 */

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
  /** S2 — análisis pre-seleccionado (null si no aplica) */
  tipo_analisis: string | null;
  respuesta_voz: string;
  confianza: number;
  fecha_ejecucion: string;
}