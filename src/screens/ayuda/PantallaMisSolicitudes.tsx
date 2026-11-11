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
  atenderSolicitud,
  cancelarSolicitud,
  listarMisSolicitudes,
} from '@/api/ayuda.api';
import { Alerta as BannerAlerta } from '@/components/Alerta';
import { PantallaCargando } from '@/components/PantallaCargando';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import { mensajeDeError, type SolicitudAyuda } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Mis solicitudes de ayuda (CU20/CU23 — historial móvil).
 *
 * Estados visibles: ENVIADA (activa) / ATENDIDA / CANCELADA /
 * PENDIENTE (sin contactos notificados).
 * Acciones según estado: atender ✓ | cancelar ✕ (solo activas).
 * ══════════════════════════════════════════════════════
 */

const ICONO_ESTADO: Record<string, { texto: string; color: string }> = {
  ENVIADA: { texto: '📨 Enviada', color: colores.info },
  ATENDIDA: { texto: '✓ Atendida', color: colores.exito },
  CANCELADA: { texto: '✕ Cancelada', color: colores.textoSutil },
  PENDIENTE: { texto: '⏳ Pendiente', color: colores.advertencia },
};

export default function PantallaMisSolicitudes() {
  const { anunciar } = useTTS();

  const [datos, setDatos] = useState<SolicitudAyuda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [alerta, setAlerta] = useState<{
    variante: 'exito' | 'error';
    texto: string;
  } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await listarMisSolicitudes({ page: 1, limit: 30 });
      setDatos(r.datos);
    } catch (e) {
      setAlerta({ variante: 'error', texto: mensajeDeError(e) });
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    anunciar('Mis solicitudes de ayuda anteriores.');
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function manejarAtender(s: SolicitudAyuda) {
    setProcesando(true);
    try {
      const r = await atenderSolicitud(s.id_solicitud);
      setAlerta({ variante: 'exito', texto: r.mensaje });
      anunciar('Solicitud marcada como atendida.');
      void cargar();
    } catch (e) {
      setAlerta({ variante: 'error', texto: mensajeDeError(e) });
    } finally {
      setProcesando(false);
    }
  }

  async function manejarCancelar(s: SolicitudAyuda) {
    setProcesando(true);
    try {
      const r = await cancelarSolicitud(s.id_solicitud);
      setAlerta({ variante: 'exito', texto: r.mensaje });
      anunciar('Solicitud cancelada.');
      void cargar();
    } catch (e) {
      setAlerta({ variante: 'error', texto: mensajeDeError(e) });
    } finally {
      setProcesando(false);
    }
  }

  if (cargando) {
    return <PantallaCargando mensaje="Cargando tus solicitudes…" />;
  }

  return (
    <View style={estilos.flex}>
      {alerta && (
        <View style={estilos.zonaAlerta}>
          <BannerAlerta
            variante={alerta.variante}
            mensaje={alerta.texto}
            onCerrar={() => setAlerta(null)}
          />
        </View>
      )}

      <FlatList
        data={datos}
        keyExtractor={(s) => String(s.id_solicitud)}
        contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => {
              setRefrescando(true);
              void cargar();
            }}
            tintColor={colores.primario}
            colors={[colores.primario]}
          />
        }
        ListEmptyComponent={
          <View style={estilos.vacia}>
            <Text aria-hidden style={estilos.vaciaIcono}>
              🆘
            </Text>
            <Text style={estilos.vaciaTitulo}>
              No has solicitado ayuda todavía
            </Text>
            <Text style={estilos.vaciaTexto}>
              Cuando uses el botón de ayuda o el comando de voz, tus
              solicitudes aparecerán aquí con su estado.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const estado = ICONO_ESTADO[item.estado] ?? ICONO_ESTADO.PENDIENTE;
          const activa =
            item.estado === 'ENVIADA' || item.estado === 'PENDIENTE';

          return (
            <View style={estilos.tarjeta}>
              <View style={estilos.cabecera}>
                <Text style={estilos.tipo}>
                  {item.tipo === 'EMERGENCIA' ? '🚨' : '🆘'}{' '}
                  {item.tipo}
                </Text>
                <Text style={[estilos.estado, { color: estado.color }]}>
                  {estado.texto}
                </Text>
              </View>

              <Text style={estilos.fecha}>
                {new Date(item.fecha_solicitud).toLocaleString('es', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>

              {item.mensaje && (
                <Text style={estilos.mensaje} numberOfLines={2}>
                  "{item.mensaje}"
                </Text>
              )}

              {item.destinatarios && item.destinatarios.length > 0 && (
                <Text style={estilos.destinatarios} numberOfLines={2}>
                  Notificados:{' '}
                  {item.destinatarios
                    .map((d) => `${d.nombre_contacto} (${d.canal.toLowerCase()})`)
                    .join(', ')}
                </Text>
              )}

              {activa && (
                <View style={estilos.acciones}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Marcar solicitud como atendida"
                    disabled={procesando}
                    onPress={() => void manejarAtender(item)}
                    style={({ pressed }) => [
                      estilos.accion,
                      estilos.accionAtender,
                      procesando && { opacity: 0.5 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={estilos.accionTexto}>✓ Me ayudaron</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar solicitud"
                    disabled={procesando}
                    onPress={() => void manejarCancelar(item)}
                    style={({ pressed }) => [
                      estilos.accion,
                      estilos.accionCancelar,
                      procesando && { opacity: 0.5 },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={[estilos.accionTexto, { color: colores.peligro }]}>
                      ✕ Cancelar
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  zonaAlerta: { paddingHorizontal: tamaños.lg, paddingTop: tamaños.sm },
  lista: {
    padding: tamaños.lg,
    paddingBottom: tamaños.xl * 2,
    gap: tamaños.sm,
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tipo: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
  },
  estado: { fontSize: tamaños.fuenteSM, fontWeight: '700' },
  fecha: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
  },
  mensaje: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    fontStyle: 'italic',
    marginTop: tamaños.xs,
  },
  destinatarios: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    marginTop: tamaños.xs,
    lineHeight: 18,
  },
  acciones: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tamaños.sm,
    marginTop: tamaños.md,
  },
  accion: {
    borderRadius: tamaños.radioMD,
    paddingHorizontal: tamaños.md,
    height: tamaños.botonAlturaSM,
    justifyContent: 'center',
  },
  accionAtender: { backgroundColor: colores.exitoFondo },
  accionCancelar: { backgroundColor: colores.superficieClara },
  accionTexto: {
    color: '#a7f3d0',
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  vacia: {
    alignItems: 'center',
    paddingVertical: tamaños.xl * 2,
    gap: tamaños.sm,
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
    paddingHorizontal: tamaños.lg,
  },
});