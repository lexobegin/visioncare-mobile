import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { PantallaCargando } from '@/components/PantallaCargando';
import { EscudoTactilGlobal } from '@/components/EscudoTactil';
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
 *
 * Sprint 3: <EscudoTactilGlobal/> se monta una única vez
 * encima de TODO el árbol (tabs incluidas) — activa el
 * keep-awake y el bloqueo táctil mientras el Modo Continuo
 * esté activo (uso en pechera: toques fantasma).
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
      <View style={{ flex: 1 }}>
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

        {/* Escudo del Modo Continuo (pechera) — cubre toda la app */}
        {autenticado && !cargando && <EscudoTactilGlobal />}
      </View>
    </NavigationContainer>
  );
}
