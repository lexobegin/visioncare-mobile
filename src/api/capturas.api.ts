/**
 * ══════════════════════════════════════════════════════
 * API de capturas — SPRINT 2:
 *
 *   registrarCaptura()   → POST /capturas (persistente,
 *                          7 tipos de análisis — CU07-CU16)
 *   analizarFotograma()  → POST /capturas/analizar (EFÍMERO,
 *                          Modo Continuo — CU09/HU17)
 *   listarMisCapturas()  → GET /capturas (S1)
 * ══════════════════════════════════════════════════════
 */

// import { Platform } from 'react-native';

import type {
  AnalisisContinuoPayload,
  AnalisisContinuoResponse,
  CapturaResponse,
  RespuestaPaginada,
  TipoAnalisis,
} from '@/types';

import { api } from './client';

/** Formato especial de archivo para multipart en React Native */
function archivoDesdeUri(
  uri: string,
  mimeType: string,
  nombre: string,
): Blob {
  return {
    uri,
    name: nombre,
    type: mimeType,
  } as unknown as Blob;
}

/**
 * CU07 + CU08–CU16 — Registrar captura (persistente) y
 * ejecutar el análisis del tipo indicado.
 */
export async function registrarCaptura(params: {
  uri: string;
  mimeType?: string;
  tipoAnalisis?: TipoAnalisis;
  reconocer?: boolean;
  accion_app?: string;
  latitud?: number;
  longitud?: number;
  precisionGps?: number;
  origen?: 'CAMARA' | 'GALERIA';
}): Promise<CapturaResponse> {
  const {
    uri,
    mimeType = 'image/jpeg',
    tipoAnalisis = 'OBJETOS',
    reconocer = true,
    accion_app,
    latitud,
    longitud,
    precisionGps,
    origen = 'CAMARA',
  } = params;

  const formData = new FormData();

  formData.append(
    'imagen',
    archivoDesdeUri(uri, mimeType, `captura-${Date.now()}.jpg`),
  );
  formData.append('tipo_analisis', tipoAnalisis);

  formData.append('reconocer', String(reconocer));
  formData.append('origen', origen);
  if (accion_app) formData.append('accion_app', accion_app);
  if (latitud !== undefined) formData.append('latitud', String(latitud));
  if (longitud !== undefined) formData.append('longitud', String(longitud));
  if (precisionGps !== undefined) {
    formData.append('precision_gps', String(precisionGps));
  }

  const { data } = await api.post<CapturaResponse>('/capturas', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000, // OCR/billetes pueden tardar en CPU
  });
  return data;
}

/**
 * CU09/HU17 — MODO CONTINUO: análisis EFÍMERO de un fotograma.
 *
 * No persiste la imagen ni la captura (salvo ALERTA de riesgo:
 * solo detección+alerta, sin imagen). El backend decide el
 * ritmo (meta.siguiente_analisis_ms).
 *
 * @param params.ancho/alto dimensiones del fotograma (takePictureAsync
 *        las devuelve — el backend las usa para % de bbox en HU17)
 */
export async function analizarFotograma(
  params: AnalisisContinuoPayload,
): Promise<AnalisisContinuoResponse> {
  const {
    uri,
    ancho,
    alto,
    bajoConsumo,
    tipoAnalisis,
    latitud,
    longitud,
    precisionGps,
  } = params;

  const formData = new FormData();
  formData.append(
    'imagen',
    archivoDesdeUri(uri, 'image/jpeg', `fotograma-${Date.now()}.jpg`),
  );
  formData.append('ancho', String(ancho));
  formData.append('alto', String(alto));
  formData.append('bajo_consumo', String(bajoConsumo));
  if (tipoAnalisis) formData.append('tipo_analisis', tipoAnalisis);
  if (latitud !== undefined) formData.append('latitud', String(latitud));
  if (longitud !== undefined) formData.append('longitud', String(longitud));
  if (precisionGps !== undefined) {
    formData.append('precision_gps', String(precisionGps));
  }

  const { data } = await api.post<AnalisisContinuoResponse>(
    '/capturas/analizar',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    },
  );
  return data;
}

/** Mis capturas (paginado) — S1 */
export async function listarMisCapturas(
  page = 1,
  limit = 10,
): Promise<RespuestaPaginada<CapturaResponse>> {
  const { data } = await api.get<RespuestaPaginada<CapturaResponse>>(
    '/capturas',
    { params: { page, limit } },
  );
  return data;
}