import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colores, tamaños } from '@/constants/tema';

/**
 * ══════════════════════════════════════════════════════
 * Pantalla de espera reutilizable (splash de sesión,
 * cargas de features). Anunciada por TTS si se pasa texto.
 * ══════════════════════════════════════════════════════
 */

interface Props {
  mensaje?: string;
}

export function PantallaCargando({ mensaje }: Props) {
  return (
    <View
      style={estilos.contenedor}
      accessibilityRole="progressbar"
      accessibilityLabel={mensaje ?? 'Cargando'}
    >
      <Text style={estilos.icono}>👁️</Text>
      <ActivityIndicator size="large" color={colores.primario} />
      {mensaje && <Text style={estilos.mensaje}>{mensaje}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tamaños.md,
  },
  icono: { fontSize: 56, marginBottom: tamaños.xs },
  mensaje: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
  },
});