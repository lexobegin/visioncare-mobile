/**
 * ══════════════════════════════════════════════════════
 * Capturas y análisis visual — SPRINT 2.
 *
 * - TipoAnalisis: catálogo del backend (7 tipos)
 * - Resultados por tipo (espejo de resultados-analisis.dto.ts)
 * - CapturaResponse ampliado (resultados por tipo)
 * - MODO CONTINUO: AnalisisContinuoResponse (nivel_novedad)
 * ══════════════════════════════════════════════════════
 */

// ─── Catálogo de análisis (espejo tipo-analisis.enum.ts) ───

export type TipoAnalisis =
  | 'OBJETOS'      // CU08 — YOLO (S1)
  | 'OCR'          // CU11 — lectura de textos
  | 'SENALES'      // CU12 — señales y lugares
  | 'PRODUCTOS'    // CU13 — productos y envases
  | 'COLORES'      // CU14 — color dominante
  | 'BILLETES'     // CU15/16 — billetes + autenticidad
  | 'DESCRIPCION'; // CU10 — descripción de escena

export const TIPOS_ANALISIS: TipoAnalisis[] = [
  'OBJETOS', 'OCR', 'SENALES', 'PRODUCTOS', 'COLORES', 'BILLETES', 'DESCRIPCION',
];

/** Metadatos por tipo (etiquetas para la UI + CU) */
export const INFO_TIPO_ANALISIS: Record<
  TipoAnalisis,
  { etiqueta: string; descripcion: string; icono: string; casoUso: string }
> = {
  OBJETOS: {
    etiqueta: 'Objetos',
    descripcion: 'Personas y objetos del entorno',
    icono: '🔍',
    casoUso: 'CU08',
  },
  OCR: {
    etiqueta: 'Leer texto',
    descripcion: 'Carteles, etiquetas, precios y menús',
    icono: '📖',
    casoUso: 'CU11',
  },
  SENALES: {
    etiqueta: 'Señales',
    descripcion: 'Salidas, baños, peligros y lugares',
    icono: '🚏',
    casoUso: 'CU12',
  },
  PRODUCTOS: {
    etiqueta: 'Productos',
    descripcion: 'Productos y envases comerciales',
    icono: '📦',
    casoUso: 'CU13',
  },
  COLORES: {
    etiqueta: 'Colores',
    descripcion: 'Color de prendas y objetos',
    icono: '🎨',
    casoUso: 'CU14',
  },
  BILLETES: {
    etiqueta: 'Billetes',
    descripcion: 'Valor del billete y autenticidad estimada',
    icono: '💵',
    casoUso: 'CU15/16',
  },
  DESCRIPCION: {
    etiqueta: 'Describir',
    descripcion: 'Descripción completa de la escena',
    icono: '🗺️',
    casoUso: 'CU10',
  },
};

// ─── Detección YOLO (S1) ───

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

// ─── Resultados por tipo (espejo resultados-analisis.dto.ts) ───

/** CU11 — OCR */
export interface ResultadoOcr {
  texto_extraido: string;
  idioma: string | null;
  confianza: number | null;
  tipo_documento: string | null;
}

/** CU12 — señales */
export interface ItemSenal {
  tipo_senal: string;
  nombre_reconocido: string | null;
  descripcion: string | null;
  confianza: number | null;
}

/** CU13 — productos */
export interface ItemProducto {
  nombre_producto: string | null;
  marca: string | null;
  categoria: string | null;
  descripcion: string | null;
  confianza: number | null;
}

/** CU14 — colores */
export interface ResultadoColores {
  color_principal: string;
  colores_secundarios: string[] | null;
  confianza: number | null;
}

/** CU15/16 — billetes */
export type EstimacionAutenticidad =
  | 'PROBABLEMENTE_AUTENTICO'
  | 'PROBABLEMENTE_SOSPECHOSO'
  | 'INDETERMINADO';

export interface ResultadoBillete {
  moneda: string | null;
  denominacion: string | null;
  confianza: number | null;
  autenticidad_estimacion: EstimacionAutenticidad | null;
  confianza_autenticidad: number | null;
  observaciones: string | null;
}

/** CU10 — descripción de escena */
export interface ResultadoDescripcion {
  descripcion: string;
  resumen: string;
  confianza: number | null;
}

// ─── Captura (respuesta ampliada S2) ───

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

  /** S2 — eco del análisis solicitado */
  tipo_analisis?: string;

  /** S2 — resultados (solo el del análisis ejecutado viene lleno) */
  detecciones?: DeteccionResponse[];
  lectura_ocr?: ResultadoOcr;
  senales?: ItemSenal[];
  productos?: ItemProducto[];
  colores?: ResultadoColores;
  billete?: ResultadoBillete;
  descripcion?: ResultadoDescripcion;

  /** Resumen listo para TTS (siempre presente — nunca silencio) */
  resumen_voz?: string | null;
  ia_disponible?: boolean;
}

// ─── MODO CONTINUO (espejo analisis-continuo.dto.ts) ───

/** Nivel de novedad (decisión HU17 del backend) */
export type NivelNovedad = 'SILENCIO' | 'INFO' | 'ALERTA';

/** Alerta emitida (solo presente con nivel ALERTA) */
export interface AlertaEmitida {
  id_alerta: number;
  tipo_alerta: string;
  nivel: string;
  prioridad: number;
  canal: string;
  mensaje: string;
}

/** Payload multipart de POST /capturas/analizar */
export interface AnalisisContinuoPayload {
  uri: string;
  ancho: number;
  alto: number;
  bajoConsumo: boolean;
  /** T19 — 'OCR' = lectura continua de texto (efímero) */
  tipoAnalisis?: 'OCR';
  latitud?: number;
  longitud?: number;
  precisionGps?: number;
}

/** Respuesta del ciclo del Modo Continuo */
export interface AnalisisContinuoResponse {
  nivel_novedad: NivelNovedad;
  /** Texto para TTS (null en SILENCIO — la app NO habla) */
  mensaje_voz: string | null;
  alerta?: AlertaEmitida;
  meta: {
    duracion_ms: number;
    detecciones: number;
    /** Ritmo que manda el backend: 3000/6000 (bajo consumo)/2000 (post-alerta) */
    siguiente_analisis_ms: number;
  };
}