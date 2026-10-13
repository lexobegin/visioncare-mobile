import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { interpretarComando } from '@/api/voz.api';
import { listarMisContactos } from '@/api/contactos.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { colores, tamaños } from '@/constants/tema';
import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import type {
  AccionAnalisisVisual,
  AppTabsParamList,
} from '@/navigation/NavigationTypes';
import {
  cancelarEscucha,
  escucharUnaVez,
} from '@/services/stt.service';
import { obtenerUbicacion } from '@/services/location.service';
import { useNavigation } from '@react-navigation/native';
import type {
  BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Comandos de voz (CU06) — flujo completo:
 *
 *   1. Botón de micrófono → escucharUnaVez() [STT nativo]
 *   2. Texto → POST /voz/interpretar (backend)
 *   3. Respuesta → accion_app SE EJECUTA aquí:
 *        RECONOCER_OBJETOS / CAPTURAR_ENTORNO / LEER_TEXTO
 *          → navega a la Cámara (Tanda 10 ejecuta el análisis)
 *        ABRIR_SOLICITUD_AYUDA / COMPARTIR_UBICACION
 *          → prepara SMS para contacto autorizado (confirmación manual)
 *        VER_HISTORIAL / NINGUNA (desconocida)
 *          → solo respuesta hablada
 *   4. respuesta_voz → TTS (siempre, es la respuesta del sistema)
 *   5. Historial de la sesión (últimos 5)
 *
 * FALLBACK (Expo Go / sin STT): campo de texto con el MISMO
 * flujo — el usuario escribe "que ves" y todo funciona igual.
 * ══════════════════════════════════════════════════════
 */

interface EntradaSesion {
  id: string;
  comando: string;
  intencion: string;
  accion: string;
  fuente: '🎤' | '⌨️';
}

const LIMITE_HISTORIAL = 5;

export default function PantallaVoz() {
  const { anunciar } = useTTS();
  const { preferencias } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();

  const [procesando, setProcesando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [textoManual, setTextoManual] = useState('');
  const [historial, setHistorial] = useState<EntradaSesion[]>([]);

  const refMontado = useRef(true);
  useEffect(() => {
    refMontado.current = true;
    return () => {
      refMontado.current = false;
      cancelarEscucha();
    };
  }, []);

  // Anuncio de pantalla + detección de disponibilidad STT
  useEffect(() => {
    anunciar(
      'Pantalla de comandos de voz. Pulsa el botón grande y di qué necesitas. También puedes escribir tu comando.',
    );
  }, [anunciar]);

  // ═══════════════ EJECUTOR DE ACCIONES ═══════════════

  /** Abre un borrador SMS para el contacto activo autorizado de mayor prioridad. */
  const contactarContactoDeConfianza = useCallback(
    async (accion: 'ABRIR_SOLICITUD_AYUDA' | 'COMPARTIR_UBICACION') => {
      const esAyuda = accion === 'ABRIR_SOLICITUD_AYUDA';
      setEstado(esAyuda ? 'Preparando solicitud de ayuda…' : 'Obteniendo ubicación…');

      try {
        const ubicacion = await obtenerUbicacion();
        if (!esAyuda && !ubicacion) {
          setEstado('No se pudo obtener la ubicación. Revisa el permiso y el GPS.');
          anunciar('No pude obtener tu ubicación. Revisa el permiso y el GPS.', {
            forzar: true,
          });
          return;
        }

        const respuesta = await listarMisContactos({
          page: 1,
          limit: 50,
          estado: 'ACTIVO',
        });
        const contacto = respuesta.datos.find(
          (item) =>
            (esAyuda
              ? item.autorizado_emergencias
              : item.autorizado_ubicacion) &&
            Boolean(item.telefono?.trim()),
        );

        if (!contacto?.telefono) {
          setEstado(
            esAyuda
              ? 'No hay un contacto activo autorizado para emergencias con teléfono.'
              : 'No hay un contacto activo autorizado para ubicación con teléfono.',
          );
          navigation.navigate('Mas', { screen: 'Contactos' });
          return;
        }

        const enlaceMapa = ubicacion
          ? `https://maps.google.com/?q=${ubicacion.latitud},${ubicacion.longitud}`
          : null;
        const mensaje = esAyuda
          ? `Necesito ayuda.${enlaceMapa ? ` Mi ubicación: ${enlaceMapa}` : ' No pude obtener mi ubicación.'}`
          : `Comparto mi ubicación: ${enlaceMapa}`;
        const telefono = contacto.telefono.replace(/[^\d+]/g, '');
        const separador = Platform.OS === 'ios' ? '&' : '?';

        await Linking.openURL(
          `sms:${telefono}${separador}body=${encodeURIComponent(mensaje)}`,
        );
        const confirmacion = `Se abrió un mensaje para ${contacto.nombre}. Revisa y confirma el envío.`;
        setEstado(confirmacion);
        anunciar(confirmacion, { forzar: true });
      } catch (e) {
        const m = mensajeDeError(e);
        setError(m);
        anunciar(`No pude preparar el mensaje. ${m}`, { forzar: true });
      }
    },
    [anunciar, navigation],
  );

  /** Ejecuta la accion_app devuelta por el backend */
  const ejecutarAccion = useCallback(
    async (accion: string) => {
      switch (accion) {
        // ─── Flujos de cámara ───
        case 'RECONOCER_OBJETOS':
        case 'CAPTURAR_ENTORNO':
        case 'ABRIR_CAMARA':
        case 'LEER_TEXTO':
        case 'DESCRIBIR_ENTORNO':
        case 'DETECTAR_OBSTACULOS':
        case 'RECONOCER_SENALES':
        case 'RECONOCER_PRODUCTOS':
        case 'RECONOCER_COLORES':
        case 'RECONOCER_BILLETES':
          navigation.navigate('Camara', {
            accion: accion as AccionAnalisisVisual,
          });
          break;

        case 'ABRIR_SOLICITUD_AYUDA':
        case 'COMPARTIR_UBICACION':
          await contactarContactoDeConfianza(accion);
          break;

        // ─── Solo informativas ───
        case 'VER_HISTORIAL':
          setEstado('El historial completo estará disponible en el Sprint 3.');
          break;

        case 'NINGUNA':
        default:
          // Desconocida: solo la respuesta del backend (ya hablada)
          break;
      }
    },
    [contactarContactoDeConfianza, navigation],
  );

  // ═══════════════ FLUJO COMPARTIDO ═══════════════

  /** Envía el texto al backend, ejecuta la acción y habla */
  const procesarComando = useCallback(
    async (
      comando: string,
      fuente: '🎤' | '⌨️',
      confianzaStt?: number | null,
    ) => {
      const limpio = comando.trim();
      if (!limpio || procesando) return;

      setProcesando(true);
      setError(null);
      setEstado('Procesando…');

      try {
        const respuesta = await interpretarComando({
          comando: limpio,
          ...(typeof confianzaStt === 'number' && {
            confianza_stt: confianzaStt,
          }),
        });

        // Registrar en historial de sesión
        setHistorial((prev) =>
          [
            {
              id: String(respuesta.id_comando),
              comando: respuesta.comando,
              intencion: respuesta.intencion,
              accion: respuesta.accion_app,
              fuente,
            },
            ...prev,
          ].slice(0, LIMITE_HISTORIAL),
        );

        // La respuesta del sistema SIEMPRE se habla
        anunciar(respuesta.respuesta_voz);

        setEstado(
          respuesta.intencion === 'DESCONOCIDA'
            ? `No entendido — prueba: "¿qué ves?", "lee esto", "ayuda"`
            : `${respuesta.intencion} · confianza ${(respuesta.confianza * 100).toFixed(0)}%`,
        );

        // Ejecutar la acción (puede navegar)
        await ejecutarAccion(respuesta.accion_app);
      } catch (e) {
        const m = mensajeDeError(e);
        setError(m);
        anunciar(`Error. ${m}`, { forzar: true });
      } finally {
        if (refMontado.current) setProcesando(false);
      }
    },
    [procesando, anunciar, ejecutarAccion],
  );

  // ═══════════════ MICRÓFONO (STT) ═══════════════

  const manejarMicrofono = useCallback(async () => {
    if (escuchando) {
      cancelarEscucha();
      setEscuchando(false);
      setEstado('Escucha cancelada.');
      return;
    }

    setError(null);
    setEscuchando(true);
    setError(null);
    setEstado('Preparando el micrófono…');

    try {
      const resultado = await escucharUnaVez({
        onInicio: () => {
          setEstado('🎧 Escuchando… di tu comando');
          anunciar('Te escucho', { forzar: true });
        },
        onParcial: (texto) => setEstado(`Te entendí: “${texto}”`),
      });

      if (!refMontado.current) return;
      setEscuchando(false);

      if (resultado.ok) {
        setEstado(`Reconocido: “${resultado.texto}”`);
        await procesarComando(resultado.texto, '🎤', resultado.confianza);
        return;
      }

      let mensajeError: string | null = null;
      switch (resultado.razon) {
        case 'no-disponible':
          setEstado('Reconocimiento no disponible — usa el teclado ↓');
          mensajeError =
            'El servicio de reconocimiento no está disponible en este dispositivo. Puedes escribir el comando abajo.';
          break;
        case 'permiso-denegado':
          setEstado('No se pudo acceder al micrófono');
          mensajeError =
            resultado.detalle === 'audio-capture'
              ? 'No se pudo iniciar la captura del micrófono. Cierra otras apps que puedan estar usándolo y vuelve a intentarlo.'
              : 'El permiso de micrófono o reconocimiento está denegado. Revísalo en los ajustes de la app y vuelve a intentarlo.';
          break;
        case 'sin-voz':
          setEstado('No escuché nada — intenta de nuevo');
          mensajeError =
            'No detecté voz. Mantén el teléfono cerca y prueba otra vez.';
          break;
        case 'timeout':
          setEstado('Tiempo agotado — intenta de nuevo');
          mensajeError = 'La escucha tardó demasiado. Puedes volver a intentarlo.';
          break;
        case 'cancelado':
          setEstado('Escucha cancelada.');
          break;
        default:
          setEstado('Error de reconocimiento — intenta de nuevo');
          mensajeError = resultado.detalle
            ? `Falló el reconocimiento de voz (${resultado.detalle}). Vuelve a intentarlo o usa el teclado.`
            : 'Falló el reconocimiento de voz. Vuelve a intentarlo o usa el teclado.';
      }

      setError(mensajeError);
      if (resultado.razon !== 'cancelado') {
        anunciar(
          mensajeError ?? 'No se completó el reconocimiento. Puedes intentarlo otra vez.',
          { forzar: true },
        );
      }
    } catch (e) {
      if (!refMontado.current) return;
      setError(
        e instanceof Error
          ? `No se pudo iniciar la escucha: ${e.message}`
          : 'No se pudo iniciar la escucha. Vuelve a intentarlo o usa el teclado.',
      );
      setEstado('Error de reconocimiento — intenta de nuevo');
    } finally {
      if (refMontado.current) setEscuchando(false);
    }
  }, [escuchando, anunciar, procesarComando]);

  // ═══════════════ RENDER ═══════════════

  const vozDesactivada = preferencias?.voz_habilitada === false;

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
        {/* ─── Estado de la voz (aviso si CU03 la apagó) ─── */}
        {vozDesactivada && (
          <Alerta
            variante="advertencia"
            mensaje="Tu asistente de voz está desactivado (Accesibilidad). Las respuestas se mostrarán solo en texto."
          />
        )}

        {error && (
          <Alerta variante="error" mensaje={error} onCerrar={() => setError(null)} />
        )}

        {/* ─── Botón principal de micrófono ─── */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            escuchando
              ? 'Escuchando. Pulsa para cancelar.'
              : 'Botón de comando de voz. Pulsa y habla.'
          }
          accessibilityState={{ busy: procesando }}
          onPress={() => void manejarMicrofono()}
          disabled={procesando}
          style={({ pressed }) => [
            estilos.microfono,
            escuchando && estilos.microfonoActivo,
            procesando && { opacity: 0.6 },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text aria-hidden style={estilos.microIcono}>
            {escuchando ? '🎧' : '🎤'}
          </Text>
          <Text style={estilos.microTitulo}>
            {escuchando
              ? 'Escuchando… (toca para cancelar)'
              : procesando
                ? 'Procesando…'
                : 'Pulsa y habla'}
          </Text>
        </Pressable>

        {/* ─── Estado del flujo ─── */}
        {estado && (
          <View
            style={estilos.estadoCaja}
            accessibilityLiveRegion="polite"
          >
            <Text style={estilos.estadoTexto}>{estado}</Text>
          </View>
        )}

        {/* ─── Fallback por teclado ─── */}
        <View style={estilos.manual}>
          <Text style={estilos.manualTitulo}>
            ⌨️  ¿No puedes hablar ahora? Escribe tu comando:
          </Text>
          <TextInput
            style={estilos.manualInput}
            value={textoManual}
            onChangeText={setTextoManual}
            placeholder='Ej: ¿qué ves?, lee esto, ayuda…'
            placeholderTextColor={colores.textoSutil}
            multiline
            accessibilityLabel="Escribir comando de voz"
            onSubmitEditing={() => {
              const t = textoManual.trim();
              if (t) {
                void procesarComando(t, '⌨️');
                setTextoManual('');
              }
            }}
          />
          <Boton
            etiqueta="Enviar comando"
            onPress={() => {
              const t = textoManual.trim();
              if (t) {
                void procesarComando(t, '⌨️');
                setTextoManual('');
              }
            }}
            cargando={procesando}
            deshabilitado={!textoManual.trim()}
          />
        </View>

        {/* ─── Ayuda de comandos ─── */}
        <View style={estilos.ayuda}>
          <Text style={estilos.ayudaTitulo}>Prueba decir:</Text>
          <Text style={estilos.ayudaItem}>• "¿Qué ves?" → reconoce objetos</Text>
          <Text style={estilos.ayudaItem}>• "Lee esto" → lee textos (OCR)</Text>
          <Text style={estilos.ayudaItem}>• "¿De qué color es?" → colores</Text>
          <Text style={estilos.ayudaItem}>• "Ayuda" → contactos de confianza</Text>
          <Text style={estilos.ayudaItem}>• "Captura" → abre la cámara</Text>
        </View>

        {/* ─── Historial de la sesión ─── */}
        {historial.length > 0 && (
          <View style={estilos.historial}>
            <Text style={estilos.historialTitulo}>
              Comandos de esta sesión:
            </Text>
            {historial.map((h) => (
              <View key={h.id} style={estilos.historialItem}>
                <Text style={estilos.historialFuente} aria-hidden>
                  {h.fuente}
                </Text>
                <Text style={estilos.historialComando} numberOfLines={1}>
                  {h.comando}
                </Text>
                <Text style={estilos.historialIntencion} numberOfLines={1}>
                  → {h.intencion} · {h.accion}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    padding: tamaños.lg,
    paddingBottom: 120,
    gap: tamaños.md,
  },

  microfono: {
    backgroundColor: colores.primario,
    borderRadius: tamaños.radioLG * 2,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tamaños.sm,
    padding: tamaños.lg,
  },
  microfonoActivo: {
    backgroundColor: colores.peligro,
  },
  microIcono: { fontSize: 64 },
  microTitulo: {
    color: '#ffffff',
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
    textAlign: 'center',
  },

  estadoCaja: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
  },
  estadoTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    textAlign: 'center',
  },

  manual: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
    gap: tamaños.sm,
  },
  manualTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600',
  },
  manualInput: {
    backgroundColor: colores.superficieClara,
    borderRadius: tamaños.radioMD,
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    minHeight: 72,
    padding: tamaños.md,
    textAlignVertical: 'top',
  },

  ayuda: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  ayudaTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    marginBottom: tamaños.xs,
  },
  ayudaItem: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    lineHeight: 22,
  },

  historial: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  historialTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
    marginBottom: tamaños.xs,
  },
  historialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tamaños.sm,
    paddingVertical: 4,
  },
  historialFuente: { fontSize: 16 },
  historialComando: {
    flex: 1,
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
  },
  historialIntencion: {
    color: colores.primario,
    fontSize: tamaños.fuenteXS,
    fontWeight: '600',
  },
});