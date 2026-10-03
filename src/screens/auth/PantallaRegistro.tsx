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
import {
  validarContrasena,
  validarCorreo,
  validarNombres,
  validarTelefono,
} from '@/utils/validaciones';
import type { LoginStackParamList } from '@/navigation/NavigationTypes';

/**
 * ══════════════════════════════════════════════════════
 * Pantalla de registro (CU01).
 *
 * Campos: nombres*, apellidos, correo*, teléfono,
 *         contraseña*, confirmar contraseña*.
 *
 * Validación cliente espejo del RegistroDto del backend.
 * Al registrarse el backend devuelve token → AUTO-LOGIN
 * (establecerSesion del AuthContext) → el Stack salta a App.
 * ══════════════════════════════════════════════════════
 */

interface Errores {
  nombres?: string;
  apellidos?: string;
  correo?: string;
  telefono?: string;
  contrasena?: string;
  confirmar?: string;
}

export default function PantallaRegistro() {
  const { registrarse } = useAuth();
  const { anunciar } = useTTS();
  const navigation =
    useNavigation<NativeStackNavigationProp<LoginStackParamList>>();

  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    anunciar(
      'Pantalla de registro. Crea tu cuenta con tu correo y una contraseña segura.',
    );
  }, [anunciar]);

  function limpiarError(campo: keyof Errores) {
    setErrores((prev) => (prev[campo] ? { ...prev, [campo]: undefined } : prev));
  }

  function validar(): boolean {
    const nuevos: Errores = {};

    const eNombres = validarNombres(nombres);
    if (eNombres) nuevos.nombres = eNombres;

    const eTelefono = validarTelefono(telefono);
    if (eTelefono) nuevos.telefono = eTelefono;

    const eCorreo = validarCorreo(correo);
    if (eCorreo) nuevos.correo = eCorreo;

    const erroresPass = validarContrasena(contrasena);
    if (erroresPass.length > 0) nuevos.contrasena = erroresPass.join(' ');

    if (confirmar !== contrasena) {
      nuevos.confirmar = 'Las contraseñas no coinciden.';
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function manejarEnvio() {
    setErrorGeneral(null);

    if (!validar()) {
      anunciar('Revisa los campos marcados con error.');
      return;
    }

    setEnviando(true);
    try {
      await registrarse({
        correo: correo.trim().toLowerCase(),
        contrasena,
        perfil: {
          nombres: nombres.trim(),
          ...(apellidos.trim() && { apellidos: apellidos.trim() }),
          ...(telefono.trim() && { telefono: telefono.trim() }),
        },
      });

      // Éxito → auto-login → RootNavigator cambia a App
      anunciar(
        `Cuenta creada. Bienvenido, ${nombres.trim()}.`,
        { forzar: true },
      );
    } catch (err) {
      const mensaje = mensajeDeError(err);
      setErrorGeneral(mensaje);
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
        <Text style={estilos.titulo}>Crear cuenta</Text>
        <Text style={estilos.subtitulo}>
          Completa tus datos para empezar a usar VisionCare AI.
        </Text>

        <View style={estilos.tarjeta}>
          {errorGeneral && (
            <Alerta
              variante="error"
              mensaje={errorGeneral}
              onCerrar={() => setErrorGeneral(null)}
            />
          )}

          <CampoTexto
            etiqueta="Nombres *"
            valor={nombres}
            onChangeText={(t) => {
              setNombres(t);
              limpiarError('nombres');
            }}
            placeholder="María"
            autoCapitalizar="words"
            error={errores.nombres}
          />

          <CampoTexto
            etiqueta="Apellidos"
            valor={apellidos}
            onChangeText={(t) => {
              setApellidos(t);
              limpiarError('apellidos');
            }}
            placeholder="González Pérez"
            autoCapitalizar="words"
            error={errores.apellidos}
          />

          <CampoTexto
            etiqueta="Correo electrónico *"
            valor={correo}
            onChangeText={(t) => {
              setCorreo(t);
              limpiarError('correo');
            }}
            placeholder="tu@correo.com"
            tipoTeclado="email-address"
            error={errores.correo}
          />

          <CampoTexto
            etiqueta="Teléfono (opcional)"
            valor={telefono}
            onChangeText={(t) => {
              setTelefono(t);
              limpiarError('telefono');
            }}
            placeholder="+591 70011122"
            tipoTeclado="phone-pad"
            error={errores.telefono}
          />

          <CampoTexto
            etiqueta="Contraseña *"
            valor={contrasena}
            onChangeText={(t) => {
              setContrasena(t);
              limpiarError('contrasena');
            }}
            placeholder="••••••••"
            esContrasena
            hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
            error={errores.contrasena}
          />

          <CampoTexto
            etiqueta="Confirmar contraseña *"
            valor={confirmar}
            onChangeText={(t) => {
              setConfirmar(t);
              limpiarError('confirmar');
            }}
            placeholder="••••••••"
            esContrasena
            error={errores.confirmar}
          />

          <Boton
            etiqueta="Crear cuenta"
            onPress={() => void manejarEnvio()}
            cargando={enviando}
          />
        </View>

        <View style={estilos.pie}>
          <Text style={estilos.pieTexto}>¿Ya tienes cuenta?</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ir a iniciar sesión"
            onPress={() => navigation.goBack()}
            hitSlop={8}
          >
            <Text style={estilos.enlace}>  Iniciar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    padding: tamaños.lg,
    paddingTop: tamaños.xl,
    paddingBottom: tamaños.xl * 2,
  },
  titulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXXL,
    fontWeight: '700',
    marginBottom: tamaños.xs,
  },
  subtitulo: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    marginBottom: tamaños.lg,
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