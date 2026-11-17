/**
 * ══════════════════════════════════════════════════════
 * Declaraciones de módulos "sin tipos" usados por ia-local.
 *
 * - *.bin: metro los registra como assets (require numérico)
 *   cuando assetExts incluye 'bin' (ver metro.config.js).
 * - base64-js: librería mínima para decodificar el base64
 *   que devuelve expo-file-system (no incluye sus propios
 *   tipos, los declaramos aquí).
 * ══════════════════════════════════════════════════════
 */

declare module '*.bin' {
  const asset: number;
  export default asset;
}

/**
 * model.json del modelo embebido (contenido dinámico):
 * resuelto por declaración ambiente para no depender de
 * resolveJsonModule en ningún tsconfig.
 */
declare module '*.json' {
  const contenido: { [clave: string]: any };
  export default contenido;
}

declare module 'base64-js' {
  export function toByteArray(base64: string): Uint8Array;
  export function fromByteArray(bytes: Uint8Array): string;
}
