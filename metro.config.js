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

const config = getDefaultConfig(__dirname);

// Shards del modelo embebido TF.js (assets/binarios)
config.resolver.assetExts.push('bin');

module.exports = config;
