import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

import { colores, tamaños } from '@/constants/tema';

/**
 * ══════════════════════════════════════════════════════
 * Slider de ajuste accesible (volumen, velocidad, intensidad).
 *
 * - anunciarAlSoltar(): onSlidingComplete → callback (las
 *   pantallas lo conectan al TTS para narrar el valor final,
 *   ajuste no visual real)
 * - Muestra el valor formateado al lado del label
 * ══════════════════════════════════════════════════════
 */

interface Props {
  etiqueta: string;
  valor: number;
  minimo: number;
  maximo: number;
  paso: number;
  onCambiar: (nuevoValor: number) => void;
  /** Se dispara AL SOLTAR el dedo (con el valor final) */
  alSoltar?: (valorFinal: number) => void;
  formatear?: (valor: number) => string;
  deshabilitado?: boolean;
}

export function SliderAjuste({
  etiqueta,
  valor,
  minimo,
  maximo,
  paso,
  onCambiar,
  alSoltar,
  formatear = (v) => String(Math.round(v)),
  deshabilitado = false,
}: Props) {
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.filaEtiqueta}>
        <Text style={estilos.etiqueta}>{etiqueta}</Text>
        <Text style={estilos.valor}>{formatear(valor)}</Text>
      </View>

      <Slider
        style={estilos.slider}
        minimumValue={minimo}
        maximumValue={maximo}
        step={paso}
        value={valor}
        onValueChange={onCambiar}
        onSlidingComplete={alSoltar}
        disabled={deshabilitado}
        minimumTrackTintColor={colores.primario}
        maximumTrackTintColor={colores.superficieClara}
        thumbTintColor={colores.primario}
        accessibilityLabel={etiqueta}
        accessibilityValue={{
          min: minimo,
          max: maximo,
          now: valor,
          text: `${etiqueta}: ${formatear(valor)}`,
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    marginBottom: tamaños.sm,
  },
  filaEtiqueta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tamaños.xs,
  },
  etiqueta: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '600',
  },
  valor: {
    color: colores.primario,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
  },
  slider: { width: '100%', height: 40 },
});