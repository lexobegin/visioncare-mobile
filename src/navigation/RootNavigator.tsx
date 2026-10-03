import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { PantallaCargando } from '@/components/PantallaCargando';
import LoginStack from './LoginStack';
import AppTabs from './AppTabs';
import type { RootStackParamList } from './NavigationTypes';

/**
 * ══════════════════════════════════════════════════════
 * Stack RAÍZ — decide la rama según la sesión:
 *
 *   cargando     → PantallaCargando (splash de hidratación)
 *   anónimo      → LoginStack (CU01, CU02)
 *   autenticado  → AppTabs (protegido: inicio, voz, cámara…)
 *
 * La transición es automática: al cambiar `autenticado`
 * (login/logout/401 global), el stack se reconstruye.
 * ══════════════════════════════════════════════════════
 */

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { cargando, autenticado } = useAuth();
  const { anunciar } = useTTS();

  // Anuncia el estado de sesión al cambiar (no al primer render
  // para no encimar el splash de arranque).
  // Implementación simple: cada cambio de rama clave lo narra.

  return (
    <NavigationContainer
      onStateChange={(state) => {
        // Feedback de voz por cambio de ruta principal
        const ruta = state?.routes[state.index]?.name;
        const anuncios: Record<string, string> = {
          Auth: 'Pantalla de inicio de sesión.',
          App: 'Aplicación principal.',
        };
        const anuncio = ruta ? anuncios[ruta] : undefined;
        if (anuncio) anunciar(anuncio);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {cargando ? (
          // ─── Splash de hidratación ───
          <Stack.Screen name="Cargando">
            {() => (
              <PantallaCargando mensaje="Verificando sesión…" />
            )}
          </Stack.Screen>
        ) : autenticado ? (
          // ─── App protegida ───
          <Stack.Screen name="App" component={AppTabs} />
        ) : (
          // ─── Autenticación ───
          <Stack.Screen name="Auth" component={LoginStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}