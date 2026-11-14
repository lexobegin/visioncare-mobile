import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  actualizarDesafioVc,
  listarDesafiosVc,
  listarMisInsigniasVc,
  obtenerProgresoVc,
} from '@/api/visioncoach.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { colores, tamaños } from '@/constants/tema';
import type { MasStackParamList } from '@/navigation/NavigationTypes';
import { useTTS } from '@/hooks/useTTS';
import {
  vibrarNotificacion,
} from '@/services/haptics.service';
import type {
  DesafioVc,
  EstadoDesafioPayload,
  InsigniaVc,
  ProgresoVc,
} from '@/types';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * VISIONCOACH — HUB (CU27–CU33):
 *
 *   ┌──────────────────────────────────────┐
 *   │ Nivel · Puntos · Racha · Insignias   │  ← mi progreso (CU30)
 *   ├──────────────────────────────────────┤
 *   │ [ ▶️ Entrenar ahora ]                 │  → PantallaSesionVC
 *   ├──────────────────────────────────────┤
 *   │ Mis desafíos (CU31) + acciones       │
 *   │ Mis insignias (CU33)                 │
 *   └──────────────────────────────────────┘
 *
 * Todo lo que anuncia el backend en `mensaje_voz` se narra.
 * ══════════════════════════════════════════════════════
 */

function colorEstadoDesafio(estado: string): string {
  const mapa: Record<string, string> = {
    ASIGNADO: colores.info,
    EN_CURSO: colores.advertencia,
    COMPLETADO: colores.exito,
    OMITIDO: colores.textoSutil,
  };
  return mapa[estado] ?? colores.textoSutil;
}

