import { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colores, estilosComunes, tamaños } from '@/constants/tema';

/**
 * ══════════════════════════════════════════════════════
 * Campo de texto accesible (label + error + hint).
 *
 * - accessibilityLabel con la etiqueta (TalkBack/VoiceOver)
 * - error → accessibilityLiveRegion="polite" (anunciado por
 *   el lector de pantalla del sistema) + borde rojo
 * - esContrasena → toggle 👁️ mostrar/ocultar (zona táctil 48)
 * ══════════════════════════════════════════════════════
 */

interface Props {
  etiqueta: string;
  valor: string;
  onChangeText: (texto: string) => void;
  placeholder?: string;
  esContrasena?: boolean;
  error?: string | null;
  hint?: string;
  tipoTeclado?: KeyboardTypeOptions;
  autoCapitalizar?: 'none' | 'sentences' | 'words';
  multilinea?: boolean;
}

export function CampoTexto({
  etiqueta,
  valor,
  onChangeText,
  placeholder,
  esContrasena = false,
  error,
  hint,
  tipoTeclado,
  autoCapitalizar = 'none',
  multilinea = false,
}: Props) {
  const [visible, setVisible] = useState(!esContrasena);

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>

      <View
        style={[
          estilos.marco,
          error ? estilos.marcoError : null,
          multilinea && estilos.marcoMultilinea,
        ]}
      >
        <TextInput
          style={[estilos.input, multilinea && estilos.inputMultilinea]}
          value={valor}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colores.textoSutil}
          secureTextEntry={esContrasena && !visible}
          keyboardType={tipoTeclado}
          autoCapitalize={autoCapitalizar}
          autoCorrect={!esContrasena}
          multiline={multilinea}
          accessibilityLabel={etiqueta}
          accessibilityHint={
            error ? `Error: ${error}` : hint
          }
        />

        {esContrasena && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            style={estilos.toggle}
          >
            <Text style={estilos.toggleTexto}>{visible ? '🙈' : '👁️'}</Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <Text
          style={estilos.error}
          accessibilityLiveRegion="polite"
        >
          ⚠️ {error}
        </Text>
      ) : hint ? (
        <Text style={estilos.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { width: '100%', marginBottom: tamaños.md },
  etiqueta: { ...estilosComunes.etiqueta },
  marco: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.superficieClara,
    borderRadius: tamaños.radioMD,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  marcoError: { borderColor: colores.peligro },
  marcoMultilinea: { alignItems: 'flex-start' },
  input: {
    flex: 1,
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    height: tamaños.botonAltura,
    paddingHorizontal: tamaños.md,
  },
  inputMultilinea: {
    height: 'auto',
    minHeight: tamaños.botonAltura,
    paddingVertical: tamaños.sm,
    textAlignVertical: 'top',
  },
  toggle: {
    width: tamaños.iconoBoton,
    height: tamaños.iconoBoton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTexto: { fontSize: 22 },
  error: {
    color: colores.peligro,
    fontSize: tamaños.fuenteSM,
    marginTop: tamaños.xs,
  },
  hint: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    marginTop: tamaños.xs,
  },
});