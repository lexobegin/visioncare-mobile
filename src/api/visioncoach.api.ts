/**
 * ══════════════════════════════════════════════════════
 * API de VisionCoach — espejo de modules/visioncoach.
 * CU27–CU33 (móvil): catálogo, sesiones guiadas, progreso,
 * desafíos adaptativos e insignias.
 * ══════════════════════════════════════════════════════
 */

import type {
  ActualizarDesafioPayload,
  CategoriaVc,
  DesafioVc,
  EjercicioVc,
  EjerciciosVcQuery,
  FinalizarSesionPayload,
  InsigniaVc,
  ProgresoVc,
  RegistrarResultadoPayload,
  ResultadoRegistradoVc,
  SesionFinalizadaVc,
  SesionVc,
} from '@/types';

import { api } from './client';

// ═══════════════════ CATÁLOGO (CU27) ═══════════════════

/** Categorías activas */
export async function listarCategoriasVc(): Promise<CategoriaVc[]> {
  const { data } = await api.get<CategoriaVc[]>('/visioncoach/categorias');
  return data;
}

/** Catálogo filtrable (array plano, sin paginar) */
export async function listarEjerciciosVc(
  query: EjerciciosVcQuery = {},
): Promise<EjercicioVc[]> {
  const { data } = await api.get<EjercicioVc[]>('/visioncoach/ejercicios', {
    params: query,
  });
  return data;
}

/** Detalle de un ejercicio */
export async function obtenerEjercicioVc(
  idEjercicio: number,
): Promise<EjercicioVc> {
  const { data } = await api.get<EjercicioVc>(
    `/visioncoach/ejercicios/${idEjercicio}`,
  );
  return data;
}

// ═══════════════════ SESIONES (CU28–CU30) ═══════════════════

/** CU28 — Iniciar sesión de entrenamiento */
export async function iniciarSesionVc(): Promise<SesionVc> {
  const { data } = await api.post<SesionVc>('/visioncoach/sesiones', {});
  return data;
}

/**
 * CU29 — Registrar resultado de un ejercicio.
 * La puntuación la calcula el servidor (anti-trampa).
 */
export async function registrarResultadoVc(
  idSesion: number,
  payload: RegistrarResultadoPayload,
): Promise<ResultadoRegistradoVc> {
  const { data } = await api.post<ResultadoRegistradoVc>(
    `/visioncoach/sesiones/${idSesion}/resultados`,
    payload,
  );
  return data;
}

/**
 * CU30 — Finalizar sesión (COMPLETADA dispara adaptación
 * de dificultad CU31 y revisión de insignias CU33).
 */
export async function finalizarSesionVc(
  idSesion: number,
  payload: FinalizarSesionPayload,
): Promise<SesionFinalizadaVc> {
  const { data } = await api.patch<SesionFinalizadaVc>(
    `/visioncoach/sesiones/${idSesion}/finalizar`,
    payload,
  );
  return data;
}

// ═══════════════════ PROGRESO Y GAMIFICACIÓN (CU30–CU33) ═══════════════════

/** CU30 — Mi progreso (nivel, puntos, rachas) */
export async function obtenerProgresoVc(): Promise<ProgresoVc> {
  const { data } = await api.get<ProgresoVc>('/visioncoach/progreso');
  return data;
}

/** CU31 — Mis desafíos adaptativos (últimos 20) */
export async function listarDesafiosVc(estado?: string): Promise<DesafioVc[]> {
  const { data } = await api.get<DesafioVc[]>('/visioncoach/desafios', {
    params: estado ? { estado } : undefined,
  });
  return data;
}

/** CU31 — Actualizar estado de un desafío propio */
export async function actualizarDesafioVc(
  idDesafio: number,
  payload: ActualizarDesafioPayload,
): Promise<DesafioVc> {
  const { data } = await api.patch<DesafioVc>(
    `/visioncoach/desafios/${idDesafio}`,
    payload,
  );
  return data;
}

/** CU33 — Catálogo completo de insignias */
export async function listarInsigniasVc(): Promise<InsigniaVc[]> {
  const { data } = await api.get<InsigniaVc[]>('/visioncoach/insignias');
  return data;
}

/** CU33 — Mis insignias (con fecha de obtención) */
export async function listarMisInsigniasVc(): Promise<InsigniaVc[]> {
  const { data } = await api.get<InsigniaVc[]>('/visioncoach/insignias/mias');
  return data;
}
