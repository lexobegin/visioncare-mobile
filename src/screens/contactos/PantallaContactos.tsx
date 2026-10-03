import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  activarContacto,
  desactivarContacto,
  listarMisContactos,
} from '@/api/contactos.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { CampoTexto } from '@/components/CampoTexto';
import { PantallaCargando } from '@/components/PantallaCargando';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import { mensajeDeError, type Contacto } from '@/types';
import { ModalFormularioContacto } from './ModalFormularioContacto';

/**
 * ══════════════════════════════════════════════════════
 * Contactos de confianza (CU05) — CRUD del propio usuario.
 *
 *   - FlatList paginada: pull-to-refresh + "cargar más"
 *   - Búsqueda debounced (400 ms) server-side
 *   - Filtro: Activos (default) / Todos
 *   - Crear/Editar → ModalFormularioContacto
 *   - Desactivar (con confirmación) / Reactivar directo
 *
 * Voz: apertura, resultados y errores (forzados).
 * ══════════════════════════════════════════════════════
 */

const LIMITE_PAGINA = 20;

type FiltroEstado = 'ACTIVO' | 'TODOS';
type ModoCarga = 'inicial' | 'refresco' | 'mas';

export default function PantallaContactos() {
  const { anunciar } = useTTS();

  // ─── Listado ───
  const [datos, setDatos] = useState<Contacto[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Búsqueda y filtro ───
  const [buscar, setBuscar] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('ACTIVO');

  // ─── Modales y acciones ───
  const [modalFormulario, setModalFormulario] = useState<
    'nuevo' | Contacto | null
  >(null);
  const [aDesactivar, setADesactivar] = useState<Contacto | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [alerta, setAlerta] = useState<{
    variante: 'exito' | 'error';
    texto: string;
  } | null>(null);

  // ─── Carga de una página (3 modos para UX correcta) ───
  const cargar = useCallback(
    async (paginaCargar: number, modo: ModoCarga) => {
      if (modo === 'inicial') setCargando(true);
      if (modo === 'mas') setCargandoMas(true);
      // 'refresco': RefreshControl ya muestra su indicador

      try {
        const respuesta = await listarMisContactos({
          page: paginaCargar,
          limit: LIMITE_PAGINA,
          buscar: busquedaAplicada || undefined,
          estado: filtroEstado,
        });

        setDatos((previas) =>
          modo === 'mas' ? [...previas, ...respuesta.datos] : respuesta.datos,
        );
        setPagina(paginaCargar);
        setHayMas(paginaCargar < respuesta.meta.totalPaginas);
        setError(null);
      } catch (e) {
        const m = mensajeDeError(e);
        setError(m);
        if (modo !== 'mas') setDatos([]);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    [busquedaAplicada, filtroEstado],
  );

  // Carga inicial + recarga al cambiar búsqueda/filtro
  useEffect(() => {
    void cargar(1, 'inicial');
  }, [cargar]);

  // Debounce de la búsqueda
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(buscar.trim());
    }, 400);
    return () => clearTimeout(temporizador);
  }, [buscar]);

  // Anuncio de pantalla
  useEffect(() => {
    anunciar(
      'Pantalla de contactos de confianza. ' +
        'Estas personas podrán ayudarte en caso de emergencia.',
    );
  }, [anunciar]);

  // ─── Acciones ───

  const onRefresh = useCallback(async () => {
    setRefrescando(true);
    await cargar(1, 'refresco');
    setRefrescando(false);
  }, [cargar]);

  function manejarGuardado(mensaje: string) {
    setModalFormulario(null);
    setAlerta({ variante: 'exito', texto: mensaje });
    anunciar(mensaje);
    void cargar(1, 'refresco');
  }

  async function confirmarDesactivacion() {
    if (!aDesactivar) return;
    setProcesando(true);
    try {
      const r = await desactivarContacto(aDesactivar.id_contacto);
      setAlerta({ variante: 'exito', texto: r.mensaje });
      anunciar(`${aDesactivar.nombre} desactivado.`);
      setADesactivar(null);
      void cargar(1, 'refresco');
    } catch (e) {
      const m = mensajeDeError(e);
      setAlerta({ variante: 'error', texto: m });
      anunciar(`Error. ${m}`, { forzar: true });
    } finally {
      setProcesando(false);
    }
  }

  async function reactivar(contacto: Contacto) {
    setProcesando(true);
    try {
      await activarContacto(contacto.id_contacto);
      setAlerta({ variante: 'exito', texto: `${contacto.nombre} reactivado.` });
      anunciar(`${contacto.nombre} reactivado.`);
      void cargar(1, 'refresco');
    } catch (e) {
      const m = mensajeDeError(e);
      setAlerta({ variante: 'error', texto: m });
      anunciar(`Error. ${m}`, { forzar: true });
    } finally {
      setProcesando(false);
    }
  }

  // ─── Render de fila ───
  function rendirFila({ item }: { item: Contacto }) {
    const inactivo = item.estado === 'INACTIVO';

    return (
      <View style={[estilos.tarjeta, inactivo && estilos.tarjetaInactiva]}>
        {/* Nombre + prioridad + estado */}
        <View style={estilos.cabeceraFila}>
          <View style={estilos.circuloPrioridad}>
            <Text style={estilos.prioridadTexto}>{item.prioridad}</Text>
          </View>

          <View style={estilos.nombreZona}>
            <Text style={estilos.nombre}>
              {item.nombre}
              {item.parentesco ? (
                <Text style={estilos.parentesco}>
                  {'  ·  '}
                  {item.parentesco}
                </Text>
              ) : null}
            </Text>
            {inactivo && (
              <Text style={estilos.estadoInactivo}>INACTIVO</Text>
            )}
          </View>
        </View>

        {/* Medios de contacto */}
        {item.telefono && (
          <Text style={estilos.medio}>📞  {item.telefono}</Text>
        )}
        {item.correo && (
          <Text style={estilos.medio}>✉️  {item.correo}</Text>
        )}

        {/* Autorizaciones */}
        <View style={estilos.chips}>
          <Text
            style={[
              estilos.chip,
              item.autorizado_ubicacion
                ? estilos.chipActivo
                : estilos.chipApagado,
            ]}
          >
            📍 {item.autorizado_ubicacion ? 'Ubicación' : 'Sin ubicación'}
          </Text>
          <Text
            style={[
              estilos.chip,
              item.autorizado_emergencias
                ? estilos.chipEmergencia
                : estilos.chipApagado,
            ]}
          >
            🚨 {item.autorizado_emergencias ? 'Emergencias' : 'Sin emergencias'}
          </Text>
        </View>

        {/* Acciones */}
        <View style={estilos.accionesFila}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar contacto ${item.nombre}`}
            onPress={() => setModalFormulario(item)}
            style={({ pressed }) => [
              estilos.accionBoton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={estilos.accionTexto}>✏️  Editar</Text>
          </Pressable>

          {inactivo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reactivar contacto ${item.nombre}`}
              disabled={procesando}
              onPress={() => void reactivar(item)}
              style={({ pressed }) => [
                estilos.accionBoton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={estilos.accionActivar}>▶️  Reactivar</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Desactivar contacto ${item.nombre}`}
              onPress={() => setADesactivar(item)}
              style={({ pressed }) => [
                estilos.accionBoton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={estilos.accionDesactivar}>⏸️  Desactivar</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // ─── Pantalla completa durante la 1ª carga ───
  if (cargando && datos.length === 0) {
    return <PantallaCargando mensaje="Cargando tus contactos…" />;
  }

  return (
    <View style={estilos.flex}>
      {/* ─── Alerta de resultado ─── */}
      {alerta && (
        <View style={estilos.zonaAlerta}>
          <Alerta
            variante={alerta.variante}
            mensaje={alerta.texto}
            onCerrar={() => setAlerta(null)}
          />
        </View>
      )}

      {/* ─── Búsqueda + filtro ─── */}
      <View style={estilos.controles}>
        <CampoTexto
          etiqueta="Buscar contacto"
          valor={buscar}
          onChangeText={setBuscar}
          placeholder="Nombre, teléfono o correo…"
          tipoTeclado="default"
        />

        <View style={estilos.chipsFiltro}>
          <ChipFiltro
            etiqueta="Activos"
            activo={filtroEstado === 'ACTIVO'}
            onPress={() => setFiltroEstado('ACTIVO')}
          />
          <ChipFiltro
            etiqueta="Todos"
            activo={filtroEstado === 'TODOS'}
            onPress={() => setFiltroEstado('TODOS')}
          />
        </View>
      </View>

      {/* ─── Error de carga ─── */}
      {error && (
        <View style={estilos.zonaAlerta}>
          <Alerta variante="error" mensaje={error} />
        </View>
      )}

      {/* ─── Lista ─── */}
      <FlatList
        data={datos}
        keyExtractor={(c) => String(c.id_contacto)}
        renderItem={rendirFila}
        contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => void onRefresh()}
            tintColor={colores.primario}
            colors={[colores.primario]}
          />
        }
        onEndReached={() => {
          if (hayMas && !cargandoMas && !refrescando) {
            void cargar(pagina + 1, 'mas');
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={estilos.vacio}>
            <Text aria-hidden style={estilos.vacioIcono}>
              📞
            </Text>
            <Text style={estilos.vacioTitulo}>
              {busquedaAplicada || filtroEstado === 'TODOS'
                ? 'Sin contactos para este criterio.'
                : 'Aún no tienes contactos de confianza.'}
            </Text>
            <Text style={estilos.vacioTexto}>
              Agrega a las personas que podrán ayudarte cuando lo
              necesites: familiares, amigos o cuidadores.
            </Text>
          </View>
        }
        ListFooterComponent={
          cargandoMas ? (
            <Text style={estilos.cargandoMas}>Cargando más…</Text>
          ) : null
        }
      />

      {/* ─── Botón nuevo contacto (fijo abajo) ─── */}
      <View style={estilos.zonaBoton}>
        <Boton
          etiqueta="➕  Nuevo contacto"
          onPress={() => setModalFormulario('nuevo')}
        />
      </View>

      {/* ─── Modal formulario ─── */}
      {modalFormulario && (
        <ModalFormularioContacto
          contacto={modalFormulario === 'nuevo' ? null : modalFormulario}
          onCerrar={() => setModalFormulario(null)}
          onGuardado={manejarGuardado}
        />
      )}

      {/* ─── Confirmación de desactivación ─── */}
      <Modal
        visible={aDesactivar !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setADesactivar(null)}
      >
        <View style={estilos.confirmFondo}>
          <View style={estilos.confirmCaja}>
            <Text style={estilos.confirmTitulo}>
              Desactivar contacto
            </Text>
            <Text style={estilos.confirmTexto}>
              ¿Desactivar a{' '}
              <Text style={estilos.confirmNombre}>{aDesactivar?.nombre}</Text>?
              Ya no recibirá tus solicitudes de ayuda ni tu ubicación. Sus
              datos se conservan y podrás reactivarlo después.
            </Text>

            <Boton
              etiqueta="Cancelar"
              variante="secundario"
              onPress={() => setADesactivar(null)}
              deshabilitado={procesando}
            />
            <View style={estilos.espacioConfirm} />
            <Boton
              etiqueta="Desactivar"
              variante="peligro"
              cargando={procesando}
              onPress={() => void confirmarDesactivacion()}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Chip de filtro (Activos / Todos) */
function ChipFiltro(props: {
  etiqueta: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Filtrar ${props.etiqueta.toLowerCase()}`}
      accessibilityState={{ selected: props.activo }}
      onPress={props.onPress}
      style={({ pressed }) => [
        estilos.filtroChip,
        props.activo && estilos.filtroChipActivo,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          estilos.filtroChipTexto,
          props.activo && estilos.filtroChipTextoActivo,
        ]}
      >
        {props.etiqueta}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  zonaAlerta: { paddingHorizontal: tamaños.lg, paddingTop: tamaños.sm },
  controles: {
    paddingHorizontal: tamaños.lg,
    paddingTop: tamaños.md,
  },
  chipsFiltro: {
    flexDirection: 'row',
    gap: tamaños.sm,
    marginBottom: tamaños.sm,
  },
  filtroChip: {
    borderRadius: tamaños.redondo,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingVertical: tamaños.sm,
    paddingHorizontal: tamaños.lg,
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
  filtroChipActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  filtroChipTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600',
  },
  filtroChipTextoActivo: { color: '#ffffff' },

  lista: {
    padding: tamaños.lg,
    paddingBottom: tamaños.xl * 3,
    gap: tamaños.sm,
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  tarjetaInactiva: { opacity: 0.6 },
  cabeceraFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tamaños.sm,
    marginBottom: tamaños.xs,
  },
  circuloPrioridad: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prioridadTexto: {
    color: '#ffffff',
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
  },
  nombreZona: { flex: 1 },
  nombre: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
  },
  parentesco: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteSM,
    fontWeight: '400',
  },
  estadoInactivo: {
    color: colores.advertencia,
    fontSize: tamaños.fuenteXS,
    fontWeight: '700',
  },
  medio: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    marginLeft: tamaños.xl + tamaños.xs,
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    gap: tamaños.xs,
    marginTop: tamaños.sm,
    marginLeft: tamaños.xl + tamaños.xs,
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: tamaños.redondo,
    paddingVertical: 4,
    paddingHorizontal: tamaños.sm,
    fontSize: tamaños.fuenteXS,
    fontWeight: '600',
    overflow: 'hidden',
  },
  chipActivo: { backgroundColor: '#0c4a6e', color: '#bae6fd' },
  chipEmergencia: {
    backgroundColor: colores.peligroFondo,
    color: '#fecaca',
  },
  chipApagado: { backgroundColor: colores.superficieClara, color: colores.textoSutil },

  accionesFila: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tamaños.md,
    marginTop: tamaños.md,
  },
  accionBoton: {
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
    paddingHorizontal: tamaños.sm,
  },
  accionTexto: {
    color: colores.primario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  accionDesactivar: {
    color: colores.peligro,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  accionActivar: {
    color: colores.exito,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },

  vacio: {
    alignItems: 'center',
    paddingVertical: tamaños.xl * 2,
    gap: tamaños.sm,
  },
  vacioIcono: { fontSize: 56 },
  vacioTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
    textAlign: 'center',
  },
  vacioTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    textAlign: 'center',
    paddingHorizontal: tamaños.lg,
  },
  cargandoMas: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteSM,
    textAlign: 'center',
    paddingVertical: tamaños.md,
  },

  zonaBoton: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: tamaños.lg,
    paddingBottom: tamaños.lg,
    paddingTop: tamaños.sm,
    backgroundColor: colores.fondo,
  },

  confirmFondo: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tamaños.lg,
  },
  confirmCaja: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.lg,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
    marginBottom: tamaños.sm,
  },
  confirmTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    lineHeight: 22,
    marginBottom: tamaños.lg,
  },
  confirmNombre: { color: colores.texto, fontWeight: '700' },
  espacioConfirm: { height: tamaños.sm },
});