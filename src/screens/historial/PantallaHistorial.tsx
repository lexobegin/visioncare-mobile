import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  listarActividades,
  obtenerResumenActividad,
} from '@/api/historial.api';
import { Alerta } from '@/components/Alerta';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import type {
  Actividad,
  FuenteActividad,
  ResumenActividad,
} from '@/types';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * HISTORIAL DE ACTIVIDADES (CU23):
 *
 *   - Feed CONSOLIDADO (eventos + comandos de voz + capturas)
 *     o solo eventos explícitos (toggle).
 *   - Resumen: chips con conteos por tipo (toca = filtrar).
 *   - Scroll infinito (páginas de 20) + pull-to-refresh.
 *   - Accesible: tocar una actividad la narra completa.
 * ══════════════════════════════════════════════════════
 */

const LIMITE_PAGINA = 20;

const ICONO_FUENTE: Record<FuenteActividad, string> = {
  EVENTO: '📋',
  VOZ: '🎤',
  CAPTURA: '📷',
};

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PantallaHistorial() {
  const { anunciar } = useTTS();

  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [resumen, setResumen] = useState<ResumenActividad[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null);
  const [consolidado, setConsolidado] = useState(true);

  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Carga de una página ───
  const cargar = useCallback(
    async (paginaPedida: number, acumular: boolean) => {
      if (acumular) setCargandoMas(true);
      else setCargando(true);
      setError(null);

      try {
        const respuesta = await listarActividades({
          page: paginaPedida,
          limit: LIMITE_PAGINA,
          consolidado,
          ...(tipoFiltro && { tipo_actividad: tipoFiltro }),
        });

        setActividades((prev) =>
          acumular ? [...prev, ...respuesta.datos] : respuesta.datos,
        );
        setPagina(respuesta.meta.page);
        setTotalPaginas(respuesta.meta.totalPaginas);
      } catch (e) {
        setError(mensajeDeError(e));
        if (!acumular) setActividades([]);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    [consolidado, tipoFiltro],
  );

  // Reinicia al cambiar filtros
  useEffect(() => {
    void cargar(1, false);
  }, [cargar]);

  // Resumen de conteos (independiente del filtro actual)
  useEffect(() => {
    let vigente = true;
    obtenerResumenActividad()
      .then((r) => {
        if (vigente) setResumen(r);
      })
      .catch(() => {
        if (vigente) setResumen([]);
      });
    return () => {
      vigente = false;
    };
  }, []);

  // ─── Acciones ───
  function filtrarPor(tipo: string | null) {
    setTipoFiltro((actual) => (actual === tipo ? null : tipo));
    anunciar(
      tipo
        ? `Filtrando por ${tipo}. Toca de nuevo para quitar el filtro.`
        : 'Mostrando todas las actividades.',
    );
  }

  function narrarActividad(item: Actividad) {
    const partes = [
      item.tipo_actividad,
      item.descripcion ?? '',
      formatearFecha(item.fecha),
    ].filter(Boolean);
    anunciar(partes.join('. '), { forzar: true });
  }

  const renderItem = useCallback(
    ({ item }: { item: Actividad }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.tipo_actividad}. ${item.descripcion ?? ''}`}
        onPress={() => narrarActividad(item)}
        style={({ pressed }) => [
          estilos.item,
          pressed && { opacity: 0.75 },
        ]}
      >
        <Text aria-hidden style={estilos.itemIcono}>
          {ICONO_FUENTE[item.fuente] ?? '📋'}
        </Text>
        <View style={estilos.itemTextos}>
          <Text style={estilos.itemTipo}>{item.tipo_actividad}</Text>
          {item.descripcion ? (
            <Text style={estilos.itemDescripcion} numberOfLines={2}>
              {item.descripcion}
            </Text>
          ) : null}
          <Text style={estilos.itemFecha}>{formatearFecha(item.fecha)}</Text>
        </View>
      </Pressable>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const puedeCargarMas = pagina < totalPaginas;

  return (
    <View style={estilos.pantalla}>
      {/* ─── Resumen: chips de conteo (toca = filtrar) ─── */}
      {resumen.length > 0 && (
        <View style={estilos.resumenZona}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={estilos.resumenChips}>
              {resumen.map((r) => {
                const activo = tipoFiltro === r.tipo_actividad;
                return (
                  <Pressable
                    key={`${r.tipo_actividad}-${r.fuente}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrar por ${r.tipo_actividad}: ${r.total} registros`}
                    accessibilityState={{ selected: activo }}
                    onPress={() => filtrarPor(r.tipo_actividad)}
                    style={[
                      estilos.chip,
                      activo && estilos.chipActivo,
                    ]}
                  >
                    <Text
                      style={[
                        estilos.chipTexto,
                        activo && estilos.chipTextoActivo,
                      ]}
                    >
                      {r.tipo_actividad} · {r.total}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Toggle del feed consolidado */}
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: consolidado }}
            accessibilityLabel="Feed consolidado: incluir voz y capturas"
            onPress={() => setConsolidado((c) => !c)}
            style={estilos.toggleConsolidado}
          >
            <Text style={estilos.toggleTexto}>
              {consolidado ? '🧩 Feed consolidado' : '📋 Solo eventos'}
            </Text>
          </Pressable>
        </View>
      )}

      {error && <Alerta variante="error" mensaje={error} />}

      <FlatList
        data={actividades}
        keyExtractor={(_, indice) => `${indice}-${actividades[indice]?.fecha}`}
        renderItem={renderItem}
        contentContainerStyle={estilos.lista}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!cargando && !cargandoMas && puedeCargarMas) {
            void cargar(pagina + 1, true);
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={cargando && actividades.length > 0}
            onRefresh={() => void cargar(1, false)}
            tintColor={colores.primario}
          />
        }
        ListEmptyComponent={
          cargando ? (
            <View style={estilos.centro}>
              <ActivityIndicator size="large" color={colores.primario} />
              <Text style={estilos.centroTexto}>Cargando actividades…</Text>
            </View>
          ) : (
            <View style={estilos.centro}>
              <Text aria-hidden style={estilos.centroIcono}>
                📜
              </Text>
              <Text style={estilos.centroTexto}>
                {tipoFiltro
                  ? `Sin actividades de tipo ${tipoFiltro}.`
                  : 'Aún no hay actividades registradas. Tu historial crece con cada uso de la app.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          cargandoMas ? (
            <ActivityIndicator
              style={estilos.pie}
              color={colores.primario}
            />
          ) : actividades.length > 0 && !puedeCargarMas ? (
            <Text style={estilos.finLista}>
              — No hay más actividades —
            </Text>
          ) : null
        }
      />
    </View>
  );
}

/* ═══════════════════ ESTILOS ═══════════════════ */

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  resumenZona: {
    paddingHorizontal: tamaños.md,
    paddingTop: tamaños.md,
    gap: tamaños.sm,
  },
  resumenChips: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: tamaños.sm,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colores.superficieClara,
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: tamaños.redondo,
    paddingHorizontal: tamaños.md,
    paddingVertical: 8,
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
  chipActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  chipTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    fontWeight: '600',
  },
  chipTextoActivo: { color: '#ffffff' },
  toggleConsolidado: {
    alignSelf: 'flex-start',
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
  toggleTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600',
  },

  lista: {
    padding: tamaños.md,
    paddingBottom: tamaños.xl,
    gap: tamaños.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    gap: tamaños.sm,
  },
  itemIcono: { fontSize: 22, marginTop: 2 },
  itemTextos: { flex: 1, gap: 2 },
  itemTipo: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  itemDescripcion: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    lineHeight: 17,
  },
  itemFecha: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },

  pie: { marginVertical: tamaños.md },
  finLista: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    textAlign: 'center',
    paddingVertical: tamaños.md,
  },

  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tamaños.xl,
    gap: tamaños.sm,
  },
  centroIcono: { fontSize: 48 },
  centroTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteMD,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: tamaños.lg,
  },
});
