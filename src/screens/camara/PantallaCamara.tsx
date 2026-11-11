import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';

import { registrarCaptura } from '@/api/capturas.api';
import { PanelResultadoAnalisis } from '@/components/PanelResultadoAnalisis';
import { colores, tamaños } from '@/constants/tema';
import { useModoContinuo } from '@/hooks/useModoContinuo';
import { useTTS } from '@/hooks/useTTS';
import type {
  AppTabsParamList,
} from '@/navigation/NavigationTypes';
import { obtenerUbicacion } from '@/services/location.service';
import {
  INFO_TIPO_ANALISIS,
  TIPOS_ANALISIS,
  type CapturaResponse,
  //type FotogramaCapturado,
  type TipoAnalisis,
} from '@/types';
import type { FotogramaCapturado as FotogramaTipo } from '@/services/narracion.service';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Cámara — SPRINT 2 (el gran ensamblaje):
 *
 *   ┌──────────────────────────────────┐
 *   │ 🔄 Banner MODO CONTINUO + chip   │  ← HU17/18/19 vía narracion
 *   ├──────────────────────────────────┤
 *   │ [chips: Objetos|Leer|Señales|…]  │  ← análisis puntual (7)
 *   │                                  │
 *   │      VISTA PREVIA CÁMARA         │
 *   │                                  │
 *   │         ( ⭕ captura )            │  ← usa el tipo elegido
 *   ├──────────────────────────────────┤
 *   │ Panel de resultados por tipo     │  ← PanelResultadoAnalisis
 *   └──────────────────────────────────┘
 *
 * Pre-configuración por VOZ (params de navegación):
 *   { activarModoContinuo: true }   → activa el asistente al llegar
 *   { tipoAnalisis: 'OCR' }         → pre-selecciona el análisis
 * ══════════════════════════════════════════════════════
 */

const MAX_HISTORIAL = 5;

