/**
 * ══════════════════════════════════════════════════════
 * API de sincronización — espejo de modules/sincronizacion.
 * CU25 (subir lote offline) y CU26 (bajar cache) + bitácora.
 * ══════════════════════════════════════════════════════
 */

import type {
  BajarPayloadSync,
  BajarResultadoSync,
  CambioSync,
  RespuestaPaginada,
  SubirResultadoSync,
  SincronizacionBitacora,
} from '@/types';

import { api } from './client';

/** CU25 — Subir lote de cambios offline (máx 100, idempotente) */
export async function subirCambiosSync(
  dispositivoId: string,
  cambios: CambioSync[],
): Promise<SubirResultadoSync> {
  const { data } = await api.post<SubirResultadoSync>(
    '/sincronizacion/subir',
    {
      dispositivo_id: dispositivoId,
      cambios,
    },
    { timeout: 60_000 },
  );
  return data;
}

/** CU26 — Bajar datos propios desde la última sincronización */
export async function bajarDatosSync(
  payload: BajarPayloadSync,
): Promise<BajarResultadoSync> {
  const { data } = await api.post<BajarResultadoSync>(
    '/sincronizacion/bajar',
    payload,
    { timeout: 60_000 },
  );
  return data;
}

/** Bitácora de mis sincronizaciones (paginada) */
export async function listarBitacoraSync(
  page = 1,
  limit = 10,
): Promise<RespuestaPaginada<SincronizacionBitacora>> {
  const { data } = await api.get<RespuestaPaginada<SincronizacionBitacora>>(
    '/sincronizacion',
    { params: { page, limit } },
  );
  return data;
}
