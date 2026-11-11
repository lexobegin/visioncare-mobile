/**
 * ══════════════════════════════════════════════════════
 * Barrel de tipos — contrato único con el backend.
 *
 * S1 preservado (los imports existentes siguen funcionando)
 * + S2: capturas ampliadas, alertas, ayuda, modo continuo.
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