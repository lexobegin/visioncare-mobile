import type { NavigatorScreenParams } from '@react-navigation/native';
import type { TipoAnalisis } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Tipado de rutas (React Navigation v7).
 *
 * `Mas: NavigatorScreenParams<MasStackParamList>` habilita
 * la navegación ANIDADA tipada:
 *   navigation.navigate('Mas', { screen: 'Perfil' })
 * ══════════════════════════════════════════════════════
 */

// ─── Stack raíz ───
export type RootStackParamList = {
  Cargando: undefined;
  Auth: undefined; // LoginStack (renombrado: evita "Login > Login")
  App: undefined;  // AppTabs (protegido)
};

// ─── LoginStack ───
export type LoginStackParamList = {
  Login: undefined;
  Registro: undefined;
};

// ─── Bottom Tabs (Sprint 1) ───
export type AppTabsParamList = {
  Inicio: undefined;
  Voz: undefined;
  /** S2 — la voz llega con pre-configuración */
  Camara:
    | {
        tipoAnalisis?: TipoAnalisis;
        activarModoContinuo?: boolean;
        /** S2 — accion_app del comando de voz (ej: LEER_TEXTO) */
        accion?: AccionAnalisisVisual;
      }
    | undefined;

  Mas: NavigatorScreenParams<MasStackParamList>;
};

export type AccionAnalisisVisual =
  | 'RECONOCER_OBJETOS'
  | 'CAPTURAR_ENTORNO'
  | 'ABRIR_CAMARA'
  | 'LEER_TEXTO'
  | 'DESCRIBIR_ENTORNO'
  | 'DETECTAR_OBSTACULOS'
  | 'RECONOCER_SENALES'
  | 'RECONOCER_PRODUCTOS'
  | 'RECONOCER_COLORES'
  | 'RECONOCER_BILLETES';

// ─── Stack interno de "Más" (S1–S2 + Sprint 3) ───
export type MasStackParamList = {
  MasMenu: undefined;
  Perfil: undefined;
  Accesibilidad: undefined;
  Contactos: undefined;
  Alertas: undefined; // T20
  /** T21 — tipo pre-seleccionado por comando de voz */
  Ayuda: { tipoInicial?: 'AYUDA' | 'EMERGENCIA' } | undefined;
  MisSolicitudes: undefined;

  // ─── Sprint 3 ───
  /** CU24 — navegación asistida con traza GPS */
  Navegacion: undefined;
  /** CU23 — historial consolidado de actividades */
  Historial: undefined;
  /** CU27–CU33 — hub de entrenamiento VisionCoach */
  VisionCoach: undefined;
  /** CU28–CU30 — sesión guiada por voz (se abre desde el hub) */
  SesionVisionCoach: undefined;
  /** CU22 — reportar incidente con GPS + evidencias */
  ReportarIncidente: undefined;
  /** CU22 — seguimiento de mis incidentes */
  MisIncidentes: undefined;
  /** CU25–CU26 — cola offline + cache descargada */
  Sincronizacion: undefined;
};
