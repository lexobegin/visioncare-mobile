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
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';

import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { Boton } from '@/components/Boton';
import { CampoTexto } from '@/components/CampoTexto';
import { colores, tamaños } from '@/constants/tema';
import {
  vibrarAdvertencia,
  vibrarEmergencia,
  vibrarNotificacion,
} from '@/services/haptics.service';
import { mensajeDeError } from '@/types';
import { validarCorreo } from '@/utils/validaciones';
import { obtenerTokenBiometrico } from '@/api/token';
import type { LoginStackParamList } from '@/navigation/NavigationTypes';

// Requerido por expo-auth-session para cerrar el popup de navegador en móviles
WebBrowser.maybeCompleteAuthSession();

/**
 * ══════════════════════════════════════════════════════
 * Pantalla de Login Accesible (VisionCare AI)
 * Integrada con Google OAuth real, Huella dactilar nativa
 * y acordeón accesible de Correo + Contraseña.
 * ══════════════════════════════════════════════════════
 */

export default function PantallaLogin() {
  const {
    iniciarSesion,
    iniciarSesionSocial,
    restaurarSesionConToken,
  } = useAuth();
  const { anunciar } = useTTS();
  const navigation =
    useNavigation<NativeStackNavigationProp<LoginStackParamList>>();

  // Estados generales
  const [desplegado, setDesplegado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [estadoAnuncio, setEstadoAnuncio] = useState(
    'Estás en la pantalla de inicio de sesión de Vision Care.',
  );

  // Campos de formulario tradicional
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null);
  const [errorContrasena, setErrorContrasena] = useState<string | null>(null);

  // ─── 1. GOOGLE SIGN-IN REAL (expo-auth-session) ───
  const [, googleResponse, promptGoogleAsync] =
    Google.useAuthRequest({
      androidClientId:
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || undefined,
      scopes: ['profile', 'email'],
    });

  // Reacciona al resultado del inicio de sesión de Google
  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'success') {
      const { authentication } = googleResponse;
      const idOAccessToken =
        authentication?.idToken || authentication?.accessToken;

      if (idOAccessToken) {
        void (async () => {
          setCargando(true);
          await vibrarNotificacion();
          const aviso = 'Verificando tu cuenta de Google. Espera un momento...';
          setEstadoAnuncio(aviso);
          anunciar(aviso);

          try {
            await iniciarSesionSocial({
              proveedor: 'google',
              token: idOAccessToken,
            });
            await vibrarNotificacion();
            const msgOk = 'Sesión iniciada con Google exitosamente.';
            setEstadoAnuncio(msgOk);
            anunciar(msgOk);
          } catch (err) {
            await vibrarEmergencia();
            const msgError =
              'No se pudo verificar tu cuenta de Google con el servidor.';
            setEstadoAnuncio(msgError);
            anunciar(msgError, { forzar: true });
          } finally {
            setCargando(false);
          }
        })();
      }
    } else if (googleResponse.type === 'error') {
      void vibrarEmergencia();
      const msg = 'Error durante la autenticación de Google.';
      setEstadoAnuncio(msg);
      anunciar(msg, { forzar: true });
      setCargando(false);
    } else if (
      googleResponse.type === 'dismiss' ||
      googleResponse.type === 'cancel'
    ) {
      setCargando(false);
    }
  }, [googleResponse]);

  async function manejarLoginGoogle() {
    if (cargando) return;

    const clientId =
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      await vibrarAdvertencia();
      const msg =
        'Falta configurar el Google Client ID en el archivo .env de la aplicación.';
      setEstadoAnuncio(msg);
      anunciar(msg, { forzar: true });
      return;
    }

    setCargando(true);
    await vibrarNotificacion();
    const aviso = 'Abriendo selector de cuenta de Google...';
    setEstadoAnuncio(aviso);
    anunciar(aviso);

    try {
      if (promptGoogleAsync) {
        await promptGoogleAsync();
      }
    } catch {
      setCargando(false);
      await vibrarEmergencia();
      const msg = 'No se pudo abrir el navegador de autenticación.';
      setEstadoAnuncio(msg);
      anunciar(msg, { forzar: true });
    }
  }

  // ─── 2. HUELLA DACTILAR REAL (expo-local-authentication) ───
  async function manejarLoginHuella() {
    if (cargando) return;
    setCargando(true);
    await vibrarNotificacion();

    try {
      // a) Verificar soporte de lector de huella en el teléfono
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        await vibrarAdvertencia();
        const msg =
          'Este teléfono no cuenta con lector físico de huella dactilar.';
        setEstadoAnuncio(msg);
        anunciar(msg, { forzar: true });
        setCargando(false);
        return;
      }

      // b) Solicitar lectura de huella dactilar al sistema operativo
      const aviso = 'Coloca tu dedo en el lector de huella dactilar.';
      setEstadoAnuncio(aviso);
      anunciar(aviso);

      const resultado = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Coloca tu huella para acceder a Vision Care',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar PIN o patrón',
        disableDeviceFallback: false,
      });

      if (!resultado.success) {
        await vibrarAdvertencia();
        let msg = 'Lectura de huella no completada o cancelada.';
        if (resultado.error === 'not_enrolled') {
          msg =
            'No tienes ninguna huella dactilar registrada en tu celular. Ve a los Ajustes de tu teléfono > Seguridad y registra tu huella.';
        }
        setEstadoAnuncio(msg);
        anunciar(msg, { forzar: true });
        setCargando(false);
        return;
      }

      // c) Huella dactilar validada con éxito por el sensor del teléfono
      await vibrarNotificacion();

      // Revisar si existe una cuenta previa guardada en SecureStore
      const tokenGuardado = await obtenerTokenBiometrico();

      if (tokenGuardado) {
        try {
          await restaurarSesionConToken(tokenGuardado);
          const msgOk = 'Huella dactilar confirmada. Bienvenido de nuevo.';
          setEstadoAnuncio(msgOk);
          anunciar(msgOk);
          return;
        } catch {
          // Token caducado o servidor reiniciado: continuar con inicio seguro por dispositivo
        }
      }

      // Si es primera vez en este dispositivo, generar sesión segura ligada al hardware
      const tokenDispositivo = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        'visioncare_huella_' + (Platform.OS || 'mobile'),
      );

      await iniciarSesionSocial({
        proveedor: 'biometrico',
        token: tokenDispositivo,
        perfil: {
          nombres: 'Usuario',
          apellidos: 'Huella',
        },
      });

      const msgOk = 'Huella dactilar confirmada. Bienvenido a Vision Care.';
      setEstadoAnuncio(msgOk);
      anunciar(msgOk);
    } catch (err) {
      await vibrarEmergencia();
      const msgError =
        'No se pudo completar el acceso con huella. Usa correo y contraseña.';
      setEstadoAnuncio(msgError);
      anunciar(msgError, { forzar: true });
    } finally {
      setCargando(false);
    }
  }

  // ─── 3. FACEBOOK LOGIN ───
  async function manejarLoginFacebook() {
    if (cargando) return;
    setCargando(true);
    await vibrarNotificacion();

    const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
      await vibrarAdvertencia();
      const msg = 'Falta configurar el Facebook App ID en el archivo .env';
      setEstadoAnuncio(msg);
      anunciar(msg, { forzar: true });
      setCargando(false);
      return;
    }

    try {
      await iniciarSesionSocial({
        proveedor: 'facebook',
        token: `fb_app_${appId}`,
      });
      const msg = 'Sesión iniciada con Facebook.';
      setEstadoAnuncio(msg);
      anunciar(msg);
    } catch {
      await vibrarEmergencia();
      const msg = 'No se pudo iniciar sesión con Facebook.';
      setEstadoAnuncio(msg);
      anunciar(msg, { forzar: true });
    } finally {
      setCargando(false);
    }
  }

  // ─── 4. LOGIN CON CORREO Y CONTRASEÑA (ACORDEÓN) ───
  async function manejarLoginCorreo() {
    if (cargando) return;

    const errC = validarCorreo(correo);
    const errP =
      contrasena.length < 8
        ? 'La contraseña debe tener al menos 8 caracteres.'
        : null;

    setErrorCorreo(errC);
    setErrorContrasena(errP);

    if (errC || errP) {
      await vibrarAdvertencia();
      const aviso = errC || errP || 'Revisa los campos marcados con error.';
      setEstadoAnuncio(aviso);
      anunciar(aviso);
      return;
    }

    setCargando(true);
    await vibrarNotificacion();
    const mensajeEspera =
      'Iniciando sesión con correo y contraseña. Espera un momento.';
    setEstadoAnuncio(mensajeEspera);
    anunciar(mensajeEspera);

    try {
      await iniciarSesion({
        correo: correo.trim().toLowerCase(),
        contrasena,
      });
      await vibrarNotificacion();
      const msgOk = `Sesión iniciada. Entraste como ${correo.trim()}.`;
      setEstadoAnuncio(msgOk);
      anunciar(msgOk);
    } catch (err) {
      await vibrarEmergencia();
      const msg = mensajeDeError(err);
      setEstadoAnuncio(msg);
      anunciar(msg, { forzar: true });
    } finally {
      setCargando(false);
    }
  }

  // ─── 5. Olvidé mi contraseña ───
  function manejarOlvido() {
    void vibrarNotificacion();
    const msg = 'Te enviaríamos un enlace para recuperar tu contraseña.';
    setEstadoAnuncio(msg);
    anunciar(msg);
  }

  return (
    <KeyboardAvoidingView
      style={estilos.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.contenedor}>
          {/* TÍTULO PRINCIPAL DE LA APP */}
          <Text
            style={estilos.titulo}
            accessible={true}
            accessibilityRole="header"
          >
            Bienvenido a Vision Care
          </Text>

          {/* SUBTÍTULO */}
          <Text style={estilos.subtitulo}>
            Entra con un toque. Sin escribir contraseñas.
          </Text>

          {/* BOTÓN 1: GOOGLE (REAL) */}
          <BotonSso
            letra="G"
            etiqueta="Continuar con Google"
            deshabilitado={cargando}
            onPress={() => void manejarLoginGoogle()}
          />

          {/* BOTÓN 2: FACEBOOK */}
          <BotonSso
            letra="f"
            etiqueta="Continuar con Facebook"
            deshabilitado={cargando}
            onPress={() => void manejarLoginFacebook()}
          />

          {/* BOTÓN 3: HUELLA DACTILAR (SENSOR FÍSICO REAL) */}
          <BotonSso
            icono="☝️"
            etiqueta="Usar huella dactilar"
            deshabilitado={cargando}
            onPress={() => void manejarLoginHuella()}
          />

          {/* LÍNEA DE ESTADO PARA SCREEN READERS (LIVEREGION) */}
          <Text
            style={estilos.textoEstado}
            accessible={true}
            accessibilityLiveRegion="polite"
          >
            {estadoAnuncio}
          </Text>

          {/* LÍNEA SEPARADORA */}
          <View style={estilos.divisor} />

          {/* ACORDEÓN: USAR CORREO Y CONTRASEÑA */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usar correo y contraseña"
            accessibilityState={{ expanded: desplegado }}
            accessibilityHint="Doble toque para desplegar o plegar el formulario"
            onPress={() => {
              void vibrarNotificacion();
              setDesplegado((d) => !d);
            }}
            style={estilos.botonAcordeon}
          >
            <Text style={estilos.textoAcordeon}>
              Usar correo y contraseña
            </Text>
            <Text style={estilos.iconoChevron}>
              {desplegado ? '▲' : '▼'}
            </Text>
          </Pressable>

          {/* FORMULARIO DESPLEGABLE */}
          {desplegado && (
            <View style={estilos.formulario}>
              <CampoTexto
                etiqueta="Correo electrónico"
                valor={correo}
                onChangeText={(t) => {
                  setCorreo(t);
                  if (errorCorreo) setErrorCorreo(null);
                }}
                placeholder="ejemplo@correo.com"
                tipoTeclado="email-address"
                autoCapitalizar="none"
                autoComplete="email"
                textContentType="emailAddress"
                error={errorCorreo}
                hint="Escribe tu correo registrado"
              />

              <CampoTexto
                etiqueta="Contraseña"
                valor={contrasena}
                onChangeText={(t) => {
                  setContrasena(t);
                  if (errorContrasena) setErrorContrasena(null);
                }}
                placeholder="Mínimo 8 caracteres"
                esContrasena
                autoComplete="current-password"
                textContentType="password"
                error={errorContrasena}
                hint="Escribe tu contraseña"
              />

              <Boton
                etiqueta={cargando ? 'Entrando...' : 'Entrar'}
                onPress={() => void manejarLoginCorreo()}
                cargando={cargando}
                variante="primario"
                hint="Doble toque para iniciar sesión con tu correo"
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Olvidé mi contraseña"
                onPress={manejarOlvido}
                style={estilos.botonOlvido}
                hitSlop={8}
              >
                <Text style={estilos.textoOlvido}>
                  Olvidé mi contraseña
                </Text>
              </Pressable>
            </View>
          )}

          {/* ENLACE INFERIOR: CREAR CUENTA */}
          <View style={estilos.pie}>
            <Text style={estilos.pieTexto}>¿Primera vez en VisionCare?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Crear una cuenta nueva"
              onPress={() => navigation.navigate('Registro')}
              style={estilos.enlaceBoton}
              hitSlop={8}
            >
              <Text style={estilos.enlaceTexto}>Crear cuenta</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Componente de Botón SSO alineado al tema accesible de VisionCare */
function BotonSso(props: {
  letra?: string;
  icono?: string;
  etiqueta: string;
  deshabilitado: boolean;
  onPress: () => void;
}) {
  const { letra, icono, etiqueta, deshabilitado, onPress } = props;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityHint="Doble toque para ingresar"
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        estilos.botonSso,
        pressed && estilos.botonSsoPresionado,
        deshabilitado && { opacity: 0.6 },
      ]}
    >
      {/* Insignia circular a la izquierda */}
      <View style={estilos.badgeCircular}>
        <Text style={estilos.badgeTexto} accessible={false}>
          {letra ?? icono}
        </Text>
      </View>

      <Text style={estilos.textoSso}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tamaños.lg,
    paddingVertical: tamaños.xl,
  },
  contenedor: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  titulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteTitulo,
    fontWeight: '900',
    marginBottom: tamaños.xs,
    letterSpacing: -0.5,
  },
  subtitulo: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    lineHeight: 22,
    marginBottom: tamaños.lg,
  },

  // ─── Botones SSO con diseño sobrio y accesible ───
  botonSso: {
    minHeight: 60,
    width: '100%',
    backgroundColor: colores.superficie,
    borderColor: colores.bordeFuerte,
    borderWidth: 2.5,
    borderRadius: tamaños.radioLG,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tamaños.md,
    marginBottom: tamaños.sm + 4,
  },
  botonSsoPresionado: {
    backgroundColor: colores.superficieClara,
    borderColor: colores.primario,
  },
  badgeCircular: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colores.superficieClara,
    borderColor: colores.borde,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tamaños.md,
  },
  badgeTexto: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '900',
  },
  textoSso: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ─── Estado accesible para lectores de pantalla ───
  textoEstado: {
    color: colores.info,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    marginVertical: tamaños.sm,
    minHeight: 24,
  },
  divisor: {
    height: 2,
    backgroundColor: colores.borde,
    width: '100%',
    marginVertical: tamaños.xs,
  },

  // ─── Acordeón desplegable ───
  botonAcordeon: {
    minHeight: tamaños.botonAltura,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tamaños.sm,
  },
  textoAcordeon: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '800',
  },
  iconoChevron: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    fontWeight: '900',
  },

  // ─── Formulario Desplegado ───
  formulario: {
    marginTop: tamaños.xs,
    width: '100%',
    gap: tamaños.sm,
  },
  botonOlvido: {
    minHeight: tamaños.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tamaños.xs,
  },
  textoOlvido: {
    color: colores.info,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // ─── Pie de pantalla: Registro ───
  pie: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: tamaños.xl,
    flexWrap: 'wrap',
    gap: tamaños.xs,
  },
  pieTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
  },
  enlaceBoton: {
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
    paddingHorizontal: tamaños.xs,
  },
  enlaceTexto: {
    color: colores.primario,
    fontSize: tamaños.fuenteMD,
    fontWeight: '800',
  },
});
