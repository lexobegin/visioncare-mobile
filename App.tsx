import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/context/AuthContext';
import RootNavigator from '@/navigation/RootNavigator';

/**
 * ══════════════════════════════════════════════════════
 * Raíz de VisionCare AI móvil — estructura definitiva:
 *
 *   AuthProvider (sesión + preferencias accesibilidad)
 *     └── RootNavigator (Stack → LoginStack | AppTabs)
 *
 * ══════════════════════════════════════════════════════
 */
export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  );
}