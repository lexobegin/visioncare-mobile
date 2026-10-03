import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { colores, tamaños } from '@/constants/tema';
import PantallaInicio from '@/screens/inicio/PantallaInicio';
import PantallaVoz from '@/screens/voz/PantallaVoz';
import PantallaCamara from '@/screens/camara/PantallaCamara';
import MasStack from './MasStack';
import type { AppTabsParamList } from './NavigationTypes';

/**
 * ══════════════════════════════════════════════════════
 * Bottom Tabs (Sprint 1) — 4 secciones principales:
 *
 *   🏠 Inicio  → hub con accesos + estado
 *   🎤 Voz     → comandos de voz (CU06)
 *   📷 Cámara  → captura + reconocimiento IA (CU07-08)
 *   ⚙️ Más     → perfil, accesibilidad, contactos
 *
 * Accesibilidad: tab bar de 64dp, iconos grandes con
 * accessibilityLabel, colores de activo/inactivo claros.
 * ══════════════════════════════════════════════════════
 */

const Tabs = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colores.superficie,
          borderTopColor: colores.borde,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSutil,
        tabBarLabelStyle: {
          fontSize: tamaños.fuenteXS,
          fontWeight: '600',
        },
        // Zona táctil accesible
        tabBarItemStyle: { height: 52 },
      }}
    >
      <Tabs.Screen
        name="Inicio"
        component={PantallaInicio}
        options={{
          tabBarLabel: 'Inicio',
          tabBarAccessibilityLabel: 'Sección Inicio',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.8, color }}>🏠</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="Voz"
        component={PantallaVoz}
        options={{
          tabBarLabel: 'Voz',
          tabBarAccessibilityLabel: 'Sección comandos de voz',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.8, color }}>🎤</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="Camara"
        component={PantallaCamara}
        options={{
          tabBarLabel: 'Cámara',
          tabBarAccessibilityLabel: 'Sección cámara y reconocimiento',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.8, color }}>📷</Text>
          ),
        }}
      />

      <Tabs.Screen
        name="Mas"
        component={MasStack}
        options={{
          tabBarLabel: 'Más',
          tabBarAccessibilityLabel: 'Más opciones: perfil, accesibilidad y contactos',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size * 0.8, color }}>⚙️</Text>
          ),
        }}
      />
    </Tabs.Navigator>
  );
}