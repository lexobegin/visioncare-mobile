import { StyleSheet, Switch, Text, View } from 'react-native';

import { colores, tamaños } from '@/constants/tema';

/**
 * ══════════════════════════════════════════════════════
 * Interruptor accesible (Switch nativo + label grande).
 *
 * - Toda la fila es accesible: el lector lee label + estado
 * - Switch nativo = manejo táctil/teclado gratuito
 * ══════════════════════════════════════════════════════
 */

interface Props {
  etiqueta: string;
  descripcion?: string;
  valor: boolean;
  onCambiar: (nuevoValor: boolean) => void;
  deshabilitado?: boolean;
}

export function Toggle({
  etiqueta,
  descripcion,
  valor,
  onCambiar,
  deshabilitado = false,
}: Props) {
  return (
    <View
      style={estilos.fila}
      accessibilityLabel={`${etiqueta}: ${valor ? 'activado' : 'desactivado'}`}
    >
      <View style={estilos.textos}>
        <Text style={estilos.etiqueta}>{etiqueta}</Text>
        {descripcion && <Text style={estilos.descripcion}>{descripcion}</Text>}
      </View>

      <Switch
        value={valor}
        onValueChange={onCambiar}
        disabled={deshabilitado}
        trackColor={{ false: colores.superficieClara, true: colores.primario }}
        thumbColor={valor ? '#ffffff' : colores.bordeFuerte}
        accessibilityLabel={etiqueta}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    marginBottom: tamaños.sm,
    minHeight: tamaños.touchMin,
  },
  textos: { flex: 1, paddingRight: tamaños.sm },
  etiqueta: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '600',
  },
  descripcion: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
  },
});