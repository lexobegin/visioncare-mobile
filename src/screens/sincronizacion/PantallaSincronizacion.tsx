import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import {
  mensajeSyncError,
  obtenerBitacora,
  obtenerEstado,
  sincronizarAhora,
  type EstadoSincronizacion,
  type ResultadoSincronizacion,
} from '@/services/sincronizacion.service';
import type { SincronizacionBitacora } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * SINCRONIZACIÓN (CU25–CU26):
 *
 *   - Estado: cambios pendientes en la cola local, última
 *     sincronización y datos descargados (consultables
 *     sin conexión).
 *   - "Sincronizar ahora": sube la cola (idempotente) y
 *     baja navegaciones + historial → guarda cache.
 *   - Bitácora del backend (últimos registros).
 *
 * La pantalla intenta sincronizar sola al entrar (así las
 * rutas/incidentes offline suben apenas hay conexión).
 * ══════════════════════════════════════════════════════
 */

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PantallaSincronizacion() {
  const { anunciar } = useTTS();

  const [estado, setEstado] = useState<EstadoSincronizacion | null>(null);
  const [bitacora, setBitacora] = useState<SincronizacionBitacora[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSincronizacion | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const refrescarEstado = useCallback(async () => {
    setEstado(await obtenerEstado());
    setBitacora(await obtenerBitacora());
  }, []);

  useEffect(() => {
    anunciar(
      'Pantalla de sincronización. Aquí se sube lo que hiciste sin ' +
        'conexión y se descarga tu información para usarla offline.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carga inicial + intento automático
  useEffect(() => {
    void refrescarEstado();
    void sincronizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sincronizar = useCallback(async () => {
    if (sincronizando) return;

    setSincronizando(true);
    setError(null);

    try {
      const r = await sincronizarAhora();
      setResultado(r);
      anunciar(r.mensajeVoz, { forzar: true });
      await refrescarEstado();
    } catch (e) {
      const m = mensajeSyncError(e);
      setError(m);
      anunciar(`No se pudo sincronizar. ${m}`, { forzar: true });
    } finally {
      setSincronizando(false);
    }
  }, [sincronizando, anunciar, refrescarEstado]);

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
    >
      {error && (
        <Alerta
          variante="advertencia"
          mensaje={error}
          onCerrar={() => setError(null)}
        />
      )}

      {resultado && (
        <Alerta
          variante="exito"
          mensaje={resultado.mensajeVoz}
          onCerrar={() => setResultado(null)}
        />
      )}

      {/* ─── Cola pendiente (CU25) ─── */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.tarjetaTitulo}>📤 Cambios pendientes</Text>
        <Text style={estilos.tarjetaTexto}>
          {estado
            ? estado.pendientes === 0
              ? 'Todo está sincronizado. No hay cambios esperando.'
              : `${estado.pendientes} cambio(s) guardado(s) en el teléfono esperando conexión.`
            : 'Leyendo la cola local…'}
        </Text>
        {estado && (
          <Text style={estilos.tarjetaSutil}>
            Última sincronización: {formatearFecha(estado.fechaUltimaSync)}
          </Text>
        )}
      </View>

      <Boton
        etiqueta="🔄 Sincronizar ahora"
        onPress={() => void sincronizar()}
        cargando={sincronizando}
      />

      {/* ─── Cache descargada (CU26) ─── */}
      {estado && (
        <View style={estilos.tarjeta}>
          <Text style={estilos.tarjetaTitulo}>📥 Datos descargados</Text>
          <Text style={estilos.tarjetaTexto}>
            {estado.navegacionesCache
              ? `${estado.navegacionesCache.length} navegación(es) disponibles sin conexión`
              : 'Sin navegaciones descargadas'}
          </Text>
          <Text style={estilos.tarjetaTexto}>
            {estado.historialCache
              ? `${estado.historialCache.length} actividad(es) del historial en cache`
              : 'Sin historial descargado'}
          </Text>
        </View>
      )}

      {/* ─── Bitácora del backend ─── */}
      <Text style={estilos.seccion}>Bitácora de sincronizaciones</Text>
      {bitacora.length === 0 ? (
        <Text style={estilos.sutil}>
          Sin registros todavía. Cada subida o bajada queda registrada aquí.
        </Text>
      ) : (
        bitacora.map((fila) => (
          <View key={fila.id_sincronizacion} style={estilos.fila}>
            <Text style={estilos.filaPrincipal}>
              {fila.direccion === 'SUBIDA'
                ? '📤'
                : fila.direccion === 'BAJADA'
                  ? '📥'
                  : '🔄'}{' '}
              {fila.entidad ?? fila.direccion} · {fila.estado}
            </Text>
            <Text style={estilos.filaSutil}>
              {formatearFecha(fila.fecha_sincronizacion)} ·{' '}
              {fila.dispositivo_id}
            </Text>
          </View>
        ))
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
    paddingBottom: tamaños.xl,
  },

  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
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
    marginTop: 2,
  },

  seccion: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
    marginTop: tamaños.sm,
  },
  fila: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioSM,
    padding: tamaños.md,
    gap: 2,
  },
  filaPrincipal: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600',
  },
  filaSutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
  },

  sutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },
});
