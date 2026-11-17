/**
 * ══════════════════════════════════════════════════════
 * Tipos del módulo IA LOCAL (N3 — modelo embebido offline).
 *
 * El motor LOCAL corre TensorFlow.js dentro del teléfono
 * (backend rn-webgl), con un modelo entrenado por nosotros
 * en Colab y empaquetado en assets/models/. Es el respaldo
 * de la cascada cuando no hay internet o el servidor falla.
 *
 * Cascada IA (defensa P4):
 *   N1  SERVIDOR → Backend NestJS → FastAPI (modelos locales
 *       en la MV de Google Cloud) — camino PRINCIPAL.
 *   N3  LOCAL → TF.js embebido en la app — funciona SIN
 *       internet. (N2 colas de datos ya existe: CU25/26.)
 * ══════════════════════════════════════════════════════
 */

/** Motores de la cascada IA: servidor propio o modelo embebido */
export type MotorIa = 'SERVIDOR' | 'LOCAL';

/** Estado de conectividad simplificado (NetInfo) */
export interface EstadoRed {
  conectado: boolean;
  /** 'wifi' | 'cellular' | 'none' | null si aún no se conoce */
  tipo: string | null;
}

/** Resultado de una inferencia del modelo embebido */
export interface ResultadoInferencia {
  /** Clase ganadora, p.ej. 'ORGÁNICO' | 'RECICLABLE' */
  etiqueta: string;
  /** Confianza de la clase ganadora (0..1) */
  confianza: number;
  /** Salida bruta del modelo (prob sigmoid de la clase 1 = RECICLABLE) */
  probabilidadBruta: number;
  /** Tiempo total lectura → decodificado → inferencia, en ms */
  latencia_ms: number;
  /** Backend TF.js usado: 'rn-webgl' o 'cpu' */
  backend: string;
  /** Identificador del modelo cargado */
  modelo: string;
  /** Solo multiclase (softmax): las 3 clases más probables */
  top3?: Array<{ etiqueta: string; confianza: number }>;
}

/** Por qué la cascada eligió ese motor */
export type MotivoCascada =
  | 'HAY_INTERNET_SERVIDOR_OK'
  | 'SIN_INTERNET'
  | 'SERVIDOR_NO_CONFIGURADO'
  | 'SERVIDOR_FALLO';

export interface ResultadoCascada {
  motor: MotorIa;
  motivo: MotivoCascada;
  /** Detalle extra (p.ej. el mensaje de error del servidor) */
  detalle: string | null;
  /** Presente cuando motor === 'LOCAL' */
  local: ResultadoInferencia | null;
  /** Presente cuando motor === 'SERVIDOR' */
  servidor: { etiqueta: string; confianza: number } | null;
}
