// Shim vacío: bundleResourceIO de tfjs-react-native referencia react-native-fs,
// pero nosotros usamos un cargador personalizado basado en expo-asset + expo-file-system,
// por lo que redirigimos esta dependencia para evitar errores de empaquetado en Expo Go.
module.exports = {};