/**
 * ══════════════════════════════════════════════════════════════════════
 * VisionCare AI — Móvil — Servicio CU17: Priorizar Alertas
 * ══════════════════════════════════════════════════════════════════════
 *
 * Responsabilidades:
 *  1. Recibir detecciones visuales (DeteccionResponse[]).
 *  2. Clasificar cada objeto en un nivel de riesgo (CRITICO, ALTO, MEDIO, BAJO, INFO)
 *     mediante reglas heurísticas basadas en la etiqueta y el bounding box.
 *  3. Filtrar y deduplicar alertas repetitivas (RNF06 - evitar sobrecarga).
 *  4. Organizar las alertas en una estructura de cola de prioridad estable.
 *  5. Proveer una interfaz limpia para que el consumidor (CU18) reciba
 *     las alertas priorizadas en orden de urgencia.
 */

import type { DeteccionResponse } from '@/types';
import type {
  AlertaRiesgo,
  ConfiguracionAlertas,
  NivelRiesgo,
  OyenteAlerta,
  PosicionAproximada,
  ProximidadAproximada,
} from '@/types/alerta';

/** Valores numéricos de severidad para ordenamiento estricto */
export const VALOR_SEVERIDAD: Record<NivelRiesgo, number> = {
  CRITICO: 4,
  ALTO: 3,
  MEDIO: 2,
  BAJO: 1,
  INFO: 0,
};

/** Configuración por defecto del servicio de priorización */
export const CONFIG_DEFAULT_ALERTAS: ConfiguracionAlertas = {
  intervaloDeduplicacionMs: 4000,
  tiempoCaducidadAlertaMs: 5000,
  umbralConfianzaMinima: 0.40,
  permitirEscalamientoCritico: true,
};

/** Categorías de alto riesgo cinético / vehicular (COCO dataset) */
const ETIQUETAS_VEHICULOS = new Set([
  'car',
  'bus',
  'truck',
  'motorcycle',
  'bicycle',
]);

/** Categorías de obstáculos fijos de impacto o tropiezo */
const ETIQUETAS_OBSTACULOS_FIJOS = new Set([
  'stairs',
  'chair',
  'bench',
  'door',
  'potted plant',
  'stop sign',
  'fire hydrant',
]);

/** Categorías de seres vivos en movimiento */
const ETIQUETAS_SERES_VIVOS = new Set([
  'person',
  'dog',
  'cat',
  'horse',
]);

export class AlertasService {
  private config: ConfiguracionAlertas = { ...CONFIG_DEFAULT_ALERTAS };

  /** Cola interna de alertas ordenadas por prioridad */
  private colaPrioritaria: AlertaRiesgo[] = [];

  /**
   * Registro histórico de última alerta emitida por clave (etiqueta_posicion).
   * Almacena timestamp y severidad para deduplicación y escalamiento crítico.
   */
  private historialDeduplicacion = new Map<
    string,
    { timestamp: number; severidad: number; nivel: NivelRiesgo }
  >();

  /** Suscriptores para notificación desacoplada (CU18) */
  private oyentes = new Set<OyenteAlerta>();

  /** Contador secuencial para desempate FIFO estable */
  private contadorSecuencia = 0;

  // ═══════════════ CONFIGURACIÓN ═══════════════

  /** Actualiza parámetros de configuración y umbrales */
  configurar(parcial: Partial<ConfiguracionAlertas>): void {
    this.config = { ...this.config, ...parcial };
  }

  /** Obtiene una copia de la configuración activa */
  obtenerConfiguracion(): ConfiguracionAlertas {
    return { ...this.config };
  }

  /** Restablece la configuración predeterminada */
  resetearConfiguracion(): void {
    this.config = { ...CONFIG_DEFAULT_ALERTAS };
  }

  // ═══════════════ SUSCRIPCIÓN / EVENTOS (CU18) ═══════════════

  /**
   * Registra un consumidor de alertas priorizadas.
   * Retorna una función para cancelar la suscripción.
   */
  alGenerarAlerta(oyente: OyenteAlerta): () => void {
    this.oyentes.add(oyente);
    return () => {
      this.oyentes.delete(oyente);
    };
  }

  private notificarOyentes(alerta: AlertaRiesgo): void {
    this.oyentes.forEach((oyente) => {
      try {
        oyente(alerta);
      } catch {
        // Un error en un oyente no debe interrumpir el despachador
      }
    });
  }

