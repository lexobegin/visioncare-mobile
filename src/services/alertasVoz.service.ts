import { alertasService, AlertasService } from './alertas.service';
import { ttsService, TTSService } from './tts.service';
import type { AlertaRiesgo } from '@/types/alerta';

/**
 * ══════════════════════════════════════════════════════════════════════
 * VisionCare AI — CU18 / HU18: Emitir Alertas por Voz
 *
 * Responsabilidades:
 *   1. Escuchar las alertas generadas por CU17 (AlertasService).
 *   2. Despachar la síntesis de voz mediante TTSService (expo-speech).
 *   3. Respetar la prioridad de las alertas:
 *      - Una alerta crítica interrumpe inmediatamente mensajes de menor prioridad.
 *      - Alertas de menor prioridad nunca interrumpen alertas críticas en curso.
 *   4. Evitar reproducciones simultáneas (canal único con cerrojo secuencial).
 *   5. Descartar alertas caducadas (TTL) para no hablar sobre eventos obsoletos.
 *   6. Respetar las preferencias de accesibilidad de CU03:
 *      - alertas_sonoras (si está apagada, no reproduce alertas).
 *      - voz_habilitada (si está apagada, silencio total).
 *      - volumen_voz y velocidad_voz.
 *   7. Gestión limpia de ciclo de vida (iniciar / detener / desuscribir).
 * ══════════════════════════════════════════════════════════════════════
 */

export class AlertasVozService {
  private alertasSvc: AlertasService;
  private ttsSvc: TTSService;

  private desuscribirAlertas: (() => void) | null = null;
  private alertaEnReproduccion: AlertaRiesgo | null = null;
  private reproduciendo: boolean = false;
  private activo: boolean = false;

  constructor(
    alertasSvc: AlertasService = alertasService,
    ttsSvc: TTSService = ttsService,
  ) {
    this.alertasSvc = alertasSvc;
    this.ttsSvc = ttsSvc;
  }

  /**
   * Activa el despachador de voz y se suscribe a los eventos de CU17.
   */
  iniciar(): void {
    if (this.activo) return;
    this.activo = true;

    this.desuscribirAlertas = this.alertasSvc.alGenerarAlerta((nuevaAlerta) => {
      this.alRecibirAlerta(nuevaAlerta);
    });
  }

  /**
   * Detiene el despachador, libera la suscripción de CU17 y detiene el audio.
   */
  detener(): void {
    this.activo = false;

    if (this.desuscribirAlertas) {
      this.desuscribirAlertas();
      this.desuscribirAlertas = null;
    }

    this.alertaEnReproduccion = null;
    this.reproduciendo = false;
    void this.ttsSvc.detener();
  }

  /**
   * Callback reactivo invocado cuando CU17 admite una nueva alerta.
   */
  public alRecibirAlerta(alerta: AlertaRiesgo): void {
    if (!this.activo) return;

    const config = this.ttsSvc.obtenerConfig();
    if (!config.habilitada || !config.alertasSonoras) {
      return;
    }

    const prioridadActual = Math.max(
      this.alertaEnReproduccion?.prioridad ?? 0,
      this.ttsSvc.obtenerPrioridadEnCurso(),
    );

    // Si ya estamos reproduciendo una alerta o mensaje de voz
    if (this.reproduciendo || prioridadActual > 0) {
      // Requerimiento 3 y 5: Alerta crítica nueva interrumpe alertas o mensajes de menor importancia
      if (alerta.prioridad > prioridadActual) {
        this.extraerDeColaSiExiste(alerta.id);
        this.emitirAlerta(alerta);
        return;
      }

      // Requerimiento 4: Alerta de menor o igual prioridad no interrumpe la actual.
      // Como CU17 ya la ordenó en su cola de prioridad, se despachará secuencialmente
      // cuando termine la actual.
      return;
    }

    // Si el canal está libre, extraer de la cola y emitir directamente la alerta
    this.extraerDeColaSiExiste(alerta.id);
    this.emitirAlerta(alerta);
  }

  /**
   * Remueve una alerta de la cola de AlertasService si está presente,
   * evitando que se vuelva a despachar una vez finalizada la emisión actual.
   */
  private extraerDeColaSiExiste(id: string): void {
    const pendientes = (this.alertasSvc as any).colaPrioritaria;
    if (Array.isArray(pendientes)) {
      const idx = pendientes.findIndex((a: AlertaRiesgo) => a.id === id);
      if (idx !== -1) {
        pendientes.splice(idx, 1);
      }
    }
  }

  /**
   * Extrae y reproduce la siguiente alerta prioritaria de la cola de CU17.
   */
  public despacharSiguiente(ahora: number = Date.now()): void {
    if (!this.activo || this.reproduciendo) {
      return;
    }

    const config = this.ttsSvc.obtenerConfig();
    if (!config.habilitada || !config.alertasSonoras) {
      return;
    }

    const siguiente = this.alertasSvc.obtenerSiguienteAlerta(ahora);
    if (!siguiente) {
      this.reproduciendo = false;
      this.alertaEnReproduccion = null;
      return;
    }

    // Requerimiento 10: Descartar alertas obsoletas que hayan superado su TTL
    if (ahora - siguiente.timestamp > siguiente.ttlMs) {
      // Se descarta y se continúa con la siguiente
      this.despacharSiguiente(ahora);
      return;
    }

    this.emitirAlerta(siguiente);
  }

  /**
   * Ejecuta la síntesis de voz a través del TTSService asegurando el cerrojo de estado.
   */
  private emitirAlerta(alerta: AlertaRiesgo): void {
    this.reproduciendo = true;
    this.alertaEnReproduccion = alerta;

    void this.ttsSvc.reproducirAlerta(alerta, {
      alTerminar: () => {
        this.reproduciendo = false;
        this.alertaEnReproduccion = null;
        // Procesar la siguiente alerta en la cola
        this.despacharSiguiente();
      },
      onError: () => {
        this.reproduciendo = false;
        this.alertaEnReproduccion = null;
        this.despacharSiguiente();
      },
    });
  }

  // ═══════════════ MÉTODOS DE INSPECCIÓN (TESTING Y MONITOREO) ═══════════════

  estaActivo(): boolean {
    return this.activo;
  }

  estaReproduciendo(): boolean {
    return this.reproduciendo;
  }

  obtenerAlertaEnReproduccion(): AlertaRiesgo | null {
    return this.alertaEnReproduccion;
  }
}

/** Instancia singleton para uso en la aplicación móvil */
export const alertasVozService = new AlertasVozService();
