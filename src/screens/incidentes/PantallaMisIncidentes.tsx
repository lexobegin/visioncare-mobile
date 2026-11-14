import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  cambiarEstadoIncidente,
  listarMisIncidentes,
  obtenerDetalleIncidente,
} from '@/api/incidentes.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import type { EstadoIncidente, Incidente } from '@/types';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * MIS INCIDENTES (CU22 — seguimiento):
 *
 *   - Listado con filtro por estado + paginación incremental.
 *   - Toca un incidente → detalle: descripción, evidencias y
 *     enlace al mapa.
 *   - Como dueño puedes marcar RESUELTO o reabrir (ABIERTO);
 *     la revisión/severidad la gestiona la web (CU38).
 * ══════════════════════════════════════════════════════
 */

const LIMITE_PAGINA = 20;

const FILTROS: (EstadoIncidente | 'TODOS')[] = [
  'TODOS',
  'ABIERTO',
  'EN_REVISION',
  'RESUELTO',
  'CERRADO',
];

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PantallaMisIncidentes() {
  const { anunciar } = useTTS();

  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [filtro, setFiltro] = useState<EstadoIncidente | 'TODOS'>('TODOS');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detalle expandido
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Incidente | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const cargar = useCallback(
    async (paginaPedida: number, acumular: boolean) => {
      if (acumular) setCargandoMas(true);
      else setCargando(true);
      setError(null);

      try {
        const respuesta = await listarMisIncidentes({
          page: paginaPedida,
          limit: LIMITE_PAGINA,
          ...(filtro !== 'TODOS' && { estado: filtro }),
        });

        setIncidentes((prev) =>
          acumular ? [...prev, ...respuesta.datos] : respuesta.datos,
        );
        setPagina(respuesta.meta.page);
        setTotalPaginas(respuesta.meta.totalPaginas);
      } catch (e) {
        setError(mensajeDeError(e));
        if (!acumular) setIncidentes([]);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    [filtro],
  );

  useEffect(() => {
    void cargar(1, false);
  }, [cargar]);

  async function abrirDetalle(id: number) {
    if (seleccion === id) {
      setSeleccion(null);
      setDetalle(null);
      return;
    }

    setSeleccion(id);
    setDetalle(null);
    setCargandoDetalle(true);

    try {
      setDetalle(await obtenerDetalleIncidente(id));
    } catch (e) {
      setError(mensajeDeError(e));
      setSeleccion(null);
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function cambiarEstado(
    incidente: Incidente,
    estado: EstadoIncidente,
  ) {
    setActualizando(true);
    setError(null);

    try {
      await cambiarEstadoIncidente(incidente.id_incidente, { estado });
      anunciar(
        estado === 'RESUELTO'
          ? `Incidente número ${incidente.id_incidente} marcado como resuelto.`
          : `Incidente número ${incidente.id_incidente} reabierto.`,
        { forzar: true },
      );
      setSeleccion(null);
      setDetalle(null);
      void cargar(1, false);
    } catch (e) {
      const m = mensajeDeError(e);
      setError(m);
      anunciar(`No se pudo actualizar. ${m}`, { forzar: true });
    } finally {
      setActualizando(false);
    }
  }

  function abrirMapa(url: string) {
    void Linking.openURL(url);
  }

  const renderItem = useCallback(
    ({ item }: { item: Incidente }) => {
      const expandido = seleccion === item.id_incidente;

      return (
        <View style={estilos.itemZona}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Incidente ${item.tipo_incidente.replace(/_/g, ' ').toLowerCase()}, estado ${item.estado.toLowerCase()}. Toca para ver detalle.`}
            onPress={() => void abrirDetalle(item.id_incidente)}
            style={({ pressed }) => [
              estilos.item,
              expandido && estilos.itemExpandido,
              pressed && { opacity: 0.8 },
            ]}
          >
            <View style={estilos.itemCabecera}>
              <Text style={estilos.itemTipo}>
                {item.tipo_incidente.replace(/_/g, ' ')}
              </Text>
              <Text style={estilos.itemEstado}>{item.estado}</Text>
            </View>
            <View style={estilos.itemPie}>
              <Text style={estilos.itemSeveridad}>{item.severidad}</Text>
              <Text style={estilos.itemFecha}>
                {formatearFecha(item.fecha_incidente)}
              </Text>
            </View>
          </Pressable>

          {/* ─── Detalle expandido ─── */}
          {expandido && (
            <View style={estilos.detalle}>
              {cargandoDetalle && !detalle ? (
                <ActivityIndicator color={colores.primario} />
              ) : detalle ? (
                <>
                  {detalle.descripcion ? (
                    <Text style={estilos.detalleTexto}>
                      {detalle.descripcion}
                    </Text>
                  ) : null}

                  <Text style={estilos.detalleSutil}>
                    Reportado: {formatearFecha(detalle.fecha_incidente)}
                    {detalle.fecha_cierre
                      ? ` · Cerrado: ${formatearFecha(detalle.fecha_cierre)}`
                      : ''}
                  </Text>

                  {detalle.url_mapa && (
                    <Boton
                      etiqueta="🗺️ Ver ubicación en el mapa"
                      variante="secundario"
                      onPress={() => abrirMapa(detalle.url_mapa!)}
                    />
                  )}

                  {detalle.evidencias && detalle.evidencias.length > 0 && (
                    <View style={estilos.evidencias}>
                      {detalle.evidencias
                        .filter((e) => e.tipo_archivo === 'IMAGEN' && e.url_publica)
                        .slice(0, 3)
                        .map((e) => (
                          <Image
                            key={e.id_evidencia}
                            source={{ uri: e.url_publica! }}
                            style={estilos.evidenciaImagen}
                          />
                        ))}
                      <Text style={estilos.detalleSutil}>
                        {detalle.evidencias.length} evidencia(s) adjunta(s)
                      </Text>
                    </View>
                  )}

                  {/* Ciclo de estado del dueño */}
                  {detalle.estado === 'RESUELTO' ||
                  detalle.estado === 'CERRADO' ? (
                    <Boton
                      etiqueta="↩️ Reabrir (no quedó resuelto)"
                      variante="secundario"
                      onPress={() => void cambiarEstado(detalle, 'ABIERTO')}
                      deshabilitado={actualizando}
                    />
                  ) : (
                    <Boton
                      etiqueta="✅ Yo mismo lo resolví"
                      onPress={() => void cambiarEstado(detalle, 'RESUELTO')}
                      cargando={actualizando}
                    />
                  )}
                </>
              ) : null}
            </View>
          )}
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seleccion, detalle, cargandoDetalle, actualizando],
  );

  const puedeCargarMas = pagina < totalPaginas;

  return (
    <View style={estilos.pantalla}>
      {/* ─── Filtros por estado ─── */}
      <View style={estilos.filtros}>
        {FILTROS.map((f) => {
          const activo = filtro === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`Filtrar por estado ${f.toLowerCase()}`}
              onPress={() => setFiltro(f)}
              style={[estilos.chip, activo && estilos.chipActivo]}
            >
              <Text
                style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}
              >
                {f === 'TODOS' ? 'Todos' : f.replace('_', ' ')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Alerta variante="error" mensaje={error} />}

      <FlatList
        data={incidentes}
        keyExtractor={(item) => String(item.id_incidente)}
        renderItem={renderItem}
        extraData={seleccion}
        contentContainerStyle={estilos.lista}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!cargando && !cargandoMas && puedeCargarMas) {
            void cargar(pagina + 1, true);
          }
        }}
        ListEmptyComponent={
          cargando ? (
            <View style={estilos.centro}>
              <ActivityIndicator size="large" color={colores.primario} />
              <Text style={estilos.centroTexto}>Cargando incidentes…</Text>
            </View>
          ) : (
            <View style={estilos.centro}>
              <Text aria-hidden style={estilos.centroIcono}>
                🚧
              </Text>
              <Text style={estilos.centroTexto}>
                No tienes incidentes con este filtro. Cuando reportes uno
                desde "Reportar incidente" aparecerá aquí con su estado.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          cargandoMas ? (
            <ActivityIndicator style={estilos.pie} color={colores.primario} />
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
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tamaños.sm,
    padding: tamaños.md,
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

  lista: {
    padding: tamaños.md,
    paddingTop: 0,
    paddingBottom: tamaños.xl,
    gap: tamaños.sm,
  },
  itemZona: { gap: 0 },
  item: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.md,
    gap: 6,
  },
  itemExpandido: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  itemCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTipo: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    flex: 1,
  },
  itemEstado: {
    color: colores.info,
    fontSize: tamaños.fuenteXS,
    fontWeight: '700',
  },
  itemPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemSeveridad: {
    color: colores.advertencia,
    fontSize: tamaños.fuenteXS,
    fontWeight: '600',
  },
  itemFecha: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },

  detalle: {
    backgroundColor: colores.superficieClara,
    borderBottomLeftRadius: tamaños.radioMD,
    borderBottomRightRadius: tamaños.radioMD,
    padding: tamaños.md,
    gap: tamaños.sm,
  },
  detalleTexto: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },
  detalleSutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },
  evidencias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tamaños.sm,
  },
  evidenciaImagen: {
    width: 64,
    height: 64,
    borderRadius: tamaños.radioSM,
  },

  pie: { marginVertical: tamaños.md },

  centro: {
    alignItems: 'center',
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
