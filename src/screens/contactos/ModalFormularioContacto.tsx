import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { actualizarContacto, crearContacto } from '@/api/contactos.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { CampoTexto } from '@/components/CampoTexto';
import { Toggle } from '@/components/Toggle';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import { mensajeDeError, type Contacto } from '@/types';
import { validarCorreo, validarTelefono } from '@/utils/validaciones';

/**
 * ══════════════════════════════════════════════════════
 * Formulario de contacto (crear/editar) en Modal nativo.
 *
 * Validaciones espejo del CrearContactoDto del backend:
 *   - nombre: 2–120 caracteres
 *   - telefono/correo con formato (opcionales)
 *   - AL MENOS UNO de los dos (regla @ValidateIf)
 *   - prioridad: entero ≥ 1 (default 1)
 *
 * El componente se monta fresco en cada apertura (el padre
 * lo renderiza condicionalmente), por eso los useState
 * inicializan directo desde props sin useEffect.
 * ══════════════════════════════════════════════════════
 */

interface Props {
  /** null = modo crear */
  contacto: Contacto | null;
  onCerrar: () => void;
  /** El padre cierra, anuncia por voz y recarga la lista */
  onGuardado: (mensaje: string) => void;
}

interface Errores {
  nombre?: string;
  telefono?: string;
  correo?: string;
  prioridad?: string;
  general?: string;
}

