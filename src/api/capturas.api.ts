// ══════════ visioncare-mobile/src/api/capturas.api.ts ══════════

import { Platform } from 'react-native';

import type { CapturaResponse, RespuestaPaginada } from '@/types';
import { api } from './client';

/**
 * CU07 + CU08 — Registrar captura y reconocer objetos con IA.
 *
 * El backend espera multipart/form-data con el campo "imagen".
 * En React Native se envía el URI local de la foto en el
 * formato especial { uri, name, type } que axios + RN
 * convierten automáticamente en archivo multipart.
 */
export async function registrarCaptura(params: {
  uri: string;
  mimeType?: string;
  reconocer?: boolean;
  latitud?: number;
  longitud?: number;
  origen?: 'CAMARA' | 'GALERIA';
}): Promise<CapturaResponse> {
  const {
    uri,
    mimeType = 'image/jpeg',
    reconocer = true,
    latitud,
    longitud,
    origen = 'CAMARA',
  } = params;

  const formData = new FormData();
  // RN: el objeto con uri/name/type es el "archivo"
  formData.append('imagen', {
    // iOS corta el ?... del URI de la galería (ph://)
    uri: Platform.OS === 'ios' && uri.startsWith('file://') ? uri : uri,
    name: `captura-${Date.now()}.jpg`,
    type: mimeType,
  } as unknown as Blob);
  formData.append('reconocer', String(reconocer));
  formData.append('origen', origen);
  if (latitud !== undefined) formData.append('latitud', String(latitud));
  if (longitud !== undefined) formData.append('longitud', String(longitud));

  const { data } = await api.post<CapturaResponse>('/capturas', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000, // la inferencia YOLO puede tardar en CPU
  });
  return data;
}

/** Mis capturas (paginado) */
export async function listarMisCapturas(page = 1, limit = 10): Promise<RespuestaPaginada<CapturaResponse>> {
  const { data } = await api.get<RespuestaPaginada<CapturaResponse>>(
    '/capturas',
    { params: { page, limit } },
  );
  return data;
}