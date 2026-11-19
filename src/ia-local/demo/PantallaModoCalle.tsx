/**
 * ══════════════════════════════════════════════════════
 * DEMO — MODO CALLE (N3-2) para la defensa de P4.
 *
 * Pantalla autocontenida que demuestra el detector de
 * calle embebido (COCO-SSD, ver README-PASO2B.md):
 *   1. Captura con la cámara y detecta DIRECTAMENTE en el
 *      teléfono (personas, vehículos, objetos, señales).
 *   2. Habla los objetos MÁS CERCANOS primero, con distancia
 *      aproximada: "Persona a unos 2 metros. Bus a unos 8 metros."
 *   3. MODO AUTO: detección automática cada 5 s (asistencia
 *      continua) o botón manual.
 *   4. Para la defensa: activar MODO AVIÓN y repetir —
 *      funciona igual (sin internet).
 *
 * Distancia: geométrica (estenopeana) — proximidad exacta,
 * metraje ±30-50% (ver README-PASO2B.md §2).
 * ══════════════════════════════════════════════════════
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useTTS } from '@/hooks/useTTS';

import {
  cargarModeloCalle,
  construirAnuncioCalle,
  detectarCalle,
  resumenModeloCalle,
  useConexion,
} from '../index';
import type { DeteccionCalle } from '../index';

// Paleta local (consistente con el tema oscuro de la app)
const COLORES = {
  fondo: '#0f172a',
  panel: '#1e293b',
  borde: '#334155',
  texto: '#f1f5f9',
  textoSuave: '#94a3b8',
  acento: '#22d3ee',
  ok: '#34d399',
  error: '#f87171',
};

const EMOJIS: Record<DeteccionCalle['categoria'], string> = {
  PERSONA: '🚶',
  VEHICULO: '🚗',
  ANIMAL: '🐕',
  'SEÑAL': '🚦',
  OBJETO: '📦',
};

const INTERVALO_AUTO_MS = 5000;

export default function PantallaModoCalle() {
  const { anunciar } = useTTS();
  const { conectado, tipo } = useConexion();
  const [permiso, pedirPermiso] = useCameraPermissions();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [backend, setBackend] = useState<string>('—');
  const [ocupado, setOcupado] = useState(false);
  const [auto, setAuto] = useState(false);
  const [detecciones, setDetecciones] = useState<DeteccionCalle[]>([]);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);

  const info = resumenModeloCalle();

  /** ¿El detector de calle está en condiciones de analizar? */
  const listo =
    !cargando && errorCarga === null && (permiso?.granted ?? false);

  // Cargar el grafo embebido al entrar (con TTS de accesibilidad)
  useEffect(() => {
    let montado = true;
    (async () => {
      try {
        await cargarModeloCalle();
        if (!montado) return;
        setBackend(tf.getBackend());
        setCargando(false);
        anunciar('Modo calle listo. Te aviso lo que veo alrededor.');
      } catch (error) {
        if (!montado) return;
        setErrorCarga(
          error instanceof Error ? error.message : String(error),
        );
        setCargando(false);
      }
    })();
    return () => {
      montado = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camaraRef = useRef<any>(null);

  /** Captura + detección local + voz. Reutilizable (manual y auto). */
  const capturarYAnunciar = useCallback(async () => {
    if (!listo) return;
    setOcupado(true);
    setErrorAnalisis(null);
    try {
      const foto = await camaraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (!foto?.uri) throw new Error('No se obtuvo la foto');

      const dets = await detectarCalle(foto.uri, {
        puntajeMin: 0.55,
        maxDetecciones: 6,
      });
      setDetecciones(dets);

      const texto = construirAnuncioCalle(dets, 3);
      setAnuncio(texto);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      anunciar(texto);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorAnalisis(msg);
      anunciar('Error al analizar la calle.');
    } finally {
      setOcupado(false);
    }
  }, [listo, anunciar]);

  // MODO AUTO: detecta cada 5 s mientras esté encendido
  useEffect(() => {
    if (!auto || !listo) return;
    const id = setInterval(() => {
      void capturarYAnunciar();
    }, INTERVALO_AUTO_MS);
    return () => clearInterval(id);
  }, [auto, listo, capturarYAnunciar]);

  const textoDistancia = (d: DeteccionCalle): string =>
    d.distanciaM !== null ? `${d.distanciaM.toFixed(1)} m` : '—';

  return (
    <View style={estilos.raiz}>
      <Text style={estilos.titulo}>🛣️ MODO CALLE — detector embebido</Text>
      <Text style={estilos.subtitulo}>
        {info.nombre} · {info.motor} · {info.clasesCoco} clases ·{' '}
        {info.pesosMb} MB · corre sin internet
      </Text>

      {/* Estado de la red */}
      <View style={estilos.filaChips}>
        <View style={[estilos.chip, conectado ? estilos.chipOk : estilos.chipError]}>
          <Text style={estilos.chipTexto}>
            {conectado
              ? `🌐 internet ${tipo ?? ''}`
              : '✈️ sin internet'}
          </Text>
        </View>
        <View style={estilos.chip}>
          <Text style={estilos.chipTexto}>TF.js backend: {backend}</Text>
        </View>
      </View>

      {/* Estado de carga del modelo */}
      {cargando && (
        <View style={estilos.panel}>
          <ActivityIndicator color={COLORES.acento} />
          <Text style={estilos.textoSuave}>Cargando detector de calle…</Text>
        </View>
      )}
      {errorCarga && (
        <View style={[estilos.panel, { borderColor: COLORES.error }]}>
          <Text style={estilos.textoError}>No se pudo cargar: {errorCarga}</Text>
        </View>
      )}

      {/* Cámara */}
      {permiso?.granted && !cargando && !errorCarga && (
        <View style={estilos.camara}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" ref={camaraRef} />
        </View>
      )}
      {permiso && !permiso.granted && (
        <View style={estilos.panel}>
          <Text style={estilos.textoSuave}>
            Se necesita la cámara para el modo calle.
          </Text>
          <Pressable style={estilos.boton} onPress={() => pedirPermiso()}>
            <Text style={estilos.botonTexto}>Dar permiso</Text>
          </Pressable>
        </View>
      )}

      {/* Interruptor MODO AUTO */}
      <View style={[estilos.panel, estilos.filaAuto]}>
        <Text style={estilos.textoSuave}>
          MODO AUTO (avisa cada {INTERVALO_AUTO_MS / 1000} s)
        </Text>
        <Switch
          value={auto}
          onValueChange={(v) => {
            setAuto(v);
            anunciar(v ? 'Modo automático activado.' : 'Modo automático desactivado.');
          }}
          disabled={!listo}
          trackColor={{ true: COLORES.acento, false: COLORES.borde }}
          accessibilityLabel="Activar detección automática de calle"
        />
      </View>

      {/* Resultado: lo que ve, ordenado por cercanía */}
      {detecciones.length > 0 && (
        <View style={estilos.panel}>
          <Text style={estilos.tituloLista}>
            Lo que veo (lo más cerca primero):
          </Text>
          {detecciones.map((d, i) => (
            <Text key={`${d.claseCoco}-${i}`} style={estilos.filaDeteccion}>
              {EMOJIS[d.categoria]} {d.etiqueta} · ~{textoDistancia(d)} ·{' '}
              {Math.round(d.puntaje * 100)}%
            </Text>
          ))}
          {anuncio && (
            <Text style={estilos.anuncio}>🔊 “{anuncio}”</Text>
          )}
        </View>
      )}
      {!ocupado && detecciones.length === 0 && anuncio !== null && (
        <View style={estilos.panel}>
          <Text style={estilos.textoSuave}>
            {anuncio} — acerca el teléfono o repite la captura.
          </Text>
        </View>
      )}
      {errorAnalisis && (
        <View style={[estilos.panel, { borderColor: COLORES.error }]}>
          <Text style={estilos.textoError}>Error: {errorAnalisis}</Text>
        </View>
      )}

      {/* Botón manual */}
      <Pressable
        style={[estilos.botonGrande, (!listo || ocupado) && estilos.botonDeshabilitado]}
        onPress={() => void capturarYAnunciar()}
        disabled={!listo || ocupado}
        accessibilityLabel="Mirar la calle ahora y anunciar por voz"
      >
        <Text style={estilos.botonTexto}>
          {ocupado ? '⏳ Mirando la calle…' : '👁️ ¿Qué hay al frente?'}
        </Text>
      </Pressable>

      <Text style={estilos.pie}>
        Prueba P4: activa MODO AVIÓN y repite — la detección y la voz siguen
        funcionando. Distancia aproximada (±30-50%): orientación, no medición.
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: COLORES.fondo, padding: 16, gap: 12 },
  titulo: { color: COLORES.texto, fontSize: 20, fontWeight: '700' },
  subtitulo: { color: COLORES.textoSuave, fontSize: 13 },
  filaChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: COLORES.panel,
    borderColor: COLORES.borde,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipOk: { borderColor: COLORES.ok },
  chipError: { borderColor: COLORES.error },
  chipTexto: { color: COLORES.texto, fontSize: 12 },
  camara: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  panel: {
    backgroundColor: COLORES.panel,
    borderColor: COLORES.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  filaAuto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloLista: { color: COLORES.texto, fontSize: 14, fontWeight: '700' },
  filaDeteccion: { color: COLORES.texto, fontSize: 15 },
  anuncio: { color: COLORES.acento, fontSize: 13, marginTop: 4 },
  textoSuave: { color: COLORES.textoSuave, fontSize: 13 },
  textoError: { color: COLORES.error, fontSize: 13 },
  boton: {
    backgroundColor: COLORES.acento,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  botonGrande: {
    backgroundColor: COLORES.acento,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  botonDeshabilitado: { opacity: 0.4 },
  botonTexto: { color: COLORES.fondo, fontWeight: '700', fontSize: 15 },
  pie: { color: COLORES.textoSuave, fontSize: 11, textAlign: 'center' },
});
