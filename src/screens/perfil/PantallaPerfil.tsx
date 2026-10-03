import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  actualizarMiPerfil,
  cambiarMiContrasena,
} from '@/api/usuarios.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { CampoTexto } from '@/components/CampoTexto';
import { PantallaCargando } from '@/components/PantallaCargando';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { colores, tamaños } from '@/constants/tema';
import { mensajeDeError } from '@/types';
import {
  validarContrasena,
  validarNombres,
  validarTelefono,
} from '@/utils/validaciones';

/**
 * ══════════════════════════════════════════════════════
 * Mi perfil (CU04) — 2 secciones:
 *
 *   1. Datos personales → PATCH /usuarios/me (parcial)
 *   2. Cambiar contraseña → PATCH /usuarios/me/contrasena
 *      (validación espejo del CambiarContrasenaDto)
 *
 * Tras guardar, refrescarPerfil() actualiza sesión y TTS
 * (p. ej. si el usuario cambia el idioma del perfil).
 * ══════════════════════════════════════════════════════
 */

export default function PantallaPerfil() {
  const { usuario, refrescarPerfil } = useAuth();
  const { anunciar } = useTTS();

  // ─── Datos personales ───
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [idiomaIngles, setIdiomaIngles] = useState(false);

  const [errorNombres, setErrorNombres] = useState<string | null>(null);
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);

  const [guardandoDatos, setGuardandoDatos] = useState(false);

  // ─── Cambio de contraseña ───
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirmar, setPassConfirmar] = useState('');
  const [errorPassActual, setErrorPassActual] = useState<string | null>(null);
  const [errorPassNueva, setErrorPassNueva] = useState<string | null>(null);
  const [errorPassConfirmar, setErrorPassConfirmar] = useState<string | null>(null);
  const [guardandoPass, setGuardandoPass] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{
    variante: 'exito' | 'error' | 'info';
    texto: string;
  } | null>(null);

  // ─── Hidratación del formulario desde la sesión ───
  useEffect(() => {
    if (!usuario) return;
    setNombres(usuario.perfil?.nombres ?? '');
    setApellidos(usuario.perfil?.apellidos ?? '');
    setTelefono(usuario.perfil?.telefono ?? '');
    setFechaNacimiento(usuario.perfil?.fecha_nacimiento ?? '');
    setIdiomaIngles(usuario.perfil?.idioma === 'en');
    setCargando(false);
  }, [usuario]);

  useEffect(() => {
    anunciar('Pantalla de mi perfil. Edita tus datos o cambia tu contraseña.');
  }, [anunciar]);

  // ═══════════════ SECCIÓN 1: datos ═══════════════

  const guardarDatos = useCallback(async () => {
    setMensaje(null);

    // Validaciones espejo del backend (ActualizacionPerfil)
    const eNombres = validarNombres(nombres);
    if (eNombres) setErrorNombres(eNombres);

    const eTelefono = validarTelefono(telefono);
    if (eTelefono) setErrorTelefono(eTelefono);

    if (fechaNacimiento.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento.trim())) {
      setErrorFecha('Formato de fecha: AAAA-MM-DD (ej: 2000-05-15).');
    }

    if (eNombres || eTelefono || (fechaNacimiento.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento.trim()))) {
      anunciar('Revisa los campos con error.');
      return;
    }

    // Payload SOLO con cambios (PATCH parcial, igual que la web)
    const perfil = usuario?.perfil;
    const payload: Record<string, string> = {};

    if (nombres.trim() !== (perfil?.nombres ?? '')) payload.nombres = nombres.trim();
    if (apellidos.trim() !== (perfil?.apellidos ?? '')) payload.apellidos = apellidos.trim();
    if (telefono.trim() !== (perfil?.telefono ?? '')) payload.telefono = telefono.trim();
    if (fechaNacimiento.trim() !== (perfil?.fecha_nacimiento ?? ''))
      payload.fecha_nacimiento = fechaNacimiento.trim();

    const nuevoIdioma = idiomaIngles ? 'en' : 'es';
    if (nuevoIdioma !== (perfil?.idioma ?? 'es')) payload.idioma = nuevoIdioma;

    if (Object.keys(payload).length === 0) {
      setMensaje({ variante: 'info', texto: 'No hay cambios por guardar.' });
      return;
    }

    setGuardandoDatos(true);
    try {
      await actualizarMiPerfil(payload as never);
      await refrescarPerfil();
      setMensaje({ variante: 'exito', texto: 'Perfil actualizado correctamente.' });
      anunciar('Perfil actualizado correctamente.');
    } catch (e) {
      const m = mensajeDeError(e);
      setMensaje({ variante: 'error', texto: m });
      anunciar(`Error. ${m}`, { forzar: true });
    } finally {
      setGuardandoDatos(false);
    }
  }, [nombres, apellidos, telefono, fechaNacimiento, idiomaIngles, usuario, refrescarPerfil, anunciar]);

  // ═══════════════ SECCIÓN 2: contraseña ═══════════════

  const guardarContrasena = useCallback(async () => {
    setMensaje(null);

    // Espejo de CambiarContrasenaDto (backend)
    let valido = true;

    if (!passActual) {
      setErrorPassActual('Ingresa tu contraseña actual.');
      valido = false;
    }

    const erroresNueva = validarContrasena(passNueva);
    if (erroresNueva.length > 0) {
      setErrorPassNueva(erroresNueva.join(' '));
      valido = false;
    }

    if (passNueva === passActual && passNueva) {
      setErrorPassNueva('La nueva contraseña debe ser diferente a la actual.');
      valido = false;
    }

    if (passConfirmar !== passNueva) {
      setErrorPassConfirmar('Las contraseñas no coinciden.');
      valido = false;
    }

    if (!valido) {
      anunciar('Revisa los campos de contraseña.');
      return;
    }

    setGuardandoPass(true);
    try {
      await cambiarMiContrasena({
        contrasena_actual: passActual,
        contrasena_nueva: passNueva,
      });

      // Limpieza del formulario
      setPassActual('');
      setPassNueva('');
      setPassConfirmar('');
      setErrorPassActual(null);
      setErrorPassNueva(null);
      setErrorPassConfirmar(null);

      setMensaje({ variante: 'exito', texto: 'Contraseña actualizada correctamente.' });
      anunciar('Contraseña actualizada correctamente.');
    } catch (e) {
      const m = mensajeDeError(e);
      setMensaje({ variante: 'error', texto: m });
      anunciar(`Error. ${m}`, { forzar: true });
    } finally {
      setGuardandoPass(false);
    }
  }, [passActual, passNueva, passConfirmar, anunciar]);

  if (cargando || !usuario) {
    return <PantallaCargando mensaje="Cargando tu perfil…" />;
  }

  return (
    <ScrollView
      style={estilos.flex}
      contentContainerStyle={estilos.contenido}
    >
      {/* ─── Mensaje de resultado ─── */}
      {mensaje && (
        <Alerta
          variante={mensaje.variante}
          mensaje={mensaje.texto}
          onCerrar={() => setMensaje(null)}
        />
      )}

      {/* ─── Info fija (no editable) ─── */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.tituloTarjeta}>Cuenta</Text>
        <Text style={estilos.infoLinea}>
          <Text style={estilos.infoEtiqueta}>Correo: </Text>
          {usuario.correo}
        </Text>
        <Text style={estilos.infoLinea}>
          <Text style={estilos.infoEtiqueta}>Rol: </Text>
          {usuario.rol}
        </Text>
        <Text style={estilos.infoLinea}>
          <Text style={estilos.infoEtiqueta}>Último acceso: </Text>
          {usuario.ultimo_acceso
            ? new Date(usuario.ultimo_acceso).toLocaleString('es')
            : '—'}
        </Text>
      </View>

      {/* ─── Datos personales (edición) ─── */}
      <Text style={estilos.tituloSeccion}>Datos personales</Text>

      <CampoTexto
        etiqueta="Nombres"
        valor={nombres}
        onChangeText={(t) => {
          setNombres(t);
          setErrorNombres(null);
        }}
        autoCapitalizar="words"
        error={errorNombres}
      />

      <CampoTexto
        etiqueta="Apellidos"
        valor={apellidos}
        onChangeText={setApellidos}
        autoCapitalizar="words"
      />

      <CampoTexto
        etiqueta="Teléfono"
        valor={telefono}
        onChangeText={(t) => {
          setTelefono(t);
          setErrorTelefono(null);
        }}
        placeholder="+591 70011122"
        tipoTeclado="phone-pad"
        error={errorTelefono}
      />

      <CampoTexto
        etiqueta="Fecha de nacimiento"
        valor={fechaNacimiento}
        onChangeText={(t) => {
          setFechaNacimiento(t);
          setErrorFecha(null);
        }}
        placeholder="AAAA-MM-DD"
        tipoTeclado="numbers-and-punctuation"
        hint="Formato: AAAA-MM-DD (opcional)"
        error={errorFecha}
      />

      <Toggle
        etiqueta="Idioma en inglés"
        descripcion="Desactivado = español (default)"
        valor={idiomaIngles}
        onCambiar={setIdiomaIngles}
      />

      <Boton
        etiqueta="Guardar datos"
        onPress={() => void guardarDatos()}
        cargando={guardandoDatos}
      />

      {/* ─── Cambio de contraseña ─── */}
      <Text style={estilos.tituloSeccion}>Cambiar contraseña</Text>

      <CampoTexto
        etiqueta="Contraseña actual"
        valor={passActual}
        onChangeText={(t) => {
          setPassActual(t);
          setErrorPassActual(null);
        }}
        esContrasena
        error={errorPassActual}
      />

      <CampoTexto
        etiqueta="Nueva contraseña"
        valor={passNueva}
        onChangeText={(t) => {
          setPassNueva(t);
          setErrorPassNueva(null);
        }}
        esContrasena
        hint="Mínimo 8 caracteres, con mayúscula, minúscula y número."
        error={errorPassNueva}
      />

      <CampoTexto
        etiqueta="Confirmar nueva contraseña"
        valor={passConfirmar}
        onChangeText={(t) => {
          setPassConfirmar(t);
          setErrorPassConfirmar(null);
        }}
        esContrasena
        error={errorPassConfirmar}
      />

      <Boton
        etiqueta="Cambiar contraseña"
        onPress={() => void guardarContrasena()}
        cargando={guardandoPass}
        variante="secundario"
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    padding: tamaños.lg,
    paddingBottom: tamaños.xl * 2,
    gap: tamaños.sm,
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
    marginBottom: tamaños.sm,
  },
  tituloTarjeta: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    marginBottom: tamaños.xs,
  },
  infoLinea: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    lineHeight: 22,
  },
  infoEtiqueta: { color: colores.textoSutil, fontWeight: '600' },
  tituloSeccion: {
    color: colores.texto,
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
    marginTop: tamaños.md,
  },
});