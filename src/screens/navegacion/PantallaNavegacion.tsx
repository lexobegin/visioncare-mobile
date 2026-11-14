import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  agregarPuntoNavegacion,
  finalizarNavegacion,
  iniciarNavegacion,
} from '@/api/navegacion.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { CampoTexto } from '@/components/CampoTexto';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import { obtenerUbicacion } from '@/services/location.service';
import { encolar } from '@/services/sincronizacion.service';
import type { Navegacion } from '@/types';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * NAVEGACIÓN ASISTIDA (CU24):
 *
 *   1. Usuario escribe el destino → "Comenzar".
 *   2. Se crea la navegación (origen = GPS actual) y un
 *      registro automático de la traza cada 15 s
 *      (POST /navegaciones/:id/puntos).
 *   3. SIN CONEXIÓN: los puntos van a la cola offline y la
 *      navegación completa se encola como NAVEGACION (con
 *      puntos incluidos) para subirla al sincronizar (CU25).
 *   4. "Terminé" / "Cancelar" cierra la navegación y narra el
 *      resumen (distancia y duración las calcula el backend).
 *
 * Se combina a la perfección con el Modo Continuo (pechera):
 * activa el asistente en la pestaña Cámara y la narración del
 * entorno acompaña la traza.
 * ══════════════════════════════════════════════════════
 */

const INTERVALO_PUNTO_MS = 15_000;
/** Mínimo de avance para registrar un punto (metros) */
const AVANCE_MINIMO_M = 3;

interface PuntoLocal {
  latitud: number;
  longitud: number;
}

/** Distancia Haversine en metros (para filtrar puntos repetidos) */
function distanciaMetros(a: PuntoLocal, b: PuntoLocal): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitud - a.latitud) * rad;
  const dLon = (b.longitud - a.longitud) * rad;
  const lat1 = a.latitud * rad;
  const lat2 = b.latitud * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** ¿El error fue de red (sin respuesta HTTP)? → cola offline */
function esErrorRed(err: unknown): boolean {
  return !(err as { response?: unknown })?.response;
}

