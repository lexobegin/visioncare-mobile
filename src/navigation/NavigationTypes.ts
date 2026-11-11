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
    | { tipoAnalisis?: TipoAnalisis; activarModoContinuo?: boolean }
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

// ─── Stack interno de "Más" ───
export type MasStackParamList = {
  MasMenu: undefined;
  Perfil: undefined;
  Accesibilidad: undefined;
  Contactos: undefined;
  Alertas: undefined; // T20
  /** T21 — tipo pre-seleccionado por comando de voz */
  Ayuda: { tipoInicial?: 'AYUDA' | 'EMERGENCIA' } | undefined;
  MisSolicitudes: undefined;
};