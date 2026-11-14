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

// ─── Sprint 3 ───
import PantallaNavegacion from '@/screens/navegacion/PantallaNavegacion';
import PantallaHistorial from '@/screens/historial/PantallaHistorial';
import PantallaVisionCoach from '@/screens/visioncoach/PantallaVisionCoach';
import PantallaSesionVisionCoach from '@/screens/visioncoach/PantallaSesionVisionCoach';
import PantallaReportarIncidente from '@/screens/incidentes/PantallaReportarIncidente';
import PantallaMisIncidentes from '@/screens/incidentes/PantallaMisIncidentes';
import PantallaSincronizacion from '@/screens/sincronizacion/PantallaSincronizacion';

/**
 * ══════════════════════════════════════════════════════
 * Stack interno de "Más": menú → Perfil (CU04), Accesibilidad
 * (CU03), Contactos (CU05), Alertas, Ayuda (S2) y las pantallas
 * del Sprint 3: Navegación (CU24), Historial (CU23),
 * VisionCoach (CU27–33), Incidentes (CU22) y Sincronización
 * (CU25–26).
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

      <Stack.Screen
        name="Navegacion"
        component={PantallaNavegacion}
        options={{ headerTitle: 'Navegación asistida' }}
      />
      <Stack.Screen
        name="Historial"
        component={PantallaHistorial}
        options={{ headerTitle: 'Historial de actividades' }}
      />
      <Stack.Screen
        name="VisionCoach"
        component={PantallaVisionCoach}
        options={{ headerTitle: 'VisionCoach' }}
      />
      <Stack.Screen
        name="SesionVisionCoach"
        component={PantallaSesionVisionCoach}
        options={{ headerTitle: 'Sesión de entrenamiento' }}
      />
      <Stack.Screen
        name="ReportarIncidente"
        component={PantallaReportarIncidente}
        options={{ headerTitle: 'Reportar incidente' }}
      />
      <Stack.Screen
        name="MisIncidentes"
        component={PantallaMisIncidentes}
        options={{ headerTitle: 'Mis incidentes' }}
      />
      <Stack.Screen
        name="Sincronizacion"
        component={PantallaSincronizacion}
        options={{ headerTitle: 'Sincronización' }}
      />
    </Stack.Navigator>
  );
}
