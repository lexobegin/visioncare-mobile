import { createNativeStackNavigator } from '@react-navigation/native-stack';

import PantallaLogin from '@/screens/auth/PantallaLogin';
import PantallaRegistro from '@/screens/auth/PantallaRegistro';
import type { LoginStackParamList } from './NavigationTypes';

/**
 * ══════════════════════════════════════════════════════
 * Stack de autenticación: Login ⇄ Registro.
 *
 * ⚠️ Las pantallas PantallaLogin / PantallaRegistro llegan
 * en la TANDA 6 — este archivo compila desde entonces.
 * (Placeholder incluido abajo para poder verificar Tanda 5.)
 * ══════════════════════════════════════════════════════
 */

const Stack = createNativeStackNavigator<LoginStackParamList>();

export default function LoginStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={PantallaLogin} />
      <Stack.Screen
        name="Registro"
        component={PantallaRegistro}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}