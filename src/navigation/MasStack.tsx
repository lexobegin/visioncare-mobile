import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colores, tamaños } from '@/constants/tema';
import PantallaMasMenu from '@/screens/inicio/PantallaMasMenu';
import PantallaPerfil from '@/screens/perfil/PantallaPerfil';
import PantallaAccesibilidad from '@/screens/accesibilidad/PantallaAccesibilidad';
import PantallaContactos from '@/screens/contactos/PantallaContactos';
import type { MasStackParamList } from './NavigationTypes';

/**
 * ══════════════════════════════════════════════════════
 * Stack interno de "Más": menú → Perfil (CU04),
 * Accesibilidad (CU03), Contactos (CU05).
 *
 * ⚠️ Las pantallas llegan en las Tandas 7-8 — placeholder
 * temporal (PantallaTemporal) para verificar la navegación.
 * ══════════════════════════════════════════════════════
 */

const Stack = createNativeStackNavigator<MasStackParamList>();

export default function MasStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colores.fondo },
        headerTintColor: colores.texto,
        headerTitleStyle: { fontSize: tamaños.fuenteLG, fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="MasMenu"
        component={PantallaMasMenu}
        options={{ headerTitle: 'Más opciones' }}
      />
      <Stack.Screen
        name="Perfil"
        component={PantallaPerfil}
        options={{ headerTitle: 'Mi perfil' }}
      />
      <Stack.Screen
        name="Accesibilidad"
        component={PantallaAccesibilidad}
        options={{ headerTitle: 'Accesibilidad' }}
      />
      <Stack.Screen
        name="Contactos"
        component={PantallaContactos}
        options={{ headerTitle: 'Contactos de confianza' }}
      />
    </Stack.Navigator>
  );
}
