import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  //atenderAlerta,
  //atenderAlertasLote,
  listarAlertas,
  //listarAlertasPendientes,
} from '@/api/alertas.api';

import { Alerta as BannerAlerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { PantallaCargando } from '@/components/PantallaCargando';
import { colores, tamaños } from '@/constants/tema';
import { useAlertas } from '@/hooks/useAlertas';
import { useTTS } from '@/hooks/useTTS';
import { mensajeDeError, type Alerta, type NivelAlerta } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Alertas (HU18/HU19) — 2 vistas con chips:
 *
 *   PENDIENTES → tarjetas por prioridad (CRITICO arriba);
 *                cada una: 🔊 Reproducir (voz+háptica) y
 *                auto-marca atendida; botón "todas atendidas"
 *   HISTORIAL  → chips de nivel + toggle atendidas/todas
 * ══════════════════════════════════════════════════════
 */

type Vista = 'pendientes' | 'historial';

/** Estilo por nivel (fondo, borde, texto) */
const ESTILO_NIVEL: Record<
  NivelAlerta,
  { fondo: string; borde: string; texto: string; etiqueta: string }
> = {
  CRITICO: {
    fondo: colores.peligroFondo,
    borde: colores.peligro,
    texto: '#fecaca',
    etiqueta: '🚨 CRÍTICO',
  },
  ALTO: {
    fondo: colores.advertenciaFondo,
    borde: colores.advertencia,
    texto: '#fde68a',
    etiqueta: '⚠️ ALTO',
  },
  MEDIO: {
    fondo: '#0c4a6e',
    borde: colores.info,
    texto: '#bae6fd',
    etiqueta: 'ℹ️ MEDIO',
  },
  BAJO: {
    fondo: colores.superficieClara,
    borde: colores.borde,
    texto: colores.textoSecundario,
    etiqueta: '· BAJO',
  },
};

const ICONO_TIPO: Record<string, string> = {
  OBSTACULO: '🚧',
  VEHICULO_CERCA: '🚗',
  PERSONA_CERCA: '🚶',
  SENAL_IMPORTANTE: '🚏',
  AYUDA_SOLICITADA: '🆘',
  SISTEMA: '⚙️',
};

const NIVELES: NivelAlerta[] = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO'];

export default function PantallaAlertas() {
  const { anunciar } = useTTS();
  const {
    pendientes,
    //meta,
    cargando,
    error,
    procesando,
    recargar,
    reproducirYAtender,
    atenderTodas,
  } = useAlertas();

  const [vista, setVista] = useState<Vista>('pendientes');
  const [nivelFiltro, setNivelFiltro] = useState<NivelAlerta | ''>('');
  const [soloAtendidas, setSoloAtendidas] = useState(false);
  const [historial, setHistorial] = useState<Alerta[]>([]);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);

  useEffect(() => {
    anunciar(
      pendientes.length > 0
        ? `Pantalla de alertas. Tienes ${pendientes.length} sin atender.`
        : 'Pantalla de alertas. No tienes alertas pendientes.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Historial (carga al entrar a la vista) ───
  const cargarHistorial = useCallback(async () => {
    setHistorialCargando(true);
    setErrorHistorial(null);
    try {
      //const { listarAlertas } = await import('@/api/alertas.api');
      const r = await listarAlertas({
        page: 1,
        limit: 30,
        ...(nivelFiltro && { nivel: nivelFiltro }),
        atendida: soloAtendidas ? 'true' : undefined,
      });
      setHistorial(r.datos);
    } catch (e) {
      setErrorHistorial(mensajeDeError(e));
    } finally {
      setHistorialCargando(false);
    }
  }, [nivelFiltro, soloAtendidas]);

  useEffect(() => {
    if (vista === 'historial') void cargarHistorial();
  }, [vista, cargarHistorial]);

  // ═══════════════ RENDER ═══════════════

  return (
    <View style={estilos.flex}>
      {/* ─── Chips de vista ─── */}
      <View style={estilos.chipsVista}>
        <ChipVista
          etiqueta={`Pendientes (${pendientes.length})`}
          activo={vista === 'pendientes'}
          onPress={() => setVista('pendientes')}
        />
        <ChipVista
          etiqueta="Historial"
          activo={vista === 'historial'}
          onPress={() => setVista('historial')}
        />
      </View>

      {/* ─── PENDIENTES ─── */}
      {vista === 'pendientes' ? (
        pendientes.length === 0 && !cargando ? (
          <Vacia
            icono="✅"
            titulo="Sin alertas pendientes"
            texto="Todo en orden. Las alertas de riesgo aparecerán aquí cuando se detecten."
          />
        ) : (
          <>
            {/* Acción global */}
            {pendientes.length > 1 && (
              <View style={estilos.zonaAccionGlobal}>
                <Boton
                  etiqueta="✓  Marcar todas como atendidas"
                  variante="secundario"
                  cargando={procesando}
                  onPress={() => void atenderTodas()}
                />
              </View>
            )}

            {error && (
              <View style={estilos.zonaAlerta}>
                <BannerAlerta variante="error" mensaje={error} />
              </View>
            )}

            <FlatList
              data={pendientes}
              keyExtractor={(a) => String(a.id_alerta)}
              renderItem={({ item }) => (
                <TarjetaPendiente
                  alerta={item}
                  procesando={procesando}
                  onReproducir={() => void reproducirYAtender(item)}
                />
              )}
              contentContainerStyle={estilos.lista}
              refreshControl={
                <RefreshControl
                  refreshing={cargando}
                  onRefresh={() => void recargar()}
                  tintColor={colores.primario}
                  colors={[colores.primario]}
                />
              }
            />
          </>
        )
      ) : (
        /* ─── HISTORIAL ─── */
        <>
          {/* Chips de nivel */}
          <View style={estilos.chipsFiltro}>
            <ChipVista
              etiqueta="Todos"
              activo={nivelFiltro === ''}
              onPress={() => setNivelFiltro('')}
            />
            {NIVELES.map((n) => (
              <ChipVista
                key={n}
                etiqueta={n}
                activo={nivelFiltro === n}
                onPress={() => setNivelFiltro(n)}
              />
            ))}
          </View>

          <View style={estilos.chipsFiltro}>
            <ChipVista
              etiqueta="Sin atender"
              activo={soloAtendidas}
              onPress={() => setSoloAtendidas((v) => !v)}
            />
            <Text style={estilos.hintFiltro}>
              {soloAtendidas
                ? 'Mostrando solo sin atender'
                : 'Mostrando todas'}
            </Text>
          </View>

          {errorHistorial && (
            <View style={estilos.zonaAlerta}>
              <BannerAlerta variante="error" mensaje={errorHistorial} />
            </View>
          )}

          {historialCargando ? (
            <PantallaCargando mensaje="Cargando historial…" />
          ) : historial.length === 0 ? (
            <Vacia
              icono="🗂️"
              titulo="Sin alertas en este filtro"
              texto="Ajusta los filtros para ver más resultados."
            />
          ) : (
            <FlatList
              data={historial}
              keyExtractor={(a) => `h-${a.id_alerta}`}
              renderItem={({ item }) => (
                <TarjetaHistorial alerta={item} onEscuchar={() => anunciar(item.mensaje, { forzar: item.nivel === 'CRITICO' })} />
              )}
              contentContainerStyle={estilos.lista}
            />
          )}
        </>
      )}
    </View>
  );
}

/* ═══════════════════ SUB-COMPONENTES ═══════════════════ */

function ChipVista(props: {
  etiqueta: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.etiqueta}
      accessibilityState={{ selected: props.activo }}
      onPress={props.onPress}
      style={({ pressed }) => [
        estilos.chip,
        props.activo && estilos.chipActivo,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[estilos.chipTexto, props.activo && estilos.chipTextoActivo]}>
        {props.etiqueta}
      </Text>
    </Pressable>
  );
}

/** Tarjeta de alerta pendiente — reproducible */
function TarjetaPendiente(props: {
  alerta: Alerta;
  procesando: boolean;
  onReproducir: () => void;
}) {
  const { alerta, procesando, onReproducir } = props;
  const nivel = ESTILO_NIVEL[alerta.nivel] ?? ESTILO_NIVEL.BAJO;

  return (
    <View
      style={[
        estilos.tarjeta,
        { backgroundColor: nivel.fondo, borderColor: nivel.borde },
      ]}
      accessibilityLabel={`Alerta ${alerta.nivel}: ${alerta.mensaje}`}
    >
      <View style={estilos.tarjetaCabecera}>
        <Text style={[estilos.nivelTexto, { color: nivel.texto }]}>
          {nivel.etiqueta}
        </Text>
        <Text style={[estilos.fecha, { color: nivel.texto }]}>
          {new Date(alerta.fecha_generacion).toLocaleString('es', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </Text>
      </View>

      <Text style={estilos.tipoTexto}>
        {ICONO_TIPO[alerta.tipo_alerta] ?? '🔔'}{' '}
        {alerta.tipo_alerta.replace(/_/g, ' ')}
      </Text>

      <Text style={[estilos.mensaje, { color: nivel.texto }]}>
        {alerta.mensaje}
      </Text>

      <View style={estilos.tarjetaPie}>
        <Text style={[estilos.canal, { color: nivel.texto }]}>
          Canal: {alerta.canal.replace(/_/g, ' ').toLowerCase()}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Escuchar y marcar atendida esta alerta`}
          onPress={onReproducir}
          disabled={procesando}
          style={({ pressed }) => [
            estilos.botonReproducir,
            procesando && { opacity: 0.5 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={estilos.botonReproducirTexto}>🔊  Escuchar</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Tarjeta compacta del historial */
function TarjetaHistorial(props: { alerta: Alerta; onEscuchar: () => void }) {
  const { alerta, onEscuchar } = props;
  const nivel = ESTILO_NIVEL[alerta.nivel] ?? ESTILO_NIVEL.BAJO;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Reproducir alerta: ${alerta.mensaje}`}
      onPress={onEscuchar}
      style={({ pressed }) => [
        estilos.tarjeta,
        estilos.tarjetaHistorial,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={estilos.tarjetaCabecera}>
        <Text style={[estilos.nivelTexto, { color: nivel.texto }]}>
          {nivel.etiqueta}
        </Text>
        <Text style={estilos.fecha}>
          {new Date(alerta.fecha_generacion).toLocaleString('es', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
          {'  ·  '}
          {alerta.atendida ? '✓ atendida' : '⏳ sin atender'}
        </Text>
      </View>
      <Text style={estilos.mensaje} numberOfLines={2}>
        {ICONO_TIPO[alerta.tipo_alerta] ?? '🔔'} {alerta.mensaje}
      </Text>
    </Pressable>
  );
}

function Vacia(props: {
  icono: string;
  titulo: string;
  texto: string;
}) {
  return (
    <View style={estilos.vacia}>
      <Text aria-hidden style={estilos.vaciaIcono}>
        {props.icono}
      </Text>
      <Text style={estilos.vaciaTitulo}>{props.titulo}</Text>
      <Text style={estilos.vaciaTexto}>{props.texto}</Text>
    </View>
  );
}

/* ═══════════════════ ESTILOS ═══════════════════ */

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  chipsVista: {
    flexDirection: 'row',
    gap: tamaños.sm,
    padding: tamaños.lg,
    paddingBottom: tamaños.sm,
  },
  chip: {
    borderRadius: tamaños.redondo,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingVertical: tamaños.sm,
    paddingHorizontal: tamaños.lg,
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
  chipActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  chipTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600',
  },
  chipTextoActivo: { color: '#ffffff' },
  chipsFiltro: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tamaños.xs,
    paddingHorizontal: tamaños.lg,
    paddingBottom: tamaños.sm,
    alignItems: 'center',
  },
  hintFiltro: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    marginLeft: tamaños.xs,
  },
  zonaAccionGlobal: { paddingHorizontal: tamaños.lg, paddingBottom: tamaños.sm },
  zonaAlerta: { paddingHorizontal: tamaños.lg, paddingBottom: tamaños.sm },
  lista: {
    padding: tamaños.lg,
    paddingBottom: tamaños.xl * 2,
    gap: tamaños.sm,
  },
  tarjeta: {
    borderRadius: tamaños.radioLG,
    borderWidth: 1,
    padding: tamaños.md,
  },
  tarjetaHistorial: {
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
  },
  tarjetaCabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nivelTexto: { fontSize: tamaños.fuenteXS, fontWeight: '700' },
  fecha: { fontSize: tamaños.fuenteXS, color: colores.textoSutil },
  tipoTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    fontWeight: '600',
    marginBottom: 4,
  },
  mensaje: {
    fontSize: tamaños.fuenteMD,
    lineHeight: 22,
    fontWeight: '600',
  },
  tarjetaPie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tamaños.sm,
  },
  canal: { fontSize: tamaños.fuenteXS },
  botonReproducir: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: tamaños.radioMD,
    paddingHorizontal: tamaños.md,
    height: tamaños.botonAlturaSM,
    justifyContent: 'center',
  },
  botonReproducirTexto: {
    color: '#ffffff',
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  vacia: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tamaños.sm,
    padding: tamaños.xl,
  },
  vaciaIcono: { fontSize: 56 },
  vaciaTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
    textAlign: 'center',
  },
  vaciaTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    textAlign: 'center',
  },
});