// ══════════ src/screens/inicio/PantallaMasMenu.tsx (temporal) ══════════
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '@/context/AuthContext';
import { colores, tamaños } from '@/constants/tema';

export default function PantallaMasMenu() {
  const navigation = useNavigation();
  const { usuario, cerrarSesion } = useAuth();

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>
        {usuario?.perfil?.nombres ?? usuario?.correo}
      </Text>
      <Text style={estilos.sutil}>{usuario?.rol}</Text>

      <ItemMenu
        etiqueta="👤  Mi perfil (CU04)"
        onPress={() => navigation.navigate('Perfil' as never)}
      />
      <ItemMenu
        etiqueta="🔊  Accesibilidad (CU03)"
        onPress={() => navigation.navigate('Accesibilidad' as never)}
      />
      <ItemMenu
        etiqueta="📞  Contactos de confianza (CU05)"
        onPress={() => navigation.navigate('Contactos' as never)}
      />
      <ItemMenu
        etiqueta="🚪  Cerrar sesión"
        peligrosa
        onPress={() => void cerrarSesion()}
      />
    </View>
  );
}

function ItemMenu(props: { etiqueta: string; onPress: () => void; peligrosa?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.etiqueta}
      onPress={props.onPress}
      style={({ pressed }) => [
        estilos.item,
        props.peligrosa && { backgroundColor: colores.peligroFondo },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={estilos.itemTexto}>{props.etiqueta}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1, backgroundColor: colores.fondo,
    padding: tamaños.lg, gap: tamaños.sm,
  },
  titulo: { color: colores.texto, fontSize: tamaños.fuenteXL, fontWeight: '700' },
  sutil: { color: colores.textoSutil, fontSize: tamaños.fuenteSM, marginBottom: tamaños.md },
  item: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    height: tamaños.botonAltura,
    justifyContent: 'center',
    paddingHorizontal: tamaños.md,
  },
  itemTexto: { color: colores.texto, fontSize: tamaños.fuenteMD, fontWeight: '600' },
});