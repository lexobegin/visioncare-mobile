/**
 * ══════════════════════════════════════════════════════
 * Barrel de tipos — contrato único con el backend.
 *
 * S1 preservado (los imports existentes siguen funcionando)
 * + S2: capturas ampliadas, alertas, ayuda, modo continuo.
 * + S3: navegación, incidentes, visioncoach, historial, sync.
 * ══════════════════════════════════════════════════════
 */

// ─── Comunes ───
export type {
  MetaPaginacion,
  RespuestaPaginada,
  ConsultaPaginada,
  ApiErrorBody,
} from './common';
export { mensajeDeError } from './common';

// ─── Usuarios / auth ───
export type {
  Rol,
  EstadoUsuario,
  UsuarioAuth,
  TokenResponse,
  LoginPayload,
  RegistroPayload,
  Perfil,
  Usuario,
  ActualizarPerfilPayload,
} from './usuarios';

// ─── Accesibilidad ───
export type {
  PreferenciasAccesibilidad,
  ActualizarPreferenciasPayload,
} from './accesibilidad';

// ─── Contactos ───
export type {
  EstadoContacto,
  Contacto,
  ContactoQuery,
  CrearContactoPayload,
  ActualizarContactoPayload,
} from './contactos';

// ─── Capturas / análisis (S2) ───
export type {
  TipoAnalisis,
  DeteccionResponse,
  ResultadoOcr,
  ItemSenal,
  ItemProducto,
  ResultadoColores,
  EstimacionAutenticidad,
  ResultadoBillete,
  ResultadoDescripcion,
  CapturaResponse,
  NivelNovedad,
  AlertaEmitida,
  AnalisisContinuoPayload,
  AnalisisContinuoResponse,
} from './capturas';
export { TIPOS_ANALISIS, INFO_TIPO_ANALISIS } from './capturas';

// ─── Alertas (S2) ───
export type {
  NivelAlerta,
  CanalAlerta,
  Alerta,
  AlertaQuery,
  ResumenAlertas,
} from './alertas';

// ─── Ayuda (S2) ───
export type {
  TipoSolicitud,
  EstadoSolicitud,
  CrearSolicitudPayload,
  DestinatarioResponse,
  SolicitudAyuda,
  SolicitudAyudaQuery,
} from './ayuda';

// ─── Voz ───
export type {
  InterpretarComandoPayload,
  ComandoVozResponse,
} from './voz';

// ─── Navegación (S3, CU24) ───
export type {
  ModoNavegacion,
  EstadoNavegacion,
  EstadoFinalNavegacion,
  PuntoNavegacion,
  Navegacion,
  CrearNavegacionPayload,
  AgregarPuntoPayload,
  FinalizarNavegacionPayload,
  PuntoNavegacionOfflinePayload,
  NavegacionOfflinePayload,
} from './navegacion';

// ─── Incidentes (S3, CU22) ───
export type {
  EstadoIncidente,
  SeveridadIncidente,
  TipoArchivoEvidencia,
  EvidenciaIncidente,
  EvidenciaLocal,
  Incidente,
  ActualizarEstadoIncidentePayload,
  IncidenteQuery,
} from './incidentes';
export { TIPOS_INCIDENTE } from './incidentes';

// ─── VisionCoach (S3, CU27–CU33) ───
export type {
  CategoriaVc,
  EjercicioVc,
  EjerciciosVcQuery,
  ResultadoVc,
  SesionVc,
  ProgresoVc,
  EstadoDesafioVc,
  EstadoDesafioPayload,
  DesafioVc,
  ActualizarDesafioPayload,
  InsigniaVc,
  RegistrarResultadoPayload,
  ResultadoRegistradoVc,
  FinalizarSesionPayload,
  SesionFinalizadaVc,
} from './visioncoach';

// ─── Historial (S3, CU23) ───
export type {
  FuenteActividad,
  Actividad,
  HistorialQuery,
  ResumenActividad,
} from './historial';

// ─── Sincronización (S3, CU25–CU26) ───
export type {
  EntidadSync,
  CambioSync,
  CambioResultadoSync,
  SubirResultadoSync,
  BajarPayloadSync,
  PuntoOfflineSync,
  NavegacionOfflineSync,
  HistorialOfflineSync,
  BajarResultadoSync,
  SincronizacionBitacora,
} from './sincronizacion';