export default function PantallaCamara() {
  const { anunciar } = useTTS();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabsParamList>>();
  const route = useRoute<RouteProp<AppTabsParamList, 'Camara'>>();

  // ─── Cámara ───
  const camaraRef = useRef<CameraView>(null);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [camaraLista, setCamaraLista] = useState(false);

  // ─── Modo Continuo (servicio T17) ───
  const modoContinuo = useModoContinuo(capturarFotograma);

  // ─── Análisis puntual ───
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoAnalisis>('OBJETOS');
  const [procesandoCaptura, setProcesandoCaptura] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<CapturaResponse | null>(null);
  const [historial, setHistorial] = useState<CapturaResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ─── Captura de fotograma para el Modo Continuo (inyectada) ───
  async function capturarFotograma(): Promise<FotogramaTipo | null> {
    try {
      const foto = await camaraRef.current?.takePictureAsync({
        quality: 0.6, // fotogramas efímeros: menos bytes
        skipProcessing: false,
      });
      if (!foto?.uri) return null;
      const fotograma: FotogramaTipo = {
        uri: foto.uri,
        ancho: foto.width,
        alto: foto.height,
      };
      return fotograma;
    } catch {
      return null; // cámara ocupada: el servicio reintenta
    }
  }

  // ─── Pre-configuración por VOZ (params de navegación) ───
  useEffect(() => {
    const params = route.params;
    if (!params) return;

    if (params.activarModoContinuo && !modoContinuo.activo) {
      modoContinuo.activar();
    }
    if (params.tipoAnalisis) {
      setTipoSeleccionado(params.tipoAnalisis);
    }

    // Consumir los params (evita re-activar al re-render)
    navigation.setParams({ activarModoContinuo: undefined, tipoAnalisis: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params]);

  // ─── Anuncio de pantalla (una vez) ───
  useEffect(() => {
    anunciar(
      'Pantalla de cámara. Activa el asistente continuo para que te ' +
        'acompañe, o elige un análisis y pulsa el botón para capturar.',
    );
  }, [anunciar]);

  // ═══════════════ CAPTURA PUNTUAL ═══════════════

  const capturarPuntual = useCallback(async () => {
    if (procesandoCaptura || !camaraLista || modoContinuo.activo) return;

    setProcesandoCaptura(true);
    setError(null);
    anunciar('Capturando', { forzar: true });

    try {
      const foto = await camaraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      if (!foto?.uri) {
        throw new Error('No se pudo capturar la imagen. Intenta de nuevo.');
      }

      const ubicacion = await obtenerUbicacion();

      const respuesta = await registrarCaptura({
        uri: foto.uri,
        tipoAnalisis: tipoSeleccionado,
        reconocer: true,
        origen: 'CAMARA',
        ...(ubicacion && {
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud,
          precisionGps: ubicacion.precision ?? undefined,
        }),
      });

      setUltimoResultado(respuesta);
      setHistorial((prev) => [respuesta, ...prev].slice(0, MAX_HISTORIAL));

      if (respuesta.resumen_voz) {
        anunciar(respuesta.resumen_voz, { forzar: true });
      } else if (respuesta.estado === 'PROCESADA') {
        anunciar('Captura procesada.', { forzar: true });
      } else {
        anunciar(
          'Captura guardada. No pude analizarla ahora, se procesará más tarde.',
          { forzar: true },
        );
      }
    } catch (e) {
      const m = mensajeDeError(e);
      setError(m);
      anunciar(`Error. ${m}`, { forzar: true });
    } finally {
      setProcesandoCaptura(false);
    }
  }, [procesandoCaptura, camaraLista, modoContinuo.activo, tipoSeleccionado, anunciar]);

  // ═══════════════ ALTERNAR MODO CONTINUO ═══════════════

    const alternarModo = useCallback(() => {
    if (modoContinuo.activo) {
      const eraLectura = modoContinuo.estado.modo === 'lectura';
      modoContinuo.desactivar();
      anunciar(
        eraLectura
          ? 'Lectura continua desactivada.'
          : 'Modo asistente desactivado.',
        { forzar: true },
      );
    } else if (tipoSeleccionado === 'OCR') {
      modoContinuo.activar({ modoLectura: true });
      anunciar(
        'Lectura continua activada. Mueve el teléfono hacia el texto ' +
          'que quieras leer; te lo leeré en voz alta.',
        { forzar: true },
      );
    } else {
      modoContinuo.activar();
      anunciar(
        'Modo asistente activado. Te iré informando de lo que hay al frente.',
        { forzar: true },
      );
    }
  }, [modoContinuo, tipoSeleccionado, anunciar]);

  // ═══════════════ PERMISOS (S1) ═══════════════

  if (!permiso) {
    return <PantallaEspera mensaje="Preparando la cámara…" />;
  }

  if (!permiso.granted && !permiso.canAskAgain) {
    return (
      <PanelPermiso
        titulo="Permiso de cámara requerido"
        mensaje="VisionCare AI necesita la cámara para analizar tu entorno. El permiso fue denegado permanentemente: actívalo desde los ajustes del sistema."
        etiquetaBoton="Abrir ajustes"
        accion={() => void Linking.openSettings()}
      />
    );
  }

  if (!permiso.granted) {
    return (
      <PanelPermiso
        titulo="Activa la cámara"
        mensaje="VisionCare AI usa la cámara para reconocer objetos, leer textos y ayudarte a moverte con seguridad. Concede el permiso para continuar."
        etiquetaBoton="Conceder permiso"
        accion={() => void pedirPermiso()}
      />
    );
  }

  // ═══════════════ RENDER PRINCIPAL ═══════════════

  const info = INFO_TIPO_ANALISIS[tipoSeleccionado];

  return (
    <View style={estilos.flex}>
      <CameraView
        ref={camaraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCamaraLista(true)}
        onMountError={() =>
          setError('No se pudo iniciar la cámara. ¿Otra app la está usando?')
        }
      />

      {/* ─── Banner MODO CONTINUO ─── */}
      <View
        style={[
          estilos.bannerModo,
          modoContinuo.activo && estilos.bannerModoActivo,
        ]}
      >
        <View style={estilos.bannerTextos}>
          <Text style={estilos.bannerTitulo}>
            {modoContinuo.estado.modo === 'lectura'
              ? '📖 Lectura continua'
              : '🔄 Asistente continuo'}
            {modoContinuo.activo ? ' · ACTIVO' : ''}
          </Text>
          {modoContinuo.activo ? (
            <ChipEstadoModo
              procesando={modoContinuo.procesando}
              estado={modoContinuo.estado}
            />
          ) : (
            <Text style={estilos.bannerSub}>
              {tipoSeleccionado === 'OCR'
                ? 'Lee en voz alta el texto nuevo que entre al encuadre'
                : 'Narración automática del entorno (manos libres)'}
            </Text>
          )}
        </View>

        <Switch
          value={modoContinuo.activo}
          onValueChange={alternarModo}
          trackColor={{ false: colores.superficieClara, true: colores.exito }}
          thumbColor="#ffffff"
          accessibilityLabel="Asistente continuo: narración automática del entorno"
        />
      </View>

      {/* ─── Error overlay ─── */}
      {error && (
        <View style={estilos.zonaError} accessibilityLiveRegion="polite">
          <Text style={estilos.errorTexto} numberOfLines={2}>
            ⚠️ {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar error"
            onPress={() => setError(null)}
            hitSlop={8}
          >
            <Text style={estilos.errorCerrar}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* ─── Overlay de análisis puntual ─── */}
      {procesandoCaptura && (
        <View style={estilos.overlayProcesando} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={estilos.procesandoTexto}>
            {info.icono} Analizando: {info.etiqueta}…
          </Text>
        </View>
      )}

      {/* ─── Selector de análisis puntual ─── */}
      {!modoContinuo.activo && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={estilos.selectorZona}
          contentContainerStyle={estilos.selectorContenido}
        >
          {TIPOS_ANALISIS.map((tipo) => {
            const t = INFO_TIPO_ANALISIS[tipo];
            const activo = tipo === tipoSeleccionado;
            return (
              <Pressable
                key={tipo}
                accessibilityRole="button"
                accessibilityLabel={`Análisis de ${t.etiqueta}: ${t.descripcion}`}
                accessibilityState={{ selected: activo }}
                onPress={() => setTipoSeleccionado(tipo)}
                style={({ pressed }) => [
                  estilos.chipTipo,
                  activo && estilos.chipTipoActivo,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={estilos.chipIcono} aria-hidden>
                  {t.icono}
                </Text>
                <Text
                  style={[
                    estilos.chipTexto,
                    activo && estilos.chipTextoActivo,
                  ]}
                >
                  {t.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ─── Botón de captura ─── */}
      <View style={estilos.zonaBoton} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            modoContinuo.activo
              ? 'Captura manual deshabilitada: el asistente continuo está activo'
              : `Capturar y analizar ${info.etiqueta}`
          }
          accessibilityState={{ busy: procesandoCaptura, disabled: !camaraLista || modoContinuo.activo }}
          onPress={() => void capturarPuntual()}
          disabled={procesandoCaptura || !camaraLista || modoContinuo.activo}
          style={({ pressed }) => [
            estilos.botonCaptura,
            (!camaraLista || procesandoCaptura || modoContinuo.activo) && {
              opacity: 0.4,
            },
            pressed && camaraLista && !modoContinuo.activo && {
              transform: [{ scale: 0.93 }],
            },
          ]}
        >
          <View style={estilos.botonInterno}>
            <Text aria-hidden style={estilos.botonIcono}>
              📸
            </Text>
          </View>
        </Pressable>

        {modoContinuo.activo ? (
          <Text style={estilos.hintBoton}>
            {modoContinuo.estado.modo === 'lectura'
              ? '📖 Leyendo texto continuamente'
              : 'La cámara la maneja tu asistente'}
          </Text>
        ) : (
          !camaraLista &&
          !procesandoCaptura && (
            <Text style={estilos.hintBoton}>Preparando cámara…</Text>
          )
        )}
      </View>

      {/* ─── Panel de resultados ─── */}
      <View style={estilos.panel}>
        <ScrollView
          contentContainerStyle={estilos.panelContenido}
          nestedScrollEnabled
        >
          <PanelResultadoAnalisis
            resultado={ultimoResultado}
            onRepetirVoz={(texto) => anunciar(texto, { forzar: true })}
          />

          {/* Historial de la sesión — tocable para re-escuchar */}
          {historial.length > 1 && (
            <View style={estilos.historial}>
              <Text style={estilos.historialTitulo}>
                Capturas de esta sesión (toca para re-escuchar):
              </Text>
              {historial.slice(1).map((h) => {
                const icono =
                  INFO_TIPO_ANALISIS[h.tipo_analisis as TipoAnalisis]?.icono ??
                  '📷';
                const texto = h.resumen_voz ?? h.estado;
                return h.resumen_voz ? (
                  <Pressable
                    key={h.id_captura}
                    accessibilityRole="button"
                    accessibilityLabel={`Repetir: ${texto}`}
                    onPress={() => anunciar(h.resumen_voz!, { forzar: true })}
                    style={({ pressed }) => [
                      estilos.historialItemTocable,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={estilos.historialItem} numberOfLines={2}>
                      🔊 {icono} {texto}
                    </Text>
                  </Pressable>
                ) : (
                  <Text key={h.id_captura} style={estilos.historialItem} numberOfLines={1}>
                    • {icono} {texto}
                  </Text>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/* ═══════════════════ SUB-COMPONENTES ═══════════════════ */

/** Chip de estado del Modo Continuo (SILENCIO/INFO/ALERTA/procesando) */
function ChipEstadoModo(props: {
  procesando: boolean;
  estado: {
    ultimoMensaje: string | null;
    ultimoNivel: string | null;
    error: string | null;
  };
}) {
  const { procesando, estado } = props;

  let texto = 'Escuchando tu entorno…';
  let estiloExtra = {};

  if (estado.error) {
    texto = estado.error;
    estiloExtra = { color: colores.advertencia };
  } else if (procesando) {
    texto = 'Analizando…';
  } else if (estado.ultimoNivel === 'ALERTA' && estado.ultimoMensaje) {
    texto = `🚨 ${estado.ultimoMensaje}`;
    estiloExtra = { color: '#fecaca', fontWeight: '700' };
  } else if (estado.ultimoNivel === 'INFO' && estado.ultimoMensaje) {
    texto = estado.ultimoMensaje;
  }

  return (
    <View accessibilityLiveRegion="polite">
      <Text style={[estilos.bannerSub, estiloExtra]} numberOfLines={2}>
        {texto}
      </Text>
    </View>
  );
}

function PantallaEspera({ mensaje }: { mensaje: string }) {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" color={colores.primario} />
      <Text style={estilos.centroTexto}>{mensaje}</Text>
    </View>
  );
}

function PanelPermiso(props: {
  titulo: string;
  mensaje: string;
  etiquetaBoton: string;
  accion: () => void;
}) {
  const { anunciar } = useTTS();

  useEffect(() => {
    anunciar(`${props.titulo}. ${props.mensaje}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={estilos.centro}>
      <Text aria-hidden style={estilos.permisoIcono}>
        📷
      </Text>
      <Text style={estilos.permisoTitulo}>{props.titulo}</Text>
      <Text style={estilos.permisoMensaje}>{props.mensaje}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.etiquetaBoton}
        onPress={props.accion}
        style={({ pressed }) => [
          estilos.permisoBoton,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={estilos.permisoBotonTexto}>{props.etiquetaBoton}</Text>
      </Pressable>
    </View>
  );
}

/* ═══════════════════ ESTILOS ═══════════════════ */

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000000' },

  bannerModo: {
    position: 'absolute',
    top: tamaños.md,
    left: tamaños.md,
    right: tamaños.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
    gap: tamaños.sm,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  bannerModoActivo: { borderColor: colores.exito },
  bannerTextos: { flex: 1 },
  bannerTitulo: {
    color: '#ffffff',
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
  },
  bannerSub: {
    color: '#cbd5e1',
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
    lineHeight: 16,
  },

  zonaError: {
    position: 'absolute',
    top: 108,
    left: tamaños.md,
    right: tamaños.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.peligroFondo,
    borderColor: colores.peligro,
    borderWidth: 1,
    borderRadius: tamaños.radioMD,
    padding: tamaños.sm,
    gap: tamaños.sm,
  },
  errorTexto: { flex: 1, color: '#fecaca', fontSize: tamaños.fuenteXS },
  errorCerrar: { color: '#fecaca', fontSize: 16, fontWeight: '700' },

  overlayProcesando: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tamaños.md,
    zIndex: 20,
  },
  procesandoTexto: {
    color: '#ffffff',
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
  },

  selectorZona: {
    position: 'absolute',
    top: 108,
    left: 0,
    right: 0,
    flexGrow: 0,
  },
  selectorContenido: {
    paddingHorizontal: tamaños.md,
    gap: tamaños.sm,
  },
  chipTipo: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: tamaños.radioMD,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingVertical: tamaños.xs,
    paddingHorizontal: tamaños.sm,
    minWidth: 84,
  },
  chipTipoActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  chipIcono: { fontSize: 22 },
  chipTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    fontWeight: '600',
    marginTop: 2,
  },
  chipTextoActivo: { color: '#ffffff' },

  zonaBoton: {
    position: 'absolute',
    bottom: 268,
    alignSelf: 'center',
    alignItems: 'center',
  },
  botonCaptura: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  botonInterno: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonIcono: { fontSize: 28 },
  hintBoton: {
    color: '#ffffff',
    fontSize: tamaños.fuenteXS,
    marginTop: tamaños.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: tamaños.sm,
    paddingVertical: 4,
    borderRadius: tamaños.radioSM,
    overflow: 'hidden',
  },

  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 240,
    backgroundColor: colores.fondo,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  panelContenido: { padding: tamaños.md, paddingBottom: tamaños.lg },

  historial: {
    marginTop: tamaños.sm,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    paddingTop: tamaños.sm,
  },
  historialTitulo: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    fontWeight: '700',
    marginBottom: 4,
  },
  historialItem: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    lineHeight: 18,
  },

  centro: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tamaños.md,
    padding: tamaños.xl,
  },
  centroTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    textAlign: 'center',
  },
  permisoIcono: { fontSize: 64 },
  permisoTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXXL,
    fontWeight: '700',
    textAlign: 'center',
  },
  permisoMensaje: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    lineHeight: 24,
    textAlign: 'center',
  },
  permisoBoton: {
    backgroundColor: colores.primario,
    borderRadius: tamaños.radioMD,
    height: tamaños.botonAltura,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tamaños.xl,
    marginTop: tamaños.sm,
  },
  permisoBotonTexto: {
    color: '#ffffff',
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
  },
  historialItemTocable: {
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
});