export default function PantallaNavegacion() {
  const { anunciar } = useTTS();

  const [destino, setDestino] = useState('');
  const [fase, setFase] = useState<'formulario' | 'activa'>('formulario');
  const [iniciando, setIniciando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoOffline, setAvisoOffline] = useState<string | null>(null);
  const [puntosRegistrados, setPuntosRegistrados] = useState(0);
  const [pendientesLocales, setPendientesLocales] = useState(0);

  // Refs del seguimiento (evitan closures viejas en el intervalo)
  const navegacionRef = useRef<Navegacion | null>(null);
  const modoOfflineRef = useRef(false);
  const destinoRef = useRef('');
  const fechaInicioRef = useRef('');
  const origenRef = useRef<PuntoLocal | null>(null);
  const puntosOfflineRef = useRef<PuntoLocal[]>([]);
  const ultimaPosRef = useRef<PuntoLocal | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    anunciar(
      'Pantalla de navegación asistida. Escribe tu destino y pulsa ' +
        'comenzar. La ruta se registra automáticamente.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpieza: detener el registro si sale de la pantalla
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const detenerRegistro = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── Registro periódico de la traza ───
  const registrarPunto = useCallback(async () => {
    const u = await obtenerUbicacion({ timeoutMs: 6000 });
    if (!u) return;

    const punto: PuntoLocal = { latitud: u.latitud, longitud: u.longitud };
    const ultima = ultimaPosRef.current;
    if (ultima && distanciaMetros(ultima, punto) < AVANCE_MINIMO_M) return;
    ultimaPosRef.current = punto;

    // ─── Modo offline: acumular localmente (se encola al cerrar) ───
    if (modoOfflineRef.current) {
      puntosOfflineRef.current.push(punto);
      setPendientesLocales(puntosOfflineRef.current.length);
      return;
    }

    const navegacion = navegacionRef.current;
    if (!navegacion) return;

    try {
      await agregarPuntoNavegacion(navegacion.id_navegacion, {
        latitud: punto.latitud,
        longitud: punto.longitud,
      });
      setPuntosRegistrados((p) => p + 1);
    } catch (e) {
      if (esErrorRed(e)) {
        // Se perdió la conexión a mitad de ruta: el punto va a la cola
        setAvisoOffline(
          'Sin conexión: los puntos nuevos van a la cola y se subirán al sincronizar.',
        );
        await encolar('PUNTO_NAVEGACION', {
          id_navegacion: navegacion.id_navegacion,
          latitud: punto.latitud,
          longitud: punto.longitud,
        });
        setPendientesLocales((p) => p + 1);
      }
      // Error del backend (400/404): el punto se descarta en silencio
    }
  }, []);

  const arrancarRegistro = useCallback(() => {
    detenerRegistro();
    timerRef.current = setInterval(() => {
      void registrarPunto();
    }, INTERVALO_PUNTO_MS);
  }, [detenerRegistro, registrarPunto]);

  // ─── Comenzar ───
  const comenzar = useCallback(async () => {
    if (iniciando || fase === 'activa') return;

    setIniciando(true);
    setError(null);
    setAvisoOffline(null);
    setPuntosRegistrados(0);
    setPendientesLocales(0);
    puntosOfflineRef.current = [];
    ultimaPosRef.current = null;
    destinoRef.current = destino.trim();

    try {
      const u = await obtenerUbicacion({ timeoutMs: 6000 });
      if (u) origenRef.current = { latitud: u.latitud, longitud: u.longitud };
      fechaInicioRef.current = new Date().toISOString();

      try {
        // ─── Camino ONLINE ───
        const navegacion = await iniciarNavegacion({
          modo: 'ASISTIDA',
          ...(destinoRef.current && {
            destino_descripcion: destinoRef.current,
          }),
          ...(u && {
            origen_latitud: u.latitud,
            origen_longitud: u.longitud,
          }),
        });

        navegacionRef.current = navegacion;
        modoOfflineRef.current = false;
        setFase('activa');
        arrancarRegistro();

        anunciar(
          navegacion.mensaje_voz ??
            `Navegación iniciada${destinoRef.current ? ` hacia ${destinoRef.current}` : ''}. La ruta se registra cada quince segundos.`,
          { forzar: true },
        );
      } catch (e) {
        if (!esErrorRed(e)) throw e;

        // ─── Camino OFFLINE: todo se encola al cerrar (CU25) ───
        modoOfflineRef.current = true;
        if (u) puntosOfflineRef.current.push({ latitud: u.latitud, longitud: u.longitud });
        setFase('activa');
        setAvisoOffline(
          'Sin conexión ahora: la ruta completa se guardará y se subirá al sincronizar.',
        );
        arrancarRegistro();

        anunciar(
          'Navegación iniciada sin conexión. Registraré tu ruta y la subiremos automáticamente cuando haya internet.',
          { forzar: true },
        );
      }
    } catch (e) {
      const m = mensajeDeError(e);
      setError(m);
      anunciar(`No se pudo iniciar la navegación. ${m}`, { forzar: true });
    } finally {
      setIniciando(false);
    }
  }, [iniciando, fase, destino, anunciar, arrancarRegistro]);

  // ─── Finalizar (COMPLETADA / CANCELADA) ───
  const terminar = useCallback(
    async (estadoFinal: 'COMPLETADA' | 'CANCELADA') => {
      if (finalizando) return;

      setFinalizando(true);
      setError(null);

      try {
        if (modoOfflineRef.current) {
          // Offline: encolar la navegación completa con sus puntos
          const origen = origenRef.current;
          await encolar('NAVEGACION', {
            modo: 'ASISTIDA',
            estado: estadoFinal === 'COMPLETADA' ? 'COMPLETADA' : 'CANCELADA',
            ...(destinoRef.current && {
              destino_descripcion: destinoRef.current,
            }),
            fecha_inicio: fechaInicioRef.current,
            fecha_fin: new Date().toISOString(),
            ...(origen && {
              origen_latitud: origen.latitud,
              origen_longitud: origen.longitud,
            }),
            puntos: puntosOfflineRef.current.map((p, i) => ({
              latitud: p.latitud,
              longitud: p.longitud,
              orden: i + 1,
            })),
          });

          anunciar(
            estadoFinal === 'COMPLETADA'
              ? 'Ruta completada y guardada sin conexión. Se subirá cuando sincronices.'
              : 'Navegación cancelada. La ruta se guardó sin conexión.',
            { forzar: true },
          );
        } else {
          const navegacion = navegacionRef.current;
          if (navegacion) {
            const cerrada = await finalizarNavegacion(navegacion.id_navegacion, {
              estado_final: estadoFinal,
            });

            const distancia =
              cerrada.distancia_metros != null
                ? ` Distancia recorrida: ${Math.round(cerrada.distancia_metros)} metros.`
                : '';
            const duracion =
              cerrada.duracion_segundos != null
                ? ` Duración: ${Math.max(1, Math.round(cerrada.duracion_segundos / 60))} minutos.`
                : '';

            anunciar(
              cerrada.mensaje_voz ??
                `Navegación ${estadoFinal === 'COMPLETADA' ? 'completada' : 'cancelada'}.${distancia}${duracion}`,
              { forzar: true },
            );
          }
        }

        detenerRegistro();
        navegacionRef.current = null;
        modoOfflineRef.current = false;
        setFase('formulario');
        setAvisoOffline(null);
        setPuntosRegistrados(0);
        setPendientesLocales(0);
      } catch (e) {
        const m = mensajeDeError(e);
        setError(m);
        anunciar(`No se pudo cerrar la navegación. ${m}`, { forzar: true });
      } finally {
        setFinalizando(false);
      }
    },
    [finalizando, anunciar, detenerRegistro],
  );

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      {fase === 'formulario' ? (
        <>
          <Text style={estilos.descripcion}>
            Guía tus desplazamientos: se guarda la ruta completa (traza GPS)
            con distancia y duración, y queda en tu historial.
          </Text>

          <CampoTexto
            etiqueta="¿A dónde vas? (destino)"
            valor={destino}
            onChangeText={setDestino}
            placeholder="Ej: Mercado Municipal, puerta principal"
            autoCapitalizar="sentences"
            hint="Opcional, pero ayuda a recordar el recorrido."
          />

          {error && <Alerta variante="error" mensaje={error} />}

          <Boton
            etiqueta="🧭 Comenzar navegación"
            onPress={() => void comenzar()}
            cargando={iniciando}
          />

          <Text style={estilos.sutil}>
            Si no hay internet, la ruta se guarda en el teléfono y se sube
            automáticamente con la sincronización.
          </Text>
        </>
      ) : (
        <>
          <Text style={estilos.tituloActiva}>🧭 Navegación en curso</Text>
          {destinoRef.current ? (
            <Text style={estilos.destino}>Destino: {destinoRef.current}</Text>
          ) : null}

          {avisoOffline && (
            <Alerta variante="advertencia" mensaje={avisoOffline} />
          )}
          {error && <Alerta variante="error" mensaje={error} />}

          <View style={estilos.tarjetaEstado}>
            <Text style={estilos.estadoLinea}>
              📍 Puntos registrados: {puntosRegistrados}
            </Text>
            {pendientesLocales > 0 && (
              <Text style={estilos.estadoLineaPendiente}>
                ⏳ {pendientesLocales} punto(s) esperando sincronización
              </Text>
            )}
            <Text style={estilos.sutil}>
              La traza se registra cada 15 segundos mientras te mueves.
            </Text>
          </View>

          <Boton
            etiqueta="✅ Terminé la ruta"
            onPress={() => void terminar('COMPLETADA')}
            cargando={finalizando}
          />

          <Boton
            etiqueta="✋ Cancelar navegación"
            variante="secundario"
            onPress={() => void terminar('CANCELADA')}
            deshabilitado={finalizando}
          />

          <Text style={estilos.sutil}>
            Consejo: en la pestaña Cámara puedes activar el asistente continuo
            para que te narre el entorno mientras caminas.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

/* ═══════════════════ ESTILOS ═══════════════════ */

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  contenido: {
    padding: tamaños.lg,
    gap: tamaños.sm,
  },
  descripcion: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    lineHeight: 22,
    marginBottom: tamaños.sm,
  },
  tituloActiva: {
    color: colores.texto,
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
  },
  destino: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
  },
  tarjetaEstado: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
    gap: tamaños.xs,
    marginVertical: tamaños.sm,
  },
  estadoLinea: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '600',
  },
  estadoLineaPendiente: {
    color: colores.advertencia,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600',
  },
  sutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    lineHeight: 18,
  },
});
