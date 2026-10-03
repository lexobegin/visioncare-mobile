import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { registrarCaptura } from '@/api/capturas.api';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import { obtenerUbicacion } from '@/services/location.service';
import { mensajeDeError, type CapturaResponse } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Cámara + Reconocimiento IA (CU07 + CU08).
 *
 * Flujo de cada captura:
 *   1. takePictureAsync (quality 0.7 — buen balance)
 *   2. GPS en paralelo (never-throw → null si no hay fix)
 *   3. POST /capturas (multipart) → backend → R2 → FastAPI
 *   4. resumen_voz del backend → TTS SIEMPRE
 *   5. Panel con detecciones + historial de la sesión
 *
 * Estados de cámara:
 *   - permiso pendiente/denegado → panel explicativo + ajustes
 *   - cámara lista → vista previa + botón de captura
 * ══════════════════════════════════════════════════════
 */

const MAX_HISTORIAL = 5;

export default function PantallaCamara() {
  const { anunciar } = useTTS();

  // ─── Cámara (API moderna de expo-camera) ───
  const camaraRef = useRef<CameraView>(null);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [camaraLista, setCamaraLista] = useState(false);

  // ─── Flujo de captura ───
  const [procesando, setProcesando] = useState(false);
  const [ultimoResultado, setUltimoResultado] =
    useState<CapturaResponse | null>(null);
  const [historial, setHistorial] = useState<CapturaResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Anuncio de pantalla
  useEffect(() => {
    anunciar(
      'Pantalla de cámara. Apunta al entorno y pulsa el botón grande para capturar y analizar.',
    );
  }, [anunciar]);

  // ═══════════════ CAPTURA ═══════════════

  const capturar = useCallback(async () => {
    if (procesando || !camaraLista) return;

    setProcesando(true);
    setError(null);
    anunciar('Capturando', { forzar: true });

    try {
      // ─── 1. Tomar la foto ───
      const foto = await camaraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: false, // Android: corrige rotación EXIF
      });

      if (!foto?.uri) {
        throw new Error('No se pudo capturar la imagen. Intenta de nuevo.');
      }

      // ─── 2. GPS (silencioso — null si no hay fix) ───
      const ubicacion = await obtenerUbicacion();

      // ─── 3. Enviar al backend (→ R2 → FastAPI → YOLO) ───
      const respuesta = await registrarCaptura({
        uri: foto.uri,
        reconocer: true,
        origen: 'CAMARA',
        ...(ubicacion && {
          latitud: ubicacion.latitud,
          longitud: ubicacion.longitud,
        }),
      });

      // ─── 4. Resultados ───
      setUltimoResultado(respuesta);
      setHistorial((prev) =>
        [respuesta, ...prev].slice(0, MAX_HISTORIAL),
      );

      // ─── 5. Anuncio por voz (siempre hay algo que decir) ───
      if (respuesta.resumen_voz) {
        anunciar(respuesta.resumen_voz, { forzar: true });
      } else if (respuesta.estado === 'PROCESADA') {
        anunciar('Captura procesada, pero no pude generar el resumen.', {
          forzar: true,
        });
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
      setProcesando(false);
    }
  }, [procesando, camaraLista, anunciar]);

  // ═══════════════ PERMISOS ═══════════════

  // Hook aún verificando el permiso almacenado
  if (!permiso) {
    return <PantallaEspera mensaje="Preparando la cámara…" />;
  }

  // Permiso denegado permanentemente → solo ajustes del sistema
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

  // Permiso denegado (se puede volver a preguntar)
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

  // ═══════════════ CÁMARA ACTIVA ═══════════════

  return (
    <View style={estilos.flex}>
      {/* ─── Vista previa de la cámara ─── */}
      <CameraView
        ref={camaraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCamaraLista(true)}
        onMountError={() =>
          setError('No se pudo iniciar la cámara. ¿Otra app la está usando?')
        }
      />

      {/* ─── Overlay superior: error ─── */}
      {error && (
        <View style={estilos.zonaError} accessibilityLiveRegion="polite">
          <Text style={estilos.errorTexto}>⚠️ {error}</Text>
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

      {/* ─── Overlay de análisis ─── */}
      {procesando && (
        <View style={estilos.overlayProcesando} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={estilos.procesandoTexto}>
            Analizando tu entorno…
          </Text>
        </View>
      )}

      {/* ─── Botón de captura gigante ─── */}
      <View style={estilos.zonaBoton} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            camaraLista
              ? 'Capturar y analizar entorno'
              : 'Preparando cámara, espera un momento'
          }
          accessibilityState={{ busy: procesando, disabled: !camaraLista }}
          onPress={() => void capturar()}
          disabled={procesando || !camaraLista}
          style={({ pressed }) => [
            estilos.botonCaptura,
            (!camaraLista || procesando) && { opacity: 0.5 },
            pressed && !procesando && camaraLista && { transform: [{ scale: 0.93 }] },
          ]}
        >
          <View style={estilos.botonInterno}>
            <Text aria-hidden style={estilos.botonIcono}>
              📸
            </Text>
          </View>
        </Pressable>

        {!camaraLista && !procesando && (
          <Text style={estilos.preparando}>Preparando cámara…</Text>
        )}
      </View>

      {/* ─── Panel de resultados ─── */}
      <View style={estilos.panel}>
        <ScrollView
          contentContainerStyle={estilos.panelContenido}
          nestedScrollEnabled
        >
          {/* Último resultado */}
          {ultimoResultado ? (
            <View style={estilos.resultado}>
              <View style={estilos.resultadoCabecera}>
                <Text style={estilos.resultadoTitulo}>
                  📷 Último análisis
                </Text>
                <Text style={estilos.resultadoHora}>
                  {new Date(
                    ultimoResultado.fecha_captura,
                  ).toLocaleTimeString('es', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {/* Resumen hablado (repetible por toque) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Repetir resumen por voz"
                onPress={() =>
                  anunciar(
                    ultimoResultado.resumen_voz ??
                      'Sin resumen disponible para esta captura.',
                    { forzar: true },
                  )
                }
                style={estilos.resumenCaja}
              >
                <Text style={estilos.resumenTexto}>
                  🗣️  {ultimoResultado.resumen_voz ?? 'Sin resumen disponible.'}
                </Text>
                <Text style={estilos.resumenRepetir}>
                  (toca para escuchar de nuevo)
                </Text>
              </Pressable>

              {/* Estado IA */}
              {!ultimoResultado.ia_disponible && (
                <Text style={estilos.avisoIA}>
                  ⚠️ Servicio de IA no disponible — captura guardada
                  como pendiente.
                </Text>
              )}

              {/* Detecciones */}
              {ultimoResultado.detecciones &&
                ultimoResultado.detecciones.length > 0 && (
                  <View style={estilos.detecciones}>
                    {ultimoResultado.detecciones
                      .slice(0, 6)
                      .map((d) => (
                        <View
                          key={d.id_deteccion}
                          style={estilos.deteccionFila}
                        >
                          <Text style={estilos.deteccionEtiqueta}>
                            {d.etiqueta_es ?? d.etiqueta}
                          </Text>
                          <View style={estilos.confianzaBarra}>
                            <View
                              style={[
                                estilos.confianzaRelleno,
                                { width: `${Math.round(d.confianza * 100)}%` },
                              ]}
                            />
                          </View>
                          <Text style={estilos.deteccionConfianza}>
                            {Math.round(d.confianza * 100)}%
                          </Text>
                        </View>
                      ))}
                  </View>
                )}
            </View>
          ) : (
            <Text style={estilos.panelVacio}>
              Pulsa el botón para capturar y analizar tu entorno con IA.
            </Text>
          )}

          {/* Historial de la sesión */}
          {historial.length > 1 && (
            <View style={estilos.historial}>
              <Text style={estilos.historialTitulo}>
                Capturas de esta sesión:
              </Text>
              {historial.slice(1).map((h) => (
                <Text
                  key={h.id_captura}
                  style={estilos.historialItem}
                  numberOfLines={1}
                >
                  • {new Date(h.fecha_captura).toLocaleTimeString('es', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' — '}
                  {h.resumen_voz ?? h.estado}
                </Text>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/* ═══════════════════ SUB-COMPONENTES ═══════════════════ */

/** Espera inicial (cargando estado del permiso) */
function PantallaEspera({ mensaje }: { mensaje: string }) {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" color={colores.primario} />
      <Text style={estilos.centroTexto}>{mensaje}</Text>
    </View>
  );
}

/** Panel explicativo de permisos */
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

  zonaError: {
    position: 'absolute',
    top: tamaños.md,
    left: tamaños.md,
    right: tamaños.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.peligroFondo,
    borderColor: colores.peligro,
    borderWidth: 1,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    gap: tamaños.sm,
  },
  errorTexto: {
    flex: 1,
    color: '#fecaca',
    fontSize: tamaños.fuenteSM,
  },
  errorCerrar: { color: '#fecaca', fontSize: 18, fontWeight: '700' },

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
    zIndex: 10,
  },
  procesandoTexto: {
    color: '#ffffff',
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
  },

  zonaBoton: {
    position: 'absolute',
    bottom: 258, // encima del panel (panel ≈ 230 + margen)
    alignSelf: 'center',
    alignItems: 'center',
  },
  botonCaptura: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  botonInterno: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonIcono: { fontSize: 30 },
  preparando: {
    color: '#ffffff',
    fontSize: tamaños.fuenteSM,
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
    maxHeight: 230,
    backgroundColor: colores.fondo,
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  panelContenido: {
    padding: tamaños.md,
    paddingBottom: tamaños.lg,
  },
  panelVacio: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteSM,
    textAlign: 'center',
    paddingVertical: tamaños.md,
  },
  resultado: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.sm,
  },
  resultadoCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tamaños.xs,
  },
  resultadoTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  resultadoHora: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },
  resumenCaja: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.sm,
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
  resumenTexto: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },
  resumenRepetir: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
  },
  avisoIA: {
    color: colores.advertencia,
    fontSize: tamaños.fuenteXS,
    marginTop: tamaños.sm,
  },

  detecciones: { marginTop: tamaños.sm, gap: 6 },
  deteccionFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tamaños.sm,
  },
  deteccionEtiqueta: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    width: 110,
  },
  confianzaBarra: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colores.superficieClara,
    overflow: 'hidden',
  },
  confianzaRelleno: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colores.primario,
  },
  deteccionConfianza: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    fontWeight: '700',
    width: 38,
    textAlign: 'right',
  },

  historial: {
    marginTop: tamaños.md,
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
});