export default function PantallaVisionCoach() {
  const { anunciar } = useTTS();
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();

  const [progreso, setProgreso] = useState<ProgresoVc | null>(null);
  const [desafios, setDesafios] = useState<DesafioVc[]>([]);
  const [misInsignias, setMisInsignias] = useState<InsigniaVc[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardandoDesafio, setGuardandoDesafio] = useState<number | null>(null);

  useEffect(() => {
    anunciar(
      'VisionCoach: tus entrenamientos de habilidades visuales. Pulsa entrenar para comenzar una sesión guiada por voz.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [p, listaDesafios, insignias] = await Promise.all([
        obtenerProgresoVc(),
        listarDesafiosVc(),
        listarMisInsigniasVc(),
      ]);

      setProgreso(p);
      setDesafios(listaDesafios);
      setMisInsignias(insignias);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarDesafio = useCallback(
    async (desafio: DesafioVc, estado: EstadoDesafioPayload) => {
      setGuardandoDesafio(desafio.id_desafio);
      setError(null);

      try {
        await actualizarDesafioVc(desafio.id_desafio, { estado });
        void vibrarNotificacion();
        anunciar(
          estado === 'COMPLETADO'
            ? `¡Muy bien! Desafío completado: ${desafio.ejercicio_nombre ?? 'ejercicio'}.`
            : estado === 'EN_CURSO'
              ? 'Desafío en curso. Complétalo en tu próxima sesión.'
              : 'Desafío omitido.',
          { forzar: true },
        );
        void cargar(); // refresca la lista
      } catch (e) {
        setError(mensajeDeError(e));
      } finally {
        setGuardandoDesafio(null);
      }
    },
    [anunciar, cargar],
  );

  const desafiosActivos = desafios.filter(
    (d) => d.estado === 'ASIGNADO' || d.estado === 'EN_CURSO',
  );

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      {error && <Alerta variante="error" mensaje={error} />}

      {cargando && !progreso ? (
        <View style={estilos.centro}>
          <ActivityIndicator size="large" color={colores.primario} />
          <Text style={estilos.centroTexto}>Cargando tu progreso…</Text>
        </View>
      ) : progreso ? (
        <>
          {/* ─── Mi progreso (CU30) ─── */}
          <View style={estilos.kpis}>
            <View style={estilos.kpi}>
              <Text style={estilos.kpiValor}>{progreso.nivel}</Text>
              <Text style={estilos.kpiEtiqueta}>Nivel</Text>
            </View>
            <View style={estilos.kpi}>
              <Text style={estilos.kpiValor}>{progreso.puntos_totales}</Text>
              <Text style={estilos.kpiEtiqueta}>Puntos</Text>
            </View>
            <View style={estilos.kpi}>
              <Text style={estilos.kpiValor}>
                {progreso.racha_actual}
                <Text style={estilos.kpiSutil}>
                  {' '}
                  /{progreso.mejor_racha}
                </Text>
              </Text>
              <Text style={estilos.kpiEtiqueta}>Racha</Text>
            </View>
            <View style={estilos.kpi}>
              <Text style={estilos.kpiValor}>{misInsignias.length}</Text>
              <Text style={estilos.kpiEtiqueta}>Insignias</Text>
            </View>
          </View>

          {/* ─── Entrenar (CU28) ─── */}
          <Boton
            etiqueta="▶️ Entrenar ahora (sesión guiada por voz)"
            onPress={() => {
              anunciar('Abriendo sesión de entrenamiento.');
              navigation.navigate('SesionVisionCoach');
            }}
          />

          {/* ─── Mis desafíos (CU31) ─── */}
          <Text style={estilos.seccion}>
            Mis desafíos adaptativos
            {desafiosActivos.length > 0
              ? ` (${desafiosActivos.length} activos)`
              : ''}
          </Text>

          {desafios.length === 0 ? (
            <Text style={estilos.sutil}>
              Aún no tienes desafíos. Se generan automáticamente al completar
              sesiones, según tu rendimiento.
            </Text>
          ) : (
            desafios.map((desafio) => (
              <View key={desafio.id_desafio} style={estilos.tarjeta}>
                <View style={estilos.tarjetaCabecera}>
                  <Text style={estilos.tarjetaTitulo}>
                    {desafio.ejercicio_nombre ??
                      `Ejercicio ${desafio.id_ejercicio}`}
                  </Text>
                  <Text
                    style={[
                      estilos.tarjetaEstado,
                      { color: colorEstadoDesafio(desafio.estado) },
                    ]}
                  >
                    {desafio.estado.replace('_', ' ')}
                  </Text>
                </View>

                <Text style={estilos.tarjetaSutil}>
                  Dificultad {desafio.dificultad_asignada} de 5
                </Text>

                {desafio.motivo_adaptacion ? (
                  <Text style={estilos.tarjetaTexto}>
                    {desafio.motivo_adaptacion}
                  </Text>
                ) : null}

                {(desafio.estado === 'ASIGNADO' ||
                  desafio.estado === 'EN_CURSO') && (
                  <View style={estilos.acciones}>
                    {desafio.estado === 'ASIGNADO' && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Marcar desafío en curso"
                        onPress={() =>
                          void cambiarDesafio(desafio, 'EN_CURSO')
                        }
                        disabled={guardandoDesafio === desafio.id_desafio}
                        style={estilos.accionSecundaria}
                      >
                        <Text style={estilos.accionSecundariaTexto}>
                          Empezar
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Marcar desafío como completado"
                      onPress={() =>
                        void cambiarDesafio(desafio, 'COMPLETADO')
                      }
                      disabled={guardandoDesafio === desafio.id_desafio}
                      style={estilos.accionExito}
                    >
                      <Text style={estilos.accionExitoTexto}>✅ Completé</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Omitir desafío"
                      onPress={() => void cambiarDesafio(desafio, 'OMITIDO')}
                      disabled={guardandoDesafio === desafio.id_desafio}
                      style={estilos.accionSecundaria}
                    >
                      <Text style={estilos.accionSecundariaTexto}>Omitir</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}

          {/* ─── Mis insignias (CU33) ─── */}
          <Text style={estilos.seccion}>🏅 Mis insignias</Text>
          {misInsignias.length === 0 ? (
            <Text style={estilos.sutil}>
              Todavía no tienes insignias. Completa ejercicios y mantén rachas
              para conseguirlas.
            </Text>
          ) : (
            <View style={estilos.insignias}>
              {misInsignias.map((insignia) => (
                <View key={insignia.id_insignia} style={estilos.insignia}>
                  <Text style={estilos.insigniaNombre}>
                    🏅 {insignia.nombre.replace(/_/g, ' ')}
                  </Text>
                  <Text style={estilos.insigniaDescripcion}>
                    {insignia.descripcion}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <Text style={estilos.centroTexto}>
          No se pudo cargar el progreso. Revisa la conexión e inténtalo de
          nuevo.
        </Text>
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
    gap: tamaños.md,
  },

  kpis: {
    flexDirection: 'row',
    gap: tamaños.sm,
  },
  kpi: {
    flex: 1,
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
    alignItems: 'center',
    gap: 2,
  },
  kpiValor: {
    color: colores.texto,
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
  },
  kpiSutil: {
    fontSize: tamaños.fuenteSM,
    color: colores.textoSutil,
    fontWeight: '600',
  },
  kpiEtiqueta: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },

  seccion: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
    marginTop: tamaños.sm,
  },

  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    gap: 4,
  },
  tarjetaCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tarjetaTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    flex: 1,
  },
  tarjetaEstado: {
    fontSize: tamaños.fuenteXS,
    fontWeight: '700',
  },
  tarjetaSutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },
  tarjetaTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },

  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tamaños.sm,
    marginTop: tamaños.xs,
  },
  accionExito: {
    backgroundColor: colores.exito,
    borderRadius: tamaños.radioSM,
    paddingHorizontal: tamaños.md,
    minHeight: tamaños.botonAlturaSM,
    justifyContent: 'center',
  },
  accionExitoTexto: {
    color: '#ffffff',
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  accionSecundaria: {
    backgroundColor: colores.superficieClara,
    borderRadius: tamaños.radioSM,
    paddingHorizontal: tamaños.md,
    minHeight: tamaños.botonAlturaSM,
    justifyContent: 'center',
  },
  accionSecundariaTexto: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600',
  },

  insignias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tamaños.sm,
  },
  insignia: {
    backgroundColor: colores.exitoFondo,
    borderColor: colores.exito,
    borderWidth: 1,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    width: '100%',
    gap: 2,
  },
  insigniaNombre: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  insigniaDescripcion: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    lineHeight: 17,
  },

  centro: {
    alignItems: 'center',
    paddingVertical: tamaños.xl,
    gap: tamaños.sm,
  },
  centroTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    textAlign: 'center',
    lineHeight: 22,
  },
  sutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },
});
