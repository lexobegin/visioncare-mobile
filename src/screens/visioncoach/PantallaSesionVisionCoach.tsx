import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  finalizarSesionVc,
  iniciarSesionVc,
  listarEjerciciosVc,
  registrarResultadoVc,
} from '@/api/visioncoach.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { colores, tamaños } from '@/constants/tema';
import type { MasStackParamList } from '@/navigation/NavigationTypes';
import { useTTS } from '@/hooks/useTTS';
import {
  vibrarEmergencia,
  vibrarNotificacion,
} from '@/services/haptics.service';
import type {
  EjercicioVc,
  SesionFinalizadaVc,
} from '@/types';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * SESIÓN DE ENTRENAMIENTO GUIADA POR VOZ (CU28–CU30):
 *
 *   1. Carga el catálogo activo y toma los primeros
 *      EJERCICIOS_POR_SESION (sesión rápida).
 *   2. POST /visioncoach/sesiones → sesión INICIADA.
 *   3. Por cada ejercicio: narra nombre + descripción y
 *      espera ✅ "Lo logré" / ❌ "No pude" →
 *      POST resultados (el servidor calcula los puntos).
 *      Narra el mensaje_voz del backend (+ insignias nuevas,
 *      con háptica de celebración).
 *   4. PATCH finalizar (COMPLETADA) → narra puntos, desafío
 *      adaptativo asignado (CU31) y progreso.
 *
 * "Terminar sesión" → finalizar con ABANDONADA (los
 * resultados ya registrados cuentan igual).
 * ══════════════════════════════════════════════════════
 */

const EJERCICIOS_POR_SESION = 5;

type FaseSesion =
  | { fase: 'lista' }
  | { fase: 'ejercicio'; indice: number }
  | { fase: 'fin'; resumen: SesionFinalizadaVc };

