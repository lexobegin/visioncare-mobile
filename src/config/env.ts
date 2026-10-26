import Constants from 'expo-constants';

/**
 * ══════════════════════════════════════════════════════
 * Acceso tipado a las variables EXPO_PUBLIC_.
 *
 * Soporte dual automático:
 * - CABLE USB (con adb reverse): utiliza localhost vía túnel USB.
 * - WI-FI (Expo Go): detecta automáticamente la IP de la PC
 *   (ej: 192.168.0.x) sin necesidad de editar manualmente el .env.
 * ══════════════════════════════════════════════════════
 */

function resolverUrl(url: string): string {
  if (!url || (!url.includes('localhost') && !url.includes('127.0.0.1'))) {
    return url;
  }

  // Host reportado por Metro Bundler en Expo (ej: "192.168.0.9:8081" o "localhost:8081")
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      ?.manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return url.replace('localhost', hostIp).replace('127.0.0.1', hostIp);
    }
  }

  return url;
}

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const rawIaUrl = process.env.EXPO_PUBLIC_IA_URL ?? 'http://localhost:8000/api/v1';

export const ENV = {
  apiUrl: resolverUrl(rawApiUrl),
  iaUrl: resolverUrl(rawIaUrl),
  appName: process.env.EXPO_PUBLIC_APP_NAME ?? 'VisionCare AI',
} as const;