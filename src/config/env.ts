/**
 * ══════════════════════════════════════════════════════
 * Acceso tipado a las variables EXPO_PUBLIC_.
 *
 * Se leen en BUILD-TIME (Expo las inyecta al bundle) — si
 * cambias el .env, reinicia el servidor de desarrollo.
 * ══════════════════════════════════════════════════════
 */

export const ENV = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  iaUrl: process.env.EXPO_PUBLIC_IA_URL ?? 'http://localhost:8000/api/v1',
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'VisionCare AI',
} as const;