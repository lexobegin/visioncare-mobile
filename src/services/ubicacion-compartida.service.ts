/**
 * ══════════════════════════════════════════════════════
 * CU21 — COMPARTIR UBICACIÓN (Sprint 3).
 *
 * Servicio observable con el mismo patrón que narracion.service:
 *   - iniciar(): ping inmediato + cada 60 s (best-effort,
 *     fire-and-forget — si falla la red el siguiente reintenta).
 *   - detener(): corta el ciclo.
 *   - suscribir()/estadoActual(): para el Switch de MasMenu.
 *
 * El usuario decide: el toggle "📍 Compartir mi ubicación"
 * (MasMenu) es el consentimiento explícito. Además, mientras el
 * ASISTENTE CONTINUO esté activo, narracion.service comparte
 * pings por su cuenta (misma api) — el escudo/pechera es un
 * escenario de riesgo donde avisar dónde estás puede salvar.
 *
 * PRIVACIDAD: los pings SOLO se envían con consentimiento activo;
 * en el mapa web solo ven al usuario ADMIN/INSTITUCION y los
 * contactos con autorizado_ubicacion = TRUE.
 * ══════════════════════════════════════════════════════
 */
import { obtenerUbicacion } from './location.service';
import { compartirUbicacion } from '@/api/ayuda.api';

export interface EstadoUbicacionCompartida {
  /** Toggle manual activo */
  activo: boolean;
  /** Último ping confirmado por el servidor (o null) */
  ultimoPing: string | null;
  /** Último error (para el subtítulo del toggle) */
  error: string | null;
}

const INTERVALO_PING_MS = 60_000;
const TIMEOUT_GPS_MS = 6000;

type Oyente = (estado: EstadoUbicacionCompartida) => void;

class UbicacionCompartidaService {
  private activo = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private enVuelo = false;

  private estado: EstadoUbicacionCompartida = {
    activo: false,
    ultimoPing: null,
    error: null,
  };
  private oyentes = new Set<Oyente>();

  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    oyente(this.estado);
    return () => {
      this.oyentes.delete(oyente);
    };
  }

  estadoActual(): EstadoUbicacionCompartida {
    return this.estado;
  }

  /** Toggle de MasMenu — si ya está activo, detiene */
  alternar(): void {
    if (this.activo) {
      this.detener();
    } else {
      this.iniciar();
    }
  }

  iniciar(): void {
    if (this.activo) return;
    this.activo = true;
    this.estado = { ...this.estado, activo: true, error: null };
    this.emitir();

    // Ping inmediato + ciclo de 60 s
    void this.enviarPing();
    this.timer = setInterval(() => void this.enviarPing(), INTERVALO_PING_MS);
  }

  detener(): void {
    this.activo = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.estado = { ...this.estado, activo: false };
    this.emitir();
  }

  /** Best-effort: nunca lanza (el toggle no debe "romperse") */
  async enviarPing(): Promise<void> {
    if (!this.activo || this.enVuelo) return;
    this.enVuelo = true;
    try {
      const u = await obtenerUbicacion({ timeoutMs: TIMEOUT_GPS_MS });
      if (!u) {
        this.estado = {
          ...this.estado,
          error: 'Sin señal GPS aún — reintentando…',
        };
        this.emitir();
        return;
      }
      const respuesta = await compartirUbicacion({
        latitud: u.latitud,
        longitud: u.longitud,
        ...(u.precision != null && { precision_metros: u.precision }),
      });
      this.estado = {
        ...this.estado,
        ultimoPing: respuesta.fecha_registro ?? new Date().toISOString(),
        error: null,
      };
      this.emitir();
    } catch (e) {
      // Red/backend caído: seguir intentando en el próximo ciclo
      this.estado = {
        ...this.estado,
        error: 'No se pudo enviar la ubicación — reintentando…',
      };
      this.emitir();
    } finally {
      this.enVuelo = false;
    }
  }

  private emitir(): void {
    this.oyentes.forEach((o) => o(this.estado));
  }
}

/** Instancia única de la app */
export const ubicacionCompartidaService = new UbicacionCompartidaService();
