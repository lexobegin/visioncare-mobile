// ══════════ src/screens/inicio/PantallaMasMenu.tsx (temporal) ══════════
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MasStackParamList } from '@/navigation/NavigationTypes';

import { useAuth } from '@/context/AuthContext';
import { colores, tamaños } from '@/constants/tema';

import { listarAlertasPendientes } from '@/api/alertas.api';
import { useEffect, useState } from 'react';

export default function PantallaMasMenu() {
  const navigation = useNavigation<NativeStackNavigationProp<MasStackParamList>>();

  const { usuario, cerrarSesion } = useAuth();

  const [alertasPendientes, setAlertasPendientes] = useState(0);

  useEffect(() => {
    listarAlertasPendientes(1, 1)
      .then((r) => setAlertasPendientes(r.meta.total))
      .catch(() => setAlertasPendientes(0));
  }, []);

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>
        {usuario?.perfil?.nombres ?? usuario?.correo}
      </Text>
      <Text style={estilos.sutil}>{usuario?.rol}</Text>

      <ItemMenu
        etiqueta="🆘  Pedir ayuda (CU20)"
        peligrosa
        onPress={() => navigation.navigate('Ayuda')}
      />

      <ItemMenu
        etiqueta="👤  Mi perfil (CU04)"
        onPress={() => navigation.navigate('Perfil')}
      />
      <ItemMenu
        etiqueta="🔊  Accesibilidad (CU03)"
        onPress={() => navigation.navigate('Accesibilidad')}
      />
      <ItemMenu
        etiqueta="📞  Contactos de confianza (CU05)"
        onPress={() => navigation.navigate('Contactos')}
      />
      <ItemMenu
        etiqueta={
          alertasPendientes > 0
            ? `🚨  Alertas (${alertasPendientes} sin atender)`
            : '🔔  Alertas'
        }
        peligrosa={alertasPendientes > 0}
        onPress={() => navigation.navigate('Alertas')}
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