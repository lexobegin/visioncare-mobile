import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colores, tamaños } from '@/constants/tema';

/**
 * ══════════════════════════════════════════════════════
 * Botón accesible (56dp, 3 variantes, estado de carga).
 *
 * - cargando: deshabilita + ActivityIndicator inline +
 *   accessibilityState busy (anunciado por lectores)
 * ══════════════════════════════════════════════════════
 */

type Variante = 'primario' | 'peligro' | 'secundario';

interface Props {
  etiqueta: string;
  onPress: () => void;
  cargando?: boolean;
  deshabilitado?: boolean;
  variante?: Variante;
}

const FONDO: Record<Variante, string> = {
  primario: colores.primario,
  peligro: colores.peligro,
  secundario: colores.superficieClara,
};

const TEXTO: Record<Variante, string> = {
  primario: colores.primarioTexto,
  peligro: '#ffffff',
  secundario: colores.texto,
};

export function Boton({
  etiqueta,
  onPress,
  cargando = false,
  deshabilitado = false,
  variante = 'primario',
}: Props) {
  const bloqueado = deshabilitado || cargando;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ busy: cargando, disabled: bloqueado }}
      onPress={onPress}
      disabled={bloqueado}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: FONDO[variante] },
        bloqueado && { opacity: 0.55 },
        pressed && !bloqueado && { opacity: 0.8 },
      ]}
    >
      {cargando && (
        <ActivityIndicator
          size="small"
          color={TEXTO[variante]}
          style={estilos.spinner}
        />
      )}
      <Text style={[estilos.texto, { color: TEXTO[variante] }]}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    height: tamaños.botonAltura,
    borderRadius: tamaños.radioMD,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: tamaños.lg,
    width: '100%',
  },
  spinner: { marginRight: tamaños.sm },
  texto: {
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
  },
});