/**
 * ══════════════════════════════════════════════════════
 * Preferencias de accesibilidad (CU03) — sin cambios S2.
 * ══════════════════════════════════════════════════════
 */

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