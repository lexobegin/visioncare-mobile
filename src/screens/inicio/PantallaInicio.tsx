import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
//import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { listarMisContactos } from '@/api/contactos.api';
import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { colores, tamaños } from '@/constants/tema';
//import type { AppTabsParamList, MasStackParamList, } from '@/navigation/NavigationTypes';
import type {
  AppTabsParamList,
} from '@/navigation/NavigationTypes';
import type { Contacto } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Inicio — hub principal de la app.
 *
 *   - Saludo anunciado por voz al llegar
 *   - 2 accesos GRANDES: Cámara (CU07-08) y Voz (CU06)
 *   - Tarjeta de contacto prioritario (emergencias, Sprint 3)
 *   - Estado rápido de la voz (CU03)
 * ══════════════════════════════════════════════════════
 */

export default function PantallaInicio() {
  const { usuario, preferencias } = useAuth();
  const { anunciar } = useTTS();

  const navigationTab =
    useNavigation<BottomTabNavigationProp<AppTabsParamList>>();
  //const navigationMas =
  //  useNavigation<NativeStackNavigationProp<MasStackParamList>>();

  const [contactoPrioritario, setContactoPrioritario] =
    useState<Contacto | null>(null);

  // Primer contacto ACTIVO por prioridad (base de emergencias)
  useEffect(() => {
    let cancelado = false;
    listarMisContactos({ page: 1, limit: 1, estado: 'ACTIVO' })
      .then((r) => {
        if (!cancelado) setContactoPrioritario(r.datos[0] ?? null);
      })
      .catch(() => {
        if (!cancelado) setContactoPrioritario(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Anuncio de bienvenida (una vez por llegada a la pantalla)
  useEffect(() => {
    const nombres = usuario?.perfil?.nombres;
    if (nombres) {
      anunciar(`Hola, ${nombres}. ¿Qué necesitas hoy?`);
    }
  }, [usuario?.perfil?.nombres, anunciar]);

  return (
    <ScrollView
      style={estilos.flex}
      contentContainerStyle={estilos.contenido}
    >
      <Text style={estilos.saludo}>
        Hola, {usuario?.perfil?.nombres ?? usuario?.correo} 👋
      </Text>

      {/* ─── Accesos principales (acciones críticas) ─── */}
      <AccesoGrande
        emoji="📷"
        titulo="Analizar entorno"
        descripcion="Reconocer objetos con la cámara e IA"
        onPress={() => {
          anunciar('Abriendo cámara para analizar tu entorno.');
          navigationTab.navigate('Camara');
        }}
      />

      <AccesoGrande
        emoji="🎤"
        titulo="Comandos de voz"
        descripcion="Manejar la app hablando"
        onPress={() => {
          anunciar('Abriendo comandos de voz.');
          navigationTab.navigate('Voz');
        }}
      />

      {/* ─── Contacto de confianza prioritario ─── */}
      <View style={[estilos.tarjeta, estilos.tarjetaInfo]}>
        <Text style={estilos.tituloTarjeta}>🚨 Contacto prioritario</Text>
        {contactoPrioritario ? (
          <>
            <Text style={estilos.contactoNombre}>
              {contactoPrioritario.nombre}
              {contactoPrioritario.parentesco
                ? ` · ${contactoPrioritario.parentesco}`
                : ''}
            </Text>
            <Text style={estilos.contactoDetalle}>
              {contactoPrioritario.telefono ?? contactoPrioritario.correo ?? '—'}
            </Text>
          </>
        ) : (
          <Text style={estilos.contactoDetalle}>
            Aún no tienes contactos de confianza. Agrégalos para que puedan
            ayudarte en emergencias.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gestionar contactos de confianza"
          onPress={() => {
            anunciar('Abriendo contactos de confianza.');
            navigationTab.navigate('Mas', { screen: 'Contactos' });
            //navigationMas.navigate('Contactos');
          }}
          style={({ pressed }) => [estilos.enlaceFila, pressed && { opacity: 0.7 }]}
        >
          <Text style={estilos.enlaceTexto}>Gestionar contactos →</Text>
        </Pressable>
      </View>

      {/* ─── Estado de la voz (CU03) ─── */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.tituloTarjeta}>🔊 Asistente de voz</Text>
        <Text style={estilos.estadoVoz}>
          {preferencias?.voz_habilitada === false
            ? 'Desactivado — actívalo en Accesibilidad'
            : `Activado · volumen ${Math.round(preferencias?.volumen_voz ?? 80)} · velocidad ${(preferencias?.velocidad_voz ?? 1).toFixed(1)}x`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Configurar accesibilidad"
          onPress={() => {
            anunciar('Abriendo configuración de accesibilidad.');
            navigationTab.navigate('Mas', { screen: 'Accesibilidad' });
            //navigationMas.navigate('Accesibilidad');
          }}
          style={({ pressed }) => [estilos.enlaceFila, pressed && { opacity: 0.7 }]}
        >
          <Text style={estilos.enlaceTexto}>Configurar accesibilidad →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** Acceso grande a función principal (zona táctil generosa) */
function AccesoGrande(props: {
  emoji: string;
  titulo: string;
  descripcion: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.titulo}. ${props.descripcion}`}
      onPress={props.onPress}
      style={({ pressed }) => [
        estilos.acceso,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={estilos.accesoEmoji} aria-hidden>
        {props.emoji}
      </Text>
      <View style={estilos.accesoTextos}>
        <Text style={estilos.accesoTitulo}>{props.titulo}</Text>
        <Text style={estilos.accesoDescripcion}>{props.descripcion}</Text>
      </View>
      <Text style={estilos.accesoFlecha} aria-hidden>
        →
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    padding: tamaños.lg,
    paddingTop: tamaños.xl,
    gap: tamaños.md,
  },
  saludo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXXL,
    fontWeight: '700',
    marginBottom: tamaños.sm,
  },
  acceso: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.primario,
    borderRadius: tamaños.radioLG,
    padding: tamaños.lg,
    minHeight: 96,
    gap: tamaños.md,
  },
  accesoEmoji: { fontSize: 40 },
  accesoTextos: { flex: 1 },
  accesoTitulo: {
    color: '#ffffff',
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
  },
  accesoDescripcion: {
    color: '#dbeafe',
    fontSize: tamaños.fuenteSM,
    marginTop: 2,
  },
  accesoFlecha: { color: '#ffffff', fontSize: 24, fontWeight: '700' },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  tarjetaInfo: {
    borderLeftWidth: 4,
    borderLeftColor: colores.peligro,
  },
  tituloTarjeta: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    marginBottom: tamaños.xs,
  },
  contactoNombre: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '600',
  },
  contactoDetalle: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    marginTop: 2,
  },
  estadoVoz: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
  },
  enlaceFila: { marginTop: tamaños.sm, paddingVertical: tamaños.xs },
  enlaceTexto: {
    color: colores.primario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
});