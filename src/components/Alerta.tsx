import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colores, tamaños } from '@/constants/tema';

/**
 * ══════════════════════════════════════════════════════
 * Banner de mensaje accesible.
 *
 * - accessibilityLiveRegion="polite": TalkBack/VoiceOver
 *   anuncian el mensaje al aparecer (complementa el TTS)
 * - Dismissible opcional (✕)
 * ══════════════════════════════════════════════════════
 */

type Variante = 'error' | 'exito' | 'info' | 'advertencia';

const ESTILOS: Record<Variante, { fondo: string; borde: string; texto: string; icono: string }> = {
  error: { fondo: colores.peligroFondo, borde: colores.peligro, texto: '#fecaca', icono: '⛔' },
  exito: { fondo: colores.exitoFondo, borde: colores.exito, texto: '#a7f3d0', icono: '✅' },
  info: { fondo: '#0c4a6e', borde: colores.info, texto: '#bae6fd', icono: 'ℹ️' },
  advertencia: { fondo: colores.advertenciaFondo, borde: colores.advertencia, texto: '#fde68a', icono: '⚠️' },
};

interface Props {
  variante?: Variante;
  mensaje: string;
  onCerrar?: () => void;
}

export function Alerta({ variante = 'info', mensaje, onCerrar }: Props) {
  const estilo = ESTILOS[variante];

  return (
    <View
      style={[estilos.contenedor, { backgroundColor: estilo.fondo, borderColor: estilo.borde }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text style={estilos.icono} aria-hidden>
        {estilo.icono}
      </Text>
      <Text style={[estilos.mensaje, { color: estilo.texto }]}>{mensaje}</Text>

      {onCerrar && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar mensaje"
          onPress={onCerrar}
          hitSlop={8}
          style={estilos.cerrar}
        >
          <Text style={[estilos.iconoCerrar, { color: estilo.texto }]}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: tamaños.radioMD,
    borderWidth: 1,
    padding: tamaños.md,
    width: '100%',
    marginBottom: tamaños.md,
    gap: tamaños.sm,
  },
  icono: { fontSize: 18, marginTop: 1 },
  mensaje: { flex: 1, fontSize: tamaños.fuenteSM, lineHeight: 20 },
  cerrar: { padding: 2 },
  iconoCerrar: { fontSize: 16, fontWeight: '700' },
});