export default function PantallaSesionVisionCoach() {
  const { anunciar } = useTTS();
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ejercicios, setEjercicios] = useState<EjercicioVc[]>([]);

  const [sesionId, setSesionId] = useState<number | null>(null);
  const [fase, setFase] = useState<FaseSesion>({ fase: 'lista' });
  const [enviando, setEnviando] = useState(false);
  const [abandonando, setAbandonando] = useState(false);

  // Tiempo de respuesta del ejercicio actual
  const inicioEjercicioRef = useRef<number>(Date.now());

  useEffect(() => {
    anunciar(
      'Sesión de entrenamiento. Se prepararán ejercicios guiados por voz: ' +
        'escucha cada ejercicio y responde con los botones.',
    );

    let vigente = true;
    listarEjerciciosVc()
      .then((lista) => {
        if (!vigente) return;
        if (lista.length === 0) {
          setError(
            'No hay ejercicios en el catálogo todavía (se cargan con la migración de seed del backend).',
          );
        }
        setEjercicios(lista.slice(0, EJERCICIOS_POR_SESION));
      })
      .catch((e) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Finalizar (CU30 + CU31 + CU33) ───
  const finalizar = useCallback(
    async (estadoFinal: 'COMPLETADA' | 'ABANDONADA') => {
      if (!sesionId) return;

      try {
        const cierre = await finalizarSesionVc(sesionId, {
          estado_final: estadoFinal,
        });

        setFase({ fase: 'fin', resumen: cierre });

        if (cierre.insignias_nuevas?.length) {
          void vibrarNotificacion();
          void vibrarEmergencia(1);
        }

        let texto = cierre.mensaje_voz;
        if (cierre.desafio_asignado) {
          texto +=
            ` Nuevo desafío asignado: ${cierre.desafio_asignado.ejercicio_nombre ?? 'ejercicio'}, ` +
            `dificultad ${cierre.desafio_asignado.dificultad_asignada} de 5.`;
        }
        if (cierre.insignias_nuevas?.length) {
          texto += ` ¡Obtuviste ${cierre.insignias_nuevas.length} insignia(s) nueva(s)!`;
        }

        anunciar(texto, { forzar: true });
      } catch (e) {
        const m = mensajeDeError(e);
        setError(m);
        anunciar(`No se pudo cerrar la sesión. ${m}`, { forzar: true });
      }
    },
    [sesionId, anunciar],
  );

  // ─── Comenzar sesión (CU28) ───
  const comenzar = useCallback(async () => {
    if (enviando || sesionId) return;

    setEnviando(true);
    setError(null);

    try {
      const sesion = await iniciarSesionVc();
      setSesionId(sesion.id_sesion);
      setFase({ fase: 'ejercicio', indice: 0 });
      inicioEjercicioRef.current = Date.now();

      const primero = ejercicios[0];
      anunciar(
        `Sesión iniciada. Ejercicio 1 de ${ejercicios.length}: ` +
          `${primero?.nombre ?? ''}. ${primero?.descripcion ?? ''} ` +
          'Cuando lo completes pulsa: lo logré. Si no pudiste, pulsa: no pude.',
        { forzar: true },
      );
    } catch (e) {
      const m = mensajeDeError(e);
      setError(m);
      anunciar(`No se pudo iniciar la sesión. ${m}`, { forzar: true });
    } finally {
      setEnviando(false);
    }
  }, [enviando, sesionId, ejercicios, anunciar]);

  // ─── Responder el ejercicio actual (CU29) ───
  const responder = useCallback(
    async (correcto: boolean) => {
      if (!sesionId || enviando || fase.fase !== 'ejercicio') return;

      const ejercicio = ejercicios[fase.indice];
      if (!ejercicio) return;

      setEnviando(true);
      setError(null);

      try {
        const tiempoSegundos = Math.max(
          1,
          Math.round((Date.now() - inicioEjercicioRef.current) / 1000),
        );

        const respuesta = await registrarResultadoVc(sesionId, {
          id_ejercicio: ejercicio.id_ejercicio,
          correcto,
          tiempo_segundos: tiempoSegundos,
        });

        if (respuesta.insignias_nuevas?.length) {
          void vibrarNotificacion();
        }
        anunciar(respuesta.mensaje_voz, { forzar: true });

        const siguiente = fase.indice + 1;
        if (siguiente >= ejercicios.length) {
          await finalizar('COMPLETADA');
        } else {
          const proximo = ejercicios[siguiente];
          setFase({ fase: 'ejercicio', indice: siguiente });
          inicioEjercicioRef.current = Date.now();

          // Pequeña espera para no pisar el mensaje del resultado
          setTimeout(() => {
            anunciar(
              `Ejercicio ${siguiente + 1} de ${ejercicios.length}: ` +
                `${proximo?.nombre ?? ''}. ${proximo?.descripcion ?? ''}`,
              { forzar: true },
            );
          }, 400);
        }
      } catch (e) {
        const m = mensajeDeError(e);
        setError(m);
        anunciar(`No se pudo registrar el resultado. ${m}`, {
          forzar: true,
        });
      } finally {
        setEnviando(false);
      }
    },
    [sesionId, enviando, fase, ejercicios, anunciar, finalizar],
  );

  const abandonar = useCallback(async () => {
    if (!sesionId || abandonando) return;
    setAbandonando(true);
    await finalizar('ABANDONADA');
    setAbandonando(false);
  }, [sesionId, abandonando, finalizar]);

  // ─── Renders por fase ───
  if (cargando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={colores.primario} />
        <Text style={estilos.centroTexto}>Preparando ejercicios…</Text>
      </View>
    );
  }

  if (ejercicios.length === 0) {
    return (
      <View style={estilos.contenidoScroll}>
        {error && <Alerta variante="error" mensaje={error} />}
        <Text style={estilos.centroTexto}>
          Sin ejercicios disponibles en el catálogo.
        </Text>
      </View>
    );
  }

  if (fase.fase === 'lista') {
    return (
      <ScrollView
        style={estilos.pantalla}
        contentContainerStyle={estilos.contenidoScroll}
      >
        {error && <Alerta variante="error" mensaje={error} />}

        <Text style={estilos.titulo}>Sesión rápida</Text>
        <Text style={estilos.texto}>
          {ejercicios.length} ejercicio(s) guiados por voz. En cada uno
          escucharás el nombre y la instrucción, y responderás con los botones.
          Gana puntos, sube de nivel y consigue insignias.
        </Text>

        {ejercicios.map((ejercicio, indice) => (
          <View key={ejercicio.id_ejercicio} style={estilos.tarjeta}>
            <Text style={estilos.tarjetaTitulo}>
              {indice + 1}. {ejercicio.nombre}
            </Text>
            <Text style={estilos.tarjetaTexto}>{ejercicio.descripcion}</Text>
            <Text style={estilos.tarjetaSutil}>
              Dificultad {ejercicio.dificultad}/5 · {ejercicio.puntos_base}{' '}
              puntos
            </Text>
          </View>
        ))}

        <Boton
          etiqueta="🎙️ Comenzar sesión"
          onPress={() => void comenzar()}
          cargando={enviando}
        />
      </ScrollView>
    );
  }

  if (fase.fase === 'fin') {
    const { resumen } = fase;
    return (
      <ScrollView
        style={estilos.pantalla}
        contentContainerStyle={estilos.contenidoScroll}
      >
        <Text style={estilos.titulo}>
          {resumen.sesion.estado === 'COMPLETADA'
            ? '🎉 ¡Sesión completada!'
            : 'Sesión finalizada'}
        </Text>

        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaTitulo}>
            Puntos de la sesión: {resumen.sesion.puntos_obtenidos}
          </Text>
          <Text style={estilos.tarjetaTexto}>
            Total: {resumen.progreso.puntos_totales} puntos · Nivel{' '}
            {resumen.progreso.nivel} · Racha {resumen.progreso.racha_actual}
          </Text>
          {resumen.desafio_asignado ? (
            <Text style={estilos.tarjetaTexto}>
              🎯 Nuevo desafío: {resumen.desafio_asignado.ejercicio_nombre}{' '}
              (dificultad {resumen.desafio_asignado.dificultad_asignada}/5)
            </Text>
          ) : null}
          {resumen.insignias_nuevas?.length ? (
            <Text style={estilos.tarjetaTexto}>
              🏅 Insignias nuevas: {resumen.insignias_nuevas.join(', ')}
            </Text>
          ) : null}
        </View>

        <Boton
          etiqueta="Volver al VisionCoach"
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    );
  }

  // ─── Fase ejercicio activo ───
  const actual = ejercicios[fase.indice];

  return (
    <View style={estilos.pantalla}>
      <View style={estilos.contenidoEjercicio}>
        {error && <Alerta variante="error" mensaje={error} />}

        <Text style={estilos.contador}>
          Ejercicio {fase.indice + 1} de {ejercicios.length}
        </Text>

        <Text style={estilos.tituloEjercicio}>{actual?.nombre}</Text>
        <Text style={estilos.descripcionEjercicio}>{actual?.descripcion}</Text>

        <View style={estilos.botonera}>
          <Boton
            etiqueta="✅ Lo logré"
            onPress={() => void responder(true)}
            cargando={enviando}
            deshabilitado={enviando || abandonando}
          />
          <Boton
            etiqueta="❌ No pude"
            variante="secundario"
            onPress={() => void responder(false)}
            cargando={enviando}
            deshabilitado={enviando || abandonando}
          />
          <Boton
            etiqueta="Terminar sesión"
            variante="secundario"
            onPress={() => void abandonar()}
            deshabilitado={enviando || abandonando}
          />
        </View>

        <Text style={estilos.sutil}>
          Escucha la instrucción con calma y responde cuando termines.
        </Text>
      </View>
    </View>
  );
}

/* ═══════════════════ ESTILOS ═══════════════════ */

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  contenidoScroll: {
    padding: tamaños.lg,
    gap: tamaños.md,
    paddingBottom: tamaños.xl,
  },
  contenidoEjercicio: {
    flex: 1,
    padding: tamaños.lg,
    gap: tamaños.md,
    justifyContent: 'center',
  },

  titulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXXL,
    fontWeight: '700',
  },
  texto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    lineHeight: 22,
  },

  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    gap: 4,
  },
  tarjetaTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
  },
  tarjetaTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },
  tarjetaSutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },

  contador: {
    color: colores.primario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
    textAlign: 'center',
  },
  tituloEjercicio: {
    color: colores.texto,
    fontSize: tamaños.fuenteXXL,
    fontWeight: '700',
    textAlign: 'center',
  },
  descripcionEjercicio: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteLG,
    lineHeight: 26,
    textAlign: 'center',
  },

  botonera: {
    gap: tamaños.md,
    marginTop: tamaños.lg,
  },

  centro: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tamaños.md,
  },
  centroTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    textAlign: 'center',
    lineHeight: 22,
  },
  sutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    textAlign: 'center',
    lineHeight: 18,
  },
});