  // ═══════════════ FLUJO PRINCIPAL: PROCESAR DETECCIONES ═══════════════

  /**
   * Recibe un listado de detecciones (ej. desde la API de capturas),
   * genera alertas válidas, las filtra por confianza y deduplicación,
   * las ordena por severidad y las ingresa en la cola de prioridad.
   *
   * @param detecciones Listado de detecciones provenientes del detector visual.
   * @param ahora Timestamp opcional para pruebas deterministas.
   * @returns Lista de alertas nuevas que fueron admitidas en la cola.
   */
  procesarDetecciones(
    detecciones: DeteccionResponse[] | null | undefined,
    ahora: number = Date.now(),
  ): AlertaRiesgo[] {
    if (!detecciones || !Array.isArray(detecciones) || detecciones.length === 0) {
      return [];
    }

    this.limpiarAlertasCaducadas(ahora);

    const alertasAdmitidas: AlertaRiesgo[] = [];

    for (const det of detecciones) {
      // 1. Validación de datos mínimos y umbral de confianza
      if (!this.esDeteccionValida(det)) {
        continue;
      }

      // 2. Extracción de métricas heurísticas de posición y proximidad
      const { areaRelativa, posicion, proximidad } =
        this.calcularMetricasHeuristicas(det);

      // 3. Clasificación de severidad
      const nivel = this.clasificarNivelRiesgo(det.etiqueta, areaRelativa, posicion);
      const prioridad = VALOR_SEVERIDAD[nivel];

      // 4. Verificación de deduplicación (anti-spam / RNF06)
      const clave = `${det.etiqueta.toLowerCase()}_${posicion}`;
      if (this.debeSuprimirPorDeduplicacion(clave, prioridad, ahora)) {
        continue;
      }

      // 5. Construcción de la alerta
      const alerta: AlertaRiesgo = {
        id: `alerta-${ahora}-${++this.contadorSecuencia}`,
        nivel,
        prioridad,
        etiqueta: det.etiqueta,
        etiquetaEs: det.etiqueta_es || det.etiqueta,
        mensaje: this.generarMensajeDescriptivo(
          det.etiqueta_es || det.etiqueta,
          nivel,
          posicion,
          proximidad,
        ),
        posicion,
        proximidad,
        confianza: det.confianza,
        areaRelativa,
        timestamp: ahora,
        ttlMs: this.config.tiempoCaducidadAlertaMs,
        bbox: det.bbox,
      };

      // 6. Actualizar historial de deduplicación
      this.historialDeduplicacion.set(clave, {
        timestamp: ahora,
        severidad: prioridad,
        nivel,
      });

      // 7. Insertar en cola de prioridad manteniendo orden estricto
      this.insertarEnCola(alerta);
      alertasAdmitidas.push(alerta);
    }

    // 8. Notificar a los consumidores en tiempo real en orden de prioridad
    const alertasOrdenadas = [...alertasAdmitidas].sort((a, b) => this.compararAlertas(a, b));
    for (const alerta of alertasOrdenadas) {
      this.notificarOyentes(alerta);
    }

    return alertasAdmitidas;
  }

  // ═══════════════ COLA DE PRIORIDAD ═══════════════

  /**
   * Inserta una alerta en la cola manteniendo orden estricto:
   * 1. Mayor prioridad primero (CRITICO > ALTO > MEDIO > BAJO > INFO).
   * 2. A igual prioridad, mayor área relativa (más cercano al usuario).
   * 3. A igual área, orden de llegada estable (FIFO).
   */
  private insertarEnCola(nueva: AlertaRiesgo): void {
    let indiceInsercion = this.colaPrioritaria.length;

    for (let i = 0; i < this.colaPrioritaria.length; i++) {
      const actual = this.colaPrioritaria[i];
      if (this.compararAlertas(nueva, actual) < 0) {
        indiceInsercion = i;
        break;
      }
    }

    this.colaPrioritaria.splice(indiceInsercion, 0, nueva);
  }

  /**
   * Función comparadora para ordenar alertas.
   * Retorna < 0 si 'a' debe ir ANTES que 'b'.
   */
  public compararAlertas(a: AlertaRiesgo, b: AlertaRiesgo): number {
    // 1. Mayor prioridad numérica primero
    if (b.prioridad !== a.prioridad) {
      return b.prioridad - a.prioridad;
    }

    // 2. Mayor área relativa primero (mayor proximidad aparente)
    if (Math.abs(b.areaRelativa - a.areaRelativa) > 0.01) {
      return b.areaRelativa - a.areaRelativa;
    }

    // 3. FIFO estable por momento de llegada
    return a.timestamp - b.timestamp;
  }

