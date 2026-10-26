/**
 * ══════════════════════════════════════════════════════════════════════
 * VisionCare AI — Móvil — Tipos del Caso de Uso CU17 (Priorizar Alertas)
 * ══════════════════════════════════════════════════════════════════════
 *
 * Define la estructura de datos, niveles de severidad y parámetros de
 * configuración para la clasificación, filtrado y ordenamiento de alertas.
 *
 * NOTA TÉCNICA SOBRE ESTIMACIONES:
 * Las coordenadas bounding box (bbox) normalizadas (0.0 a 1.0) producidas
 * por el detector YOLO permiten calcular la posición horizontal relativa
 * y el área proporcional del objeto en el fotograma. Estas métricas se
 * utilizan como REGLAS HEURÍSTICAS para estimar la proximidad y trayectoria
 * aparente, sin pretender constituir mediciones físicas reales de distancia
 * ni probabilidades matemáticas exactas de colisión.
 */

/** Niveles de riesgo y criticidad para personas con discapacidad visual */
export type NivelRiesgo = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO' | 'INFO';

/** Posición horizontal estimada en el campo visual del usuario */
export type PosicionAproximada = 'FRENTE' | 'IZQUIERDA' | 'DERECHA';

/** Proximidad estimada a partir del área relativa que ocupa en el encuadre */
export type ProximidadAproximada = 'MUY_CERCA' | 'CERCA' | 'MEDIA' | 'LEJOS';

/**
 * Representación estructurada de una alerta priorizada lista para ser
 * consumida por interfaces de usuario o subsistemas de audio (CU18).
 */
export interface AlertaRiesgo {
  /** Identificador único de la instancia de alerta */
  id: string;

  /** Nivel de riesgo categorizado */
  nivel: NivelRiesgo;

  /**
   * Ponderación numérica para ordenamiento estricto:
   * CRITICO = 4, ALTO = 3, MEDIO = 2, BAJO = 1, INFO = 0
   */
  prioridad: number;

  /** Nombre del objeto en inglés original de COCO (ej: 'car', 'person') */
  etiqueta: string;

  /** Nombre traducido y adaptado al español (ej: 'auto', 'persona') */
  etiquetaEs: string;

  /** Mensaje verbal descriptivo optimizado para síntesis de voz */
  mensaje: string;

  /** Posición aparente en el campo de visión */
  posicion: PosicionAproximada;

  /** Proximidad heurística aproximada */
  proximidad: ProximidadAproximada;

  /** Confianza del detector IA (0.0 a 1.0) */
  confianza: number;

  /** Área relativa calculada a partir del bbox (0.0 a 1.0) */
  areaRelativa: number;

  /** Momento en milisegundos en que se generó la alerta */
  timestamp: number;

  /** Tiempo de vida útil (ms) antes de caducar por obsolescencia */
  ttlMs: number;

  /** Coordenadas bounding box originales si estuvieron presentes */
  bbox?: {
    x_min: number | null;
    y_min: number | null;
    x_max: number | null;
    y_max: number | null;
  };
}

/** Configuración de umbrales y comportamiento del motor de priorización */
export interface ConfiguracionAlertas {
  /**
   * Período de enfriamiento (cooldown) en milisegundos para evitar
   * notificaciones repetitivas del mismo objeto en la misma posición (RNF06).
   * @default 4000 (4 segundos)
   */
  intervaloDeduplicacionMs: number;

  /**
   * Tiempo máximo en milisegundos antes de que una alerta en cola
   * sea descartada por pérdida de vigencia temporal.
   * @default 5000 (5 segundos)
   */
  tiempoCaducidadAlertaMs: number;

  /**
   * Umbral mínimo de confianza (0 a 1) para aceptar una detección.
   * @default 0.40
   */
  umbralConfianzaMinima: number;

  /**
   * Si es true, una alerta de nivel CRITICO sobrepasará el cooldown si
   * la anterior era de menor severidad.
   * @default true
   */
  permitirEscalamientoCritico: boolean;
}

/** Interfaz del consumidor/oyente de alertas priorizadas (preparada para CU18) */
export type OyenteAlerta = (alerta: AlertaRiesgo) => void;
