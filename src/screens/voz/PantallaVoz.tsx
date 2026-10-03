import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { interpretarComando } from '@/api/voz.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { colores, tamaños } from '@/constants/tema';
import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import type { AppTabsParamList } from '@/navigation/NavigationTypes';
import {
  cancelarEscucha,
  escucharUnaVez,
} from '@/services/stt.service';
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
 *          → Sprint 3 (por ahora: anuncio de preparación)
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

  /** Ejecuta la accion_app devuelta por el backend */
  const ejecutarAccion = useCallback(
    (accion: string) => {
      switch (accion) {
        // ─── Flujos de cámara (Tanda 10 los completa) ───
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
          navigation.navigate('Camara');
          break;

        // ─── Seguridad / ayuda (Sprint 3) ───
        case 'ABRIR_SOLICITUD_AYUDA':
        case 'COMPARTIR_UBICACION':
          setEstado('La solicitud de ayuda estará disponible en el Sprint 3.');
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
    [navigation],
  );

  // ═══════════════ FLUJO COMPARTIDO ═══════════════

  /** Envía el texto al backend, ejecuta la acción y habla */
  const procesarComando = useCallback(
    async (comando: string, fuente: '🎤' | '⌨️') => {
      const limpio = comando.trim();
      if (!limpio || procesando) return;

      setProcesando(true);
      setError(null);
      setEstado('Procesando…');

      try {
        const respuesta = await interpretarComando({
          comando: limpio,
        });

        // Registrar en historial de sesión
        setHistorial((prev) =>
          [
            {
              id: `${Date.now()}`,
              comando: respuesta.comando,
              intencion: respuesta.intencion,
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
        ejecutarAccion(respuesta.accion_app);
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
    setEstado('🎧 Escuchando… di tu comando');
    anunciar('Te escucho', { forzar: true });

    const resultado = await escucharUnaVez();

    if (!refMontado.current) return;
    setEscuchando(false);

    if (resultado.ok) {
      setEstado(`Reconocido: "${resultado.texto}"`);
      await procesarComando(resultado.texto, '🎤');
    } else {
      switch (resultado.razon) {
        case 'no-disponible':
          setEstado('Reconocimiento no disponible — usa el teclado ↓');
          anunciar(
            'Reconocimiento de voz no disponible en este modo. Escribe tu comando abajo.',
            { forzar: true },
          );
          break;
        case 'permiso-denegado':
          setEstado('Permiso de micrófono denegado');
          anunciar(
            'Necesito permiso del micrófono. Actívalo en ajustes o usa el teclado.',
            { forzar: true },
          );
          break;
        case 'sin-voz':
          setEstado('No escuché nada — intenta de nuevo');
          anunciar('No escuché nada. Intenta de nuevo.');
          break;
        case 'timeout':
          setEstado('Tiempo agotado — intenta de nuevo');
          anunciar('Tiempo agotado. Intenta de nuevo.');
          break;
        case 'cancelado':
          setEstado('Escucha cancelada.');
          break;
        default:
          setEstado('Error de reconocimiento — intenta de nuevo');
          anunciar('Hubo un error de reconocimiento. Intenta de nuevo.');
      }
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
                  → {h.intencion}
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
    paddingBottom: tamaños.xl * 2,
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