  /**
   * Extrae y devuelve la alerta de mayor prioridad de la cola.
   * Retorna null si la cola está vacía.
   */
  obtenerSiguienteAlerta(ahora: number = Date.now()): AlertaRiesgo | null {
    this.limpiarAlertasCaducadas(ahora);
    return this.colaPrioritaria.shift() ?? null;
  }

  /**
   * Consulta la alerta de mayor prioridad sin extraerla.
   */
  verSiguienteAlerta(ahora: number = Date.now()): AlertaRiesgo | null {
    this.limpiarAlertasCaducadas(ahora);
    return this.colaPrioritaria[0] ?? null;
  }

  /**
   * Retorna una copia de todas las alertas pendientes ordenadas.
   */
  obtenerAlertasPendientes(ahora: number = Date.now()): AlertaRiesgo[] {
    this.limpiarAlertasCaducadas(ahora);
    return [...this.colaPrioritaria];
  }

  /**
   * Vacía la cola de alertas y el historial de deduplicación.
   */
  limpiarTodo(): void {
    this.colaPrioritaria = [];
    this.historialDeduplicacion.clear();
  }

  /**
   * Elimina alertas que han superado su tiempo de vida útil (TTL).
   */
  public limpiarAlertasCaducadas(ahora: number = Date.now()): void {
    this.colaPrioritaria = this.colaPrioritaria.filter((a) => {
      const expirada = ahora - a.timestamp > a.ttlMs;
      return !expirada;
    });
  }

  /**
   * Limpia registros de deduplicación antiguos para liberar memoria.
   */
  public podarHistorialDeduplicacion(ahora: number = Date.now()): void {
    for (const [clave, entrada] of this.historialDeduplicacion.entries()) {
      if (ahora - entrada.timestamp > this.config.intervaloDeduplicacionMs) {
        this.historialDeduplicacion.delete(clave);
      }
    }
  }

  // ═══════════════ REGLAS HEURÍSTICAS DE CLASIFICACIÓN ═══════════════

  /**
   * Determina si una detección contiene datos numéricos consistentes
   * y supera el umbral de confianza mínimo.
   */
  private esDeteccionValida(det: DeteccionResponse): boolean {
    if (!det || typeof det.etiqueta !== 'string' || !det.etiqueta.trim()) {
      return false;
    }

    if (
      typeof det.confianza !== 'number' ||
      isNaN(det.confianza) ||
      det.confianza < this.config.umbralConfianzaMinima ||
      det.confianza > 1.0
    ) {
      return false;
    }

    return true;
  }

  /**
   * Calcula área relativa y posición horizontal estimada a partir de bbox.
   */
  private calcularMetricasHeuristicas(det: DeteccionResponse): {
    areaRelativa: number;
    posicion: PosicionAproximada;
    proximidad: ProximidadAproximada;
  } {
    const bbox = det.bbox;

    // Si no cuenta con bbox válido, asignamos valores neutros conservadores
    if (
      !bbox ||
      typeof bbox.x_min !== 'number' ||
      typeof bbox.x_max !== 'number' ||
      typeof bbox.y_min !== 'number' ||
      typeof bbox.y_max !== 'number'
    ) {
      return {
        areaRelativa: 0.05,
        posicion: 'FRENTE',
        proximidad: 'MEDIA',
      };
    }

    // Coordenadas acotadas de seguridad [0, 1]
    const xMin = Math.max(0, Math.min(1, bbox.x_min));
    const xMax = Math.max(0, Math.min(1, bbox.x_max));
    const yMin = Math.max(0, Math.min(1, bbox.y_min));
    const yMax = Math.max(0, Math.min(1, bbox.y_max));

    const ancho = Math.max(0, xMax - xMin);
    const alto = Math.max(0, yMax - yMin);
    const areaRelativa = Number((ancho * alto).toFixed(4));

    // Centro horizontal para estimar trayectoria
    const centroX = (xMin + xMax) / 2;
    let posicion: PosicionAproximada = 'FRENTE';
    if (centroX < 0.35) {
      posicion = 'IZQUIERDA';
    } else if (centroX > 0.65) {
      posicion = 'DERECHA';
    }

    // Proximidad heurística según área relativa
    let proximidad: ProximidadAproximada = 'LEJOS';
    if (areaRelativa >= 0.25) {
      proximidad = 'MUY_CERCA';
    } else if (areaRelativa >= 0.10) {
      proximidad = 'CERCA';
    } else if (areaRelativa >= 0.03) {
      proximidad = 'MEDIA';
    }

    return { areaRelativa, posicion, proximidad };
  }

