/**
 * ══════════════════════════════════════════════════════
 * Metro — configuración del delta IA LOCAL.
 *
 * Si tu repo YA tiene metro.config.js, solo copia la línea
 * del push de 'bin' (los shards de TF.js deben empaquetarse
 * como assets, no como código).
 * ══════════════════════════════════════════════════════
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);

// Shards del modelo embebido TF.js (assets/binarios)
config.resolver.assetExts.push('bin');
// Mock para react-native-fs (requerido por TensorFlow pero no usado en Expo)
config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-fs': path.resolve(__dirname, 'mocks/react-native-fs.js'),
};
module.exports = config;
