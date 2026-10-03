import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { CampoTexto } from '@/components/CampoTexto';
import { colores, tamaños } from '@/constants/tema';
import { mensajeDeError } from '@/types';
import { validarCorreo } from '@/utils/validaciones';
import type { LoginStackParamList } from '@/navigation/NavigationTypes';

/**
 * ══════════════════════════════════════════════════════
 * Pantalla de inicio de sesión (CU02).
 *
 * Accesibilidad:
 *   - Anuncio de pantalla al montar (TTS)
 *   - Errores por texto (Alerta/live region) Y por voz
 *   - Campos grandes (56dp), toggle de contraseña
 *
 * Al autenticarse, el RootNavigator (Tanda 5) cambia
 * automáticamente a la rama App (navegación reactiva).
 * ══════════════════════════════════════════════════════
 */

export default function PantallaLogin() {
  const { iniciarSesion } = useAuth();
  const { anunciar } = useTTS();
  const navigation =
    useNavigation<NativeStackNavigationProp<LoginStackParamList>>();

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [errorContrasena, setErrorContrasena] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Anuncio de pantalla (TTS + se anuncia al entrar)
  useEffect(() => {
    anunciar(
      'Pantalla de inicio de sesión. Ingresa tu correo y contraseña.',
    );
  }, [anunciar]);

  function validar(): boolean {
    const eCorreo = validarCorreo(correo);
    const erroresPass = contrasena ? [] : ['La contraseña es obligatoria.'];

    setErrorCorreo(eCorreo);
    setErrorContrasena(erroresPass[0] ?? null);

    return !eCorreo && erroresPass.length === 0;
  }

  async function manejarEnvio() {
    setErrorGeneral(null);

    if (!validar()) {
      anunciar('Revisa los campos marcados con error.');
      return;
    }

    setEnviando(true);
    try {
      await iniciarSesion({
        correo: correo.trim().toLowerCase(),
        contrasena,
      });

      // Éxito → el RootNavigator cambia a la rama App solo.
      // Anunciamos por si el motor tarda en reconstruir.
      anunciar('Sesión iniciada correctamente.');
    } catch (err) {
      const mensaje = mensajeDeError(err);
      setErrorGeneral(mensaje);
      // Error crítico: siempre por voz (el usuario puede no
      // estar mirando la pantalla al esperar el resultado)
      anunciar(`Error. ${mensaje}`, { forzar: true });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Branding ─── */}
        <View style={estilos.branding}>
          <Text style={estilos.icono}>👁️</Text>
          <Text style={estilos.titulo}>VisionCare AI</Text>
          <Text style={estilos.subtitulo}>
            Tu asistente de visión para el día a día
          </Text>
        </View>

        {/* ─── Formulario ─── */}
        <View style={estilos.tarjeta}>
          {errorGeneral && (
            <Alerta
              variante="error"
              mensaje={errorGeneral}
              onCerrar={() => setErrorGeneral(null)}
            />
          )}

          <CampoTexto
            etiqueta="Correo electrónico"
            valor={correo}
            onChangeText={(t) => {
              setCorreo(t);
              if (errorCorreo) setErrorCorreo(null);
            }}
            placeholder="tu@correo.com"
            tipoTeclado="email-address"
            error={errorCorreo}
          />

          <CampoTexto
            etiqueta="Contraseña"
            valor={contrasena}
            onChangeText={(t) => {
              setContrasena(t);
              if (errorContrasena) setErrorContrasena(null);
            }}
            placeholder="••••••••"
            esContrasena
            error={errorContrasena}
          />

          <Boton
            etiqueta="Iniciar sesión"
            onPress={() => void manejarEnvio()}
            cargando={enviando}
          />
        </View>

        {/* ─── Ir a registro ─── */}
        <View style={estilos.pie}>
          <Text style={estilos.pieTexto}>¿No tienes cuenta?</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Crear una cuenta nueva"
            onPress={() => navigation.navigate('Registro')}
            hitSlop={8}
          >
            <Text style={estilos.enlace}>  Crear cuenta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: tamaños.lg,
  },
  branding: {
    alignItems: 'center',
    marginBottom: tamaños.xl,
  },
  icono: { fontSize: 64, marginBottom: tamaños.sm },
  titulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteTitulo,
    fontWeight: '700',
  },
  subtitulo: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    marginTop: tamaños.xs,
    textAlign: 'center',
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  pie: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tamaños.lg,
  },
  pieTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
  },
  enlace: {
    color: colores.primario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
    paddingVertical: tamaños.touchMin / 3,
  },
});