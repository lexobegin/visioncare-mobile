/**
 * ══════════════════════════════════════════════════════
 * DEMO — IA LOCAL (N3) para la defensa de P4.
 *
 * Pantalla autocontenida que demuestra el modelo embebido:
 *   1. Muestra estado de TF.js (backend), modelo y red.
 *   2. Captura con la cámara y ejecuta la inferencia
 *      DIRECTAMENTE en el teléfono (no toca el backend).
 *   3. Para la defensa: activar MODO AVIÓN y repetir —
 *      el análisis sigue funcionando (sin internet).
 *
 * Nota: esta demo ejercita SIEMPRE el motor LOCAL para
 * validar N3. La cascada completa (N1→N3) está en
 * `analizarConCascada()` lista para integrarse en
 * PantallaCamara.
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
  Text,
  View,
} from 'react-native';

import { useTTS } from '@/hooks/useTTS';

import {
  cargarModeloLocal,
  infoModeloLocal,
  predecirImagenLocal,
  useConexion,
} from '../index';
import type { ResultadoInferencia } from '../tipos';

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

const EMOJIS: Record<string, string> = {
  'ORGÁNICO': '🍌',
  'RECICLABLE': '♻️',
};
// Las etiquetas del modelo del paso 2 (billetes/productos) caen
// en el fallback genérico '🏷️'.

export default function PantallaDemoIaLocal() {
  const { anunciar } = useTTS();
  const { conectado, tipo } = useConexion();
  const [permiso, pedirPermiso] = useCameraPermissions();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [backend, setBackend] = useState<string>('—');
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoInferencia | null>(null);

  const info = infoModeloLocal();

  /** ¿El motor local está en condiciones de analizar? */
  const listo =
    !cargando && errorCarga === null && (permiso?.granted ?? false);

  // Cargar el modelo embebido al entrar (con TTS de accesibilidad)
  useEffect(() => {
    let montado = true;
    (async () => {
      try {
        await cargarModeloLocal();
        if (!montado) return;
        setBackend(tf.getBackend());
        setCargando(false);
        anunciar('Modelo de inteligencia artificial local listo.');
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

  // Ref de la cámara (API expo-camera v16+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const camaraRef = useRef<any>(null);

  // Capturar + inferencia en el teléfono (motor LOCAL)
  const capturarYAnalizar = useCallback(async () => {
    if (!listo) return;
    setOcupado(true);
    setResultado(null);
    try {
      const foto = await camaraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      if (!foto?.uri) throw new Error('No se obtuvo la foto');
      const r = await predecirImagenLocal(foto.uri);
      setResultado(r);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      anunciar(
        `IA local: ${r.etiqueta}. Confianza ${Math.round(r.confianza * 100)} por ciento.`,
      );
    } catch (error) {
      anunciar('Error al analizar la imagen localmente.');
      setResultado({
        etiqueta: 'ERROR',
        confianza: 0,
        probabilidadBruta: 0,
        latencia_ms: 0,
        backend,
        modelo: `${info.nombre} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      setOcupado(false);
    }
  }, [listo, ocupado, cargando, errorCarga, backend, info.nombre, anunciar]);

  return (
    <View style={estilos.raiz}>
      <Text style={estilos.titulo}>🧠 IA LOCAL — modelo embebido (N3)</Text>
      <Text style={estilos.subtitulo}>
        {info.nombre} · {info.tamanioPesosMb} MB · corre sin internet
      </Text>

      {/* Estado de la red (N1 disponible o no) */}
      <View style={estilos.filaChips}>
        <View style={[estilos.chip, conectado ? estilos.chipOk : estilos.chipError]}>
          <Text style={estilos.chipTexto}>
            {conectado
              ? `🌐 internet ${tipo ?? ''}`
              : '✈️ sin internet → N3'}
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
          <Text style={estilos.textoSuave}>Cargando modelo embebido…</Text>
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
            Se necesita la cámara para la demo del modelo local.
          </Text>
          <Pressable style={estilos.boton} onPress={() => pedirPermiso()}>
            <Text style={estilos.botonTexto}>Dar permiso</Text>
          </Pressable>
        </View>
      )}

      {/* Resultado */}
      {resultado && (
        <View style={estilos.panel}>
          <Text style={estilos.etiqueta}>
            {EMOJIS[resultado.etiqueta] ?? '🏷️'} {resultado.etiqueta}
          </Text>
          <Text style={estilos.detalle}>
            confianza {Math.round(resultado.confianza * 100)}% ·{' '}
            {resultado.latencia_ms} ms · motor LOCAL ({resultado.backend})
          </Text>
        </View>
      )}

      {/* Botón principal */}
      <Pressable
        style={[estilos.botonGrande, !listo && estilos.botonDeshabilitado]}
        onPress={capturarYAnalizar}
        disabled={!listo}
        accessibilityLabel="Capturar y analizar con el modelo local"
      >
        <Text style={estilos.botonTexto}>
          {ocupado ? '⏳ Analizando en el teléfono…' : '📷 Analizar (motor LOCAL)'}
        </Text>
      </Pressable>

      <Text style={estilos.pie}>
        Prueba P4: activa MODO AVIÓN y repite — la inferencia sigue funcionando
        porque el modelo vive dentro de la app.
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
  etiqueta: { color: COLORES.texto, fontSize: 24, fontWeight: '800' },
  detalle: { color: COLORES.textoSuave, fontSize: 12 },
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