export function ModalFormularioContacto({
  contacto,
  onCerrar,
  onGuardado,
}: Props) {
  const esEdicion = contacto !== null;
  const { anunciar } = useTTS();

  const [nombre, setNombre] = useState(contacto?.nombre ?? '');
  const [parentesco, setParentesco] = useState(
    contacto?.parentesco ?? '',
  );
  const [telefono, setTelefono] = useState(contacto?.telefono ?? '');
  const [correo, setCorreo] = useState(contacto?.correo ?? '');
  const [prioridadTexto, setPrioridadTexto] = useState(
    contacto ? String(contacto.prioridad) : '1',
  );
  const [autorizadoUbicacion, setAutorizadoUbicacion] = useState(
    contacto?.autorizado_ubicacion ?? false,
  );
  const [autorizadoEmergencias, setAutorizadoEmergencias] = useState(
    contacto?.autorizado_emergencias ?? true,
  );

  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);

  function limpiarError(campo: keyof Errores) {
    setErrores((prev) =>
      prev[campo] ? { ...prev, [campo]: undefined } : prev,
    );
  }

  function validar(): boolean {
    const nuevos: Errores = {};

    // nombre (backend: MinLength(2), MaxLength(120))
    const nombreLimpio = nombre.trim();
    if (nombreLimpio.length < 2) {
      nuevos.nombre = 'El nombre debe tener al menos 2 caracteres.';
    } else if (nombreLimpio.length > 120) {
      nuevos.nombre = 'El nombre no puede superar 120 caracteres.';
    }

    // teléfono (formato espejo del backend)
    const telLimpio = telefono.trim();
    const eTel = validarTelefono(telLimpio);
    if (eTel) nuevos.telefono = eTel;

    // correo (formato espejo)
    const correoLimpio = correo.trim().toLowerCase();
    if (correoLimpio) {
      const eCorreo = validarCorreo(correoLimpio);
      if (eCorreo) nuevos.correo = eCorreo;
    }

    // ⚠️ Regla "al menos un medio" (espejo @ValidateIf + CHECK BD)
    if (!telLimpio && !correoLimpio) {
      nuevos.general =
        'Debe proporcionar al menos un teléfono o un correo.';
    }

    // prioridad: entero ≥ 1 (opcional → default 1)
    const prioridadNum = Number(prioridadTexto);
    if (
      prioridadTexto.trim() &&
      (!Number.isInteger(prioridadNum) || prioridadNum < 1)
    ) {
      nuevos.prioridad =
        'La prioridad debe ser un número entero mayor o igual a 1.';
    }

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }

  async function guardar() {
    setErrores({});

    if (!validar()) {
      anunciar('Revisa los campos marcados con error.');
      return;
    }

    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        ...(parentesco.trim() && { parentesco: parentesco.trim() }),
        ...(telefono.trim() && { telefono: telefono.trim() }),
        ...(correo.trim() && { correo: correo.trim().toLowerCase() }),
        prioridad: Number(prioridadTexto) || 1,
        autorizado_ubicacion: autorizadoUbicacion,
        autorizado_emergencias: autorizadoEmergencias,
      };

      if (esEdicion && contacto) {
        await actualizarContacto(contacto.id_contacto, payload);
      } else {
        await crearContacto(payload);
      }

      // Éxito → el padre desmonta el modal (no liberamos guardando)
      onGuardado(
        esEdicion
          ? `Contacto ${nombre.trim()} actualizado.`
          : `Contacto ${nombre.trim()} agregado.`,
      );
    } catch (e) {
      const m = mensajeDeError(e);
      setErrores({ general: m });
      anunciar(`Error. ${m}`, { forzar: true });
      setGuardando(false);
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onCerrar}
      accessibilityLabel={
        esEdicion ? 'Editar contacto' : 'Nuevo contacto'
      }
    >
      <View style={estilos.contenedor}>
        {/* ─── Cabecera ─── */}
        <View style={estilos.cabecera}>
          <Text style={estilos.titulo}>
            {esEdicion ? 'Editar contacto' : 'Nuevo contacto'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar formulario"
            onPress={onCerrar}
            hitSlop={8}
            style={estilos.cerrar}
          >
            <Text style={estilos.cerrarIcono}>✕</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={estilos.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={estilos.flex}
            contentContainerStyle={estilos.formulario}
            keyboardShouldPersistTaps="handled"
          >
            {errores.general && (
              <Alerta
                variante="error"
                mensaje={errores.general}
                onCerrar={() => limpiarError('general')}
              />
            )}

            <CampoTexto
              etiqueta="Nombre *"
              valor={nombre}
              onChangeText={(t) => {
                setNombre(t);
                limpiarError('nombre');
              }}
              placeholder="Rosa Pérez"
              autoCapitalizar="words"
              error={errores.nombre}
            />

            <CampoTexto
              etiqueta="Parentesco (opcional)"
              valor={parentesco}
              onChangeText={setParentesco}
              placeholder="Madre, hermano, vecino…"
              autoCapitalizar="sentences"
            />

            <CampoTexto
              etiqueta="Teléfono"
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
              etiqueta="Correo electrónico"
              valor={correo}
              onChangeText={(t) => {
                setCorreo(t);
                limpiarError('correo');
              }}
              placeholder="rosa@correo.com"
              tipoTeclado="email-address"
              error={errores.correo}
              hint="Al menos teléfono o correo son obligatorios."
            />

            <CampoTexto
              etiqueta="Prioridad de notificación"
              valor={prioridadTexto}
              onChangeText={(t) => {
                setPrioridadTexto(t);
                limpiarError('prioridad');
              }}
              placeholder="1"
              tipoTeclado="number-pad"
              error={errores.prioridad}
              hint="1 = el primero en recibir emergencias."
            />

            <Text style={estilos.tituloSeccion}>Autorizaciones</Text>

            <Toggle
              etiqueta="Recibir mi ubicación"
              descripcion="Podrá ver dónde estás cuando lo autorices"
              valor={autorizadoUbicacion}
              onCambiar={setAutorizadoUbicacion}
            />

            <Toggle
              etiqueta="Recibir emergencias"
              descripcion="Recibirá tus solicitudes de ayuda (Sprint 3)"
              valor={autorizadoEmergencias}
              onCambiar={setAutorizadoEmergencias}
            />

            <View style={estilos.acciones}>
              <Boton
                etiqueta="Cancelar"
                variante="secundario"
                onPress={onCerrar}
                deshabilitado={guardando}
              />
              <View style={estilos.espacioBotones} />
              <Boton
                etiqueta={esEdicion ? 'Guardar cambios' : 'Agregar contacto'}
                onPress={() => void guardar()}
                cargando={guardando}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  flex: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tamaños.lg,
    paddingTop: tamaños.xl,
    paddingBottom: tamaños.md,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  titulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
  },
  cerrar: {
    width: tamaños.iconoBoton,
    height: tamaños.iconoBoton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cerrarIcono: { color: colores.texto, fontSize: 22, fontWeight: '700' },
  formulario: {
    padding: tamaños.lg,
    paddingBottom: tamaños.xl * 2,
  },
  tituloSeccion: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
    marginTop: tamaños.sm,
    marginBottom: tamaños.sm,
  },
  acciones: {
    marginTop: tamaños.lg,
  },
  espacioBotones: { height: tamaños.sm },
});