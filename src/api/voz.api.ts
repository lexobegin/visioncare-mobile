// ══════════ visioncare-mobile/src/api/voz.api.ts ══════════

import type {
  ComandoVozResponse,
  InterpretarComandoPayload,
} from '@/types';
import { api } from './client';

/** CU06 — Interpretar comando de voz (texto STT) y obtener acción */
export async function interpretarComando(
  payload: InterpretarComandoPayload,
): Promise<ComandoVozResponse> {
  const { data } = await api.post<ComandoVozResponse>(
    '/voz/interpretar',
    payload,
  );
  return data;
}