/**
 * ══════════════════════════════════════════════════════
 * Módulo IA LOCAL — API pública.
 * ══════════════════════════════════════════════════════
 */

export { useConexion, hayInternet } from './conectividad';
export {
  cargarModeloLocal,
  infoModeloLocal,
  predecirImagenLocal,
  prepararTensorflow,
} from './modelo-local.servicio';
export {
  cargarModeloCalle,
  construirAnuncioCalle,
  detectarCalle,
  distanciaAproximada,
  resumenModeloCalle,
} from './calle-local.servicio';
export type {
  CategoriaCalle,
  DeteccionCalle,
  OpcionesCalle,
} from './calle-local.servicio';
export { analizarConCascada } from './cascada-ia.servicio';
export type { AnalizadorServidor } from './cascada-ia.servicio';
export type {
  EstadoRed,
  MotorIa,
  MotivoCascada,
  ResultadoCascada,
  ResultadoInferencia,
} from './tipos';
