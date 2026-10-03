import type { NavigatorScreenParams } from '@react-navigation/native';

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
  Camara: undefined;
  Mas: NavigatorScreenParams<MasStackParamList>;
};

// ─── Stack interno de "Más" ───
export type MasStackParamList = {
  MasMenu: undefined;
  Perfil: undefined;
  Accesibilidad: undefined;
  Contactos: undefined;
};