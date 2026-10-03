import * as SecureStore from 'expo-secure-store';

/**
 * ══════════════════════════════════════════════════════
 * Almacenamiento CIFRADO del token JWT.
 *
 * expo-secure-store → Android Keystore / iOS Keychain:
 * el token no es legible por otras apps ni persiste en
 * texto plano (superior al localStorage de la web).
 * ══════════════════════════════════════════════════════
 */

const CLAVE_TOKEN = 'visioncare.token';

/** Token activo o null si no hay sesión */
export async function obtenerToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

/** Guarda el token tras login/registro exitoso */
export async function guardarToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(CLAVE_TOKEN, token);
  } catch {
    // sin almacenamiento seguro disponible: sesión solo en memoria
  }
}

/** Elimina el token (logout o 401 global) */
export async function eliminarToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLAVE_TOKEN);
  } catch {
    // silencioso
  }
}