  /**
   * Clasifica el nivel de riesgo combinando la semántica del objeto,
   * el área aparente y la posición respecto a la trayectoria.
   */
  private clasificarNivelRiesgo(
    etiquetaOriginal: string,
    areaRelativa: number,
    posicion: PosicionAproximada,
  ): NivelRiesgo {
    const etiqueta = etiquetaOriginal.toLowerCase().trim();

    // 1. VEHÍCULOS / RIESGO CINÉTICO (Mayor peligrosidad para el invidente)
    if (ETIQUETAS_VEHICULOS.has(etiqueta)) {
      if (areaRelativa >= 0.18 || (areaRelativa >= 0.08 && posicion === 'FRENTE')) {
        return 'CRITICO';
      }
      if (areaRelativa >= 0.05) {
        return 'ALTO';
      }
      return 'MEDIO';
    }

    // 2. OBSTÁCULOS FIJOS / ESCALERAS / CAÍDAS / IMPACTO
    if (ETIQUETAS_OBSTACULOS_FIJOS.has(etiqueta)) {
      if (etiqueta === 'stairs' && areaRelativa >= 0.08) {
        return 'CRITICO';
      }
      if (areaRelativa >= 0.15 && posicion === 'FRENTE') {
        return 'ALTO';
      }
      if (areaRelativa >= 0.05) {
        return 'MEDIO';
      }
      return 'BAJO';
    }

    // 3. SERES VIVOS (Personas, animales domésticos)
    if (ETIQUETAS_SERES_VIVOS.has(etiqueta)) {
      if (areaRelativa >= 0.20 && posicion === 'FRENTE') {
        return 'ALTO';
      }
      if (areaRelativa >= 0.06) {
        return 'MEDIO';
      }
      return 'BAJO';
    }

    // 4. OBJETOS GENERALES / INFORMATIVOS
    if (areaRelativa >= 0.25 && posicion === 'FRENTE') {
      return 'MEDIO';
    }
    if (areaRelativa >= 0.05) {
      return 'BAJO';
    }
    return 'INFO';
  }

  /**
   * Evalúa si una alerta debe ser suprimida para evitar sobrecarga auditiva.
   */
  private debeSuprimirPorDeduplicacion(
    clave: string,
    nuevaSeveridad: number,
    ahora: number,
  ): boolean {
    const entradaPrevia = this.historialDeduplicacion.get(clave);
    if (!entradaPrevia) {
      return false;
    }

    const transcurrido = ahora - entradaPrevia.timestamp;

    // Si aún está dentro del intervalo de deduplicación
    if (transcurrido < this.config.intervaloDeduplicacionMs) {
      // Excepción: si el riesgo se incrementó respecto a la alerta previa
      if (
        this.config.permitirEscalamientoCritico &&
        nuevaSeveridad > entradaPrevia.severidad
      ) {
        return false; // Permitir la alerta escalada porque el peligro aumentó
      }
      return true; // Suprimir duplicado
    }

    return false;
  }

  /**
   * Construye un mensaje conciso optimizado para la persona con discapacidad visual.
   */
  private generarMensajeDescriptivo(
    etiquetaEs: string,
    nivel: NivelRiesgo,
    posicion: PosicionAproximada,
    proximidad: ProximidadAproximada,
  ): string {
    const locacionTexto =
      posicion === 'FRENTE'
        ? 'al frente'
        : posicion === 'IZQUIERDA'
          ? 'a la izquierda'
          : 'a la derecha';

    switch (nivel) {
      case 'CRITICO':
        return `¡Peligro! ${etiquetaEs} muy cerca ${locacionTexto}.`;
      case 'ALTO':
        return `Atención: ${etiquetaEs} ${locacionTexto}.`;
      case 'MEDIO':
        return `Obstáculo: ${etiquetaEs} ${locacionTexto}.`;
      case 'BAJO':
        return `${etiquetaEs} detectado ${locacionTexto}.`;
      case 'INFO':
      default:
        return `${etiquetaEs} visible.`;
    }
  }
}

/** Instancia singleton del servicio de priorización de alertas (CU17) */
export const alertasService = new AlertasService();
