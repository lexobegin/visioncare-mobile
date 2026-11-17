/**
 * ══════════════════════════════════════════════════════
 * Metro — configuración del delta IA LOCAL.
 *
 * Si tu repo YA tiene metro.config.js, solo copia la línea
 * del push de 'bin' (los shards de TF.js deben empaquetarse
 * como assets, no como código).
 *
 * Delta N3 — shim de react-native-fs:
 * @tensorflow/tfjs-react-native referencia 'react-native-fs' de
 * forma estática en bundle_resource_io.js. Nosotros NO usamos
 * bundleResourceIO (cargamos el modelo con expo-asset +
 * expo-file-system), pero Metro analiza el require igual y falla
 * el bundle. Lo redirigimos a un shim vacío para que el bundle
 * pase en Expo Go.
 * ══════════════════════════════════════════════════════
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Shards del modelo embebido TF.js (assets/binarios)
config.resolver.assetExts.push('bin');

// Shim de react-native-fs → objeto vacío (nunca se ejecuta en runtime)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-fs': path.resolve(
    __dirname,
    'src/ia-local/shims/react-native-fs.js',
  ),
};

module.exports = config;