/**
 * ══════════════════════════════════════════════════════
 * Conectividad — ¿hay internet? (decide N1 vs N3).
 *
 * Envuelve @react-native-community/netinfo (incluido en
 * Expo Go). La cascada usa hayInternet() antes de elegir
 * motor; las pantallas usan useConexion() para el banner.
 * ══════════════════════════════════════════════════════
 */

import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import type { EstadoRed } from './tipos';

/** Suscripción reactiva al estado de red (para UI) */
export function useConexion(): EstadoRed {
  const [estado, setEstado] = useState<EstadoRed>({
    conectado: true,
    tipo: null,
  });

  useEffect(() => {
    const desuscribir = NetInfo.addEventListener((s: NetInfoState) => {
      setEstado({ conectado: Boolean(s.isConnected), tipo: s.type });
    });
    return () => desuscribir();
  }, []);

  return estado;
}

/** Consulta puntual: ¿se puede llegar a internet? */
export async function hayInternet(): Promise<boolean> {
  const s = await NetInfo.fetch();
  return Boolean(s.isConnected) && s.isInternetReachable !== false;
}
