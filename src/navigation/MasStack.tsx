import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colores, tamaños } from '@/constants/tema';
import PantallaMasMenu from '@/screens/inicio/PantallaMasMenu';
import PantallaPerfil from '@/screens/perfil/PantallaPerfil';
import PantallaAccesibilidad from '@/screens/accesibilidad/PantallaAccesibilidad';
import PantallaContactos from '@/screens/contactos/PantallaContactos';
import type { MasStackParamList } from './NavigationTypes';

import PantallaAlertas from '@/screens/alertas/PantallaAlertas';

import PantallaAyuda from '@/screens/ayuda/PantallaAyuda';
import PantallaMisSolicitudes from '@/screens/ayuda/PantallaMisSolicitudes';

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
        name="Alertas"
        component={PantallaAlertas}
        options={{ headerTitle: 'Alertas' }}
      />
      <Stack.Screen
        name="Contactos"
        component={PantallaContactos}
        options={{ headerTitle: 'Contactos de confianza' }}
      />
      <Stack.Screen
        name="Ayuda"
        component={PantallaAyuda}
        options={{ headerTitle: 'Pedir ayuda' }}
      />
      <Stack.Screen
        name="MisSolicitudes"
        component={PantallaMisSolicitudes}
        options={{ headerTitle: 'Mis solicitudes' }}
      />
    </Stack.Navigator>
  );
}
