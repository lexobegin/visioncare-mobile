/**
 * ══════════════════════════════════════════════════════
 * Tipos del módulo visioncoach — espejo de modules/visioncoach
 * (CU27–CU33: catálogo, sesiones, progreso, desafíos, insignias).
 * ══════════════════════════════════════════════════════
 */

export interface CategoriaVc {
  id_categoria: number;
  nombre: string;
  descripcion?: string | null;
}

export interface EjercicioVc {
  id_ejercicio: number;
  id_categoria: number;
  categoria_nombre?: string | null;
  nombre: string;
  descripcion: string;
  /** 1..5 */
  dificultad: number;
  puntos_base: number;
  duracion_estimada_segundos?: number | null;
}

/** GET /visioncoach/ejercicios */
export interface EjerciciosVcQuery {
  id_categoria?: number;
  dificultad?: number;
}

/** Resultado individual dentro de una sesión */
export interface ResultadoVc {
  id_resultado: number;
  id_sesion: number;
  id_ejercicio: number;
  respuesta?: string | null;
  correcto: boolean | null;
  puntuacion: number;
  tiempo_segundos?: number | null;
  fecha_resultado: string;
}

/** Sesión de entrenamiento */
export interface SesionVc {
  id_sesion: number;
  id_usuario: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  puntos_obtenidos: number;
  estado: 'INICIADA' | 'COMPLETADA' | 'ABANDONADA';
  resultados?: ResultadoVc[];
  mensaje_voz?: string | null;
}

/** Mi progreso (nivel, puntos, rachas) */
export interface ProgresoVc {
  id_usuario: number;
  nivel: number;
  puntos_totales: number;
  racha_actual: number;
  mejor_racha: number;
  ejercicios_completados: number;
  total_insignias: number;
}

/** BD: ck_desafio_estado */
export type EstadoDesafioVc = 'ASIGNADO' | 'EN_CURSO' | 'COMPLETADO' | 'OMITIDO';

/** Estados que el usuario puede asignar (PATCH /desafios/:id) */
export type EstadoDesafioPayload = 'EN_CURSO' | 'COMPLETADO' | 'OMITIDO';

export interface DesafioVc {
  id_desafio: number;
  id_ejercicio: number;
  ejercicio_nombre?: string | null;
  dificultad_asignada: number;
  motivo_adaptacion?: string | null;
  estado: EstadoDesafioVc;
  fecha_asignacion: string;
  fecha_completado?: string | null;
}

export interface ActualizarDesafioPayload {
  estado: EstadoDesafioPayload;
}

/** Insignia (fecha_obtencion solo en /insignias/mias) */
export interface InsigniaVc {
  id_insignia: number;
  nombre: string;
  descripcion: string;
  condicion?: string | null;
  fecha_obtencion?: string | null;
}

/** POST /visioncoach/sesiones/:id/resultados */
export interface RegistrarResultadoPayload {
  id_ejercicio: number;
  correcto: boolean;
  respuesta?: string;
  tiempo_segundos?: number;
  observaciones?: string;
}

/** Respuesta compuesta de registrar resultado (para TTS) */
export interface ResultadoRegistradoVc {
  resultado: ResultadoVc;
  progreso: ProgresoVc;
  insignias_nuevas?: string[];
  mensaje_voz: string;
}

/** PATCH /visioncoach/sesiones/:id/finalizar */
export interface FinalizarSesionPayload {
  estado_final: 'COMPLETADA' | 'ABANDONADA';
}

/** Respuesta compuesta de finalizar (dispara CU31/CU33) */
export interface SesionFinalizadaVc {
  sesion: SesionVc;
  progreso: ProgresoVc;
  desafio_asignado?: DesafioVc | null;
  insignias_nuevas?: string[];
  mensaje_voz: string;
}
