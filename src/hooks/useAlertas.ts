import { useCallback, useEffect, useState } from 'react';

import {
  atenderAlerta,
  atenderAlertasLote,
  listarAlertasPendientes,
} from '@/api/alertas.api';
import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { mensajeDeError, type Alerta, type MetaPaginacion } from '@/types';
import { reproducirAlerta } from '@/services/alertas-reproduccion';

/**
 * ══════════════════════════════════════════════════════
 * Hook de alertas pendientes (HU18) — usado por PantallaAlertas.
 *
 *   - Carga pendientes (prioridad DESC — orden del backend)
 *   - reproducirYAtender(): voz+háptica → marca atendida
 *   - atenderTodas(): bulk + confirmación por voz
 * ══════════════════════════════════════════════════════
 */
export function useAlertas() {
  const { preferencias } = useAuth();
  const { anunciar } = useTTS();

  const [pendientes, setPendientes] = useState<Alerta[]>([]);
  const [meta, setMeta] = useState<MetaPaginacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await listarAlertasPendientes(1, 50);
      setPendientes(r.datos);
      setMeta(r.meta);
      setError(null);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Reproduce (voz+háptica) y marca como atendida */
  const reproducirYAtender = useCallback(
    async (alerta: Alerta) => {
      setProcesando(true);
      try {
        await reproducirAlerta(alerta, {
          vibracionHabilitada: preferencias?.vibracion_habilitada ?? true,
        });
        await atenderAlerta(alerta.id_alerta);
        setPendientes((prev) =>
          prev.filter((a) => a.id_alerta !== alerta.id_alerta),
        );
      } catch (e) {
        anunciar(`Error. ${mensajeDeError(e)}`, { forzar: true });
      } finally {
        setProcesando(false);
      }
    },
    [preferencias?.vibracion_habilitada, anunciar],
  );

  /** Marca TODAS las pendientes como atendidas (bulk) */
  const atenderTodas = useCallback(async () => {
    if (pendientes.length === 0) return;
    setProcesando(true);
    try {
      const r = await atenderAlertasLote(
        pendientes.map((a) => a.id_alerta),
      );
      setPendientes([]);
      setMeta((m) =>
        m ? { ...m, total: Math.max(0, m.total - r.atendidas) } : m,
      );
      anunciar(`${r.atendidas} alertas marcadas como atendidas.`);
    } catch (e) {
      anunciar(`Error. ${mensajeDeError(e)}`, { forzar: true });
    } finally {
      setProcesando(false);
    }
  }, [pendientes, anunciar]);

  return {
    pendientes,
    meta,
    cargando,
    error,
    procesando,
    recargar: cargar,
    reproducirYAtender,
    atenderTodas,
  };
}