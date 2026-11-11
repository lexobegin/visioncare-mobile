import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { solicitarAyuda } from '@/api/ayuda.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { BotonEmergencia } from '@/components/BotonEmergencia';
import { CampoTexto } from '@/components/CampoTexto';
import { colores, tamaños } from '@/constants/tema';
import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import type { MasStackParamList } from '@/navigation/NavigationTypes';
import { vibrarEmergencia } from '@/services/haptics.service';
import { obtenerUbicacion, type UbicacionGPS } from '@/services/location.service';
import {
  mensajeDeError,
  type SolicitudAyuda,
  type TipoSolicitud,
} from '@/types';

import { useRoute, type RouteProp } from '@react-navigation/native';

/**
 * ══════════════════════════════════════════════════════
 * Pedir Ayuda (CU20) — pantalla de emergencia.
 *
 * Flujo:
 *   1. GPS automático al entrar (indicador de estado)
 *   2. Tipo: AYUDA (default) / EMERGENCIA (chips grandes)
 *   3. Mensaje opcional (dictado por teclado)
 *   4. Botón gigante MANTENER 1.5s → POST /ayuda/solicitar
 *   5. Resultado con mensaje_voz FORZADO + vibración:
 *      "Emergencia solicitada. Se notificó a 2 contactos."
 *   6. Tarjeta-resumen con destinatarios y link de mapa
 *
 * Desde la voz: comando "ayuda" llega aquí con tipo EMERGENCIA
 * pre-seleccionado ({ tipoInicial: 'EMERGENCIA' }).
 * ══════════════════════════════════════════════════════
 */

export default function PantallaAyuda() {
  const { anunciar } = useTTS();
  const { usuario } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<MasStackParamList>>();

  const route = useRoute<RouteProp<MasStackParamList, 'Ayuda'>>();

  const [tipo, setTipo] = useState<TipoSolicitud>('AYUDA');
  const [mensaje, setMensaje] = useState('');
  const [gps, setGps] = useState<UbicacionGPS | null>(null);
  const [gpsEstado, setGpsEstado] = useState<'cargando' | 'lista' | 'no'>('cargando');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<SolicitudAyuda | null>(null);

  // ─── Anuncio de pantalla ───
    useEffect(() => {
    const tipoInicial = route.params?.tipoInicial;
    if (tipoInicial) setTipo(tipoInicial);

    anunciar(
      tipoInicial === 'EMERGENCIA'
        ? 'Pantalla de ayuda en modo emergencia. Mantén presionado el botón grande para notificar a tus contactos.'
        : 'Pantalla de ayuda. Mantén presionado el botón grande para notificar a tus contactos de confianza con tu ubicación.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── GPS automático (no bloquea el flujo) ───
  useEffect(() => {
    (async () => {
      setGpsEstado('cargando');
      const u = await obtenerUbicacion({ timeoutMs: 10_000 });
      if (u) {
        setGps(u);
        setGpsEstado('lista');
      } else {
        setGpsEstado('no');
      }
    })();
  }, []);

  // ═══════════════ ENVÍO ═══════════════

  const confirmarSolicitud = useCallback(async () => {
    setError(null);
    setEnviando(true);
    anunciar('Solicitando ayuda...', { forzar: true });

    try {
      // Refrescar GPS justo antes de enviar (precisión máxima)
      const gpsFresco = (await obtenerUbicacion({ timeoutMs: 4000 })) ?? gps;

      const respuesta = await solicitarAyuda({
        tipo,
        ...(mensaje.trim() && { mensaje: mensaje.trim() }),
        ...(gpsFresco && {
          latitud: gpsFresco.latitud,
          longitud: gpsFresco.longitud,
          precision_metros: gpsFresco.precision ?? undefined,
        }),
      });

      setResultado(respuesta);
      setGps(gpsFresco ?? gps);

      // Resultado SIEMPRE por voz forzada + vibración (emergencia)
      if (respuesta.mensaje_voz) {
        anunciar(respuesta.mensaje_voz, { forzar: true });
      }
      void vibrarEmergencia(2);
    } catch (e) {
      const m = mensajeDeError(e);
      setError(m);
      anunciar(`Error. ${m}`, { forzar: true });
    } finally {
      setEnviando(false);
    }
  }, [tipo, mensaje, gps, anunciar]);

  /** Soltó el botón antes de tiempo */
  const cancelarMantener = useCallback(() => {
    anunciar('Cancelado. Mantén presionado hasta que suene la confirmación.');
  }, [anunciar]);

  // ═══════════════ RENDER ═══════════════

  return (
    <ScrollView
      style={estilos.flex}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─── Error ─── */}
      {error && (
        <Alerta variante="error" mensaje={error} onCerrar={() => setError(null)} />
      )}

      {/* ─── Resultado (post-envío) ─── */}
      {resultado && (
        <View style={[estilos.tarjeta, estilos.tarjetaExito]}>
          <Text style={estilos.resultadoTitulo}>
            {resultado.tipo === 'EMERGENCIA'
              ? '🚨 Emergencia solicitada'
              : '🆘 Ayuda solicitada'}
          </Text>

          <Text style={estilos.resultadoEstado}>
            Estado: {resultado.estado}
          </Text>

          {resultado.destinatarios &&
            resultado.destinatarios.length > 0 && (
              <Text style={estilos.resultadoDetalle}>
                Notificados:{' '}
                {resultado.destinatarios
                  .map(
                    (d) => `${d.nombre_contacto} (${d.canal.toLowerCase()})`,
                  )
                  .join(', ')}
              </Text>
            )}

          {resultado.ubicacion && (
            <Text style={estilos.resultadoDetalle}>
              📍 Tu ubicación fue incluida en la notificación.
            </Text>
          )}

          {resultado.url_mapa && (
            <Text style={estilos.resultadoDetalle} numberOfLines={1}>
              🔗 {resultado.url_mapa}
            </Text>
          )}

          <View style={estilos.accionesResultado}>
            <Boton
              etiqueta="Mis solicitudes"
              variante="secundario"
              onPress={() => navigation.navigate('MisSolicitudes')}
            />
            <View style={estilos.espacio} />
            <Boton
              etiqueta="Nueva solicitud"
              variante="secundario"
              onPress={() => setResultado(null)}
            />
          </View>
        </View>
      )}

      {/* ─── Formulario (sin resultado) ─── */}
      {!resultado && (
        <>
          {/* Estado GPS */}
          <View style={estilos.gpsCaja}>
            <Text style={estilos.gpsTexto}>
              {gpsEstado === 'cargando'
                ? '📍 Obteniendo tu ubicación…'
                : gpsEstado === 'lista' && gps
                  ? `📍 Ubicación lista (±${gps.precision?.toFixed(0) ?? '?'} m)`
                  : '📍 Sin ubicación — la solicitud se enviará igual, solo sin enlace de mapa'}
            </Text>
          </View>

          {/* Tipo */}
          <Text style={estilos.tituloSeccion}>¿Qué necesitas?</Text>
          <View style={estilos.chipsTipo}>
            <ChipTipo
              etiqueta="🆘 Ayuda"
              descripcion="Necesito que alguien venga"
              activo={tipo === 'AYUDA'}
              onPress={() => {
                setTipo('AYUDA');
                anunciar('Tipo: ayuda.');
              }}
            />
            <ChipTipo
              etiqueta="🚨 Emergencia"
              descripcion="Riesgo grave, urgente"
              activo={tipo === 'EMERGENCIA'}
              onPress={() => {
                setTipo('EMERGENCIA');
                anunciar('Tipo: emergencia.');
              }}
            />
          </View>

          {/* Mensaje opcional */}
          <CampoTexto
            etiqueta="Mensaje para tus contactos (opcional)"
            valor={mensaje}
            onChangeText={setMensaje}
            placeholder="Ej: estoy en la entrada del mercado…"
            multilinea
            hint="Se incluirá en la notificación que reciban."
          />

          {/* Contactos de confianza — aviso si no hay */}
          {usuario && (
            <Text style={estilos.nota}>
              Se notificará a tus contactos de confianza con{' '}
              {gpsEstado === 'lista' ? 'tu ubicación' : 'el pedido'}.
              Gestiónalos en la sección Contactos.
            </Text>
          )}

          {/* ─── BOTÓN DE EMERGENCIA ─── */}
          <BotonEmergencia
            etiqueta="PEDIR AYUDA"
            onConfirmar={() => void confirmarSolicitud()}
            onCancela={cancelarMantener}
            deshabilitado={enviando}
          />

          {enviando && (
            <Text style={estilos.enviando}>
              Notificando a tus contactos… (máx. unos segundos)
            </Text>
          )}

          {/* Acceso a historial */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver mis solicitudes anteriores"
            onPress={() => navigation.navigate('MisSolicitudes')}
            style={({ pressed }) => [
              estilos.enlaceHistorial,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={estilos.enlaceTexto}>
              Ver mis solicitudes anteriores →
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

/** Chip de tipo de solicitud (grande, accesible) */
function ChipTipo(props: {
  etiqueta: string;
  descripcion: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.etiqueta}. ${props.descripcion}`}
      accessibilityState={{ selected: props.activo }}
      onPress={props.onPress}
      style={({ pressed }) => [
        estilos.chipTipo,
        props.activo && estilos.chipTipoActivo,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[estilos.chipTitulo, props.activo && estilos.chipTextoActivo]}>
        {props.etiqueta}
      </Text>
      <Text
        style={[
          estilos.chipDescripcion,
          props.activo && estilos.chipTextoActivo,
        ]}
      >
        {props.descripcion}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    padding: tamaños.lg,
    paddingBottom: tamaños.xl * 2,
    gap: tamaños.sm,
  },
  gpsCaja: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.sm,
  },
  gpsTexto: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
  },
  tituloSeccion: {
    color: colores.texto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700',
    marginTop: tamaños.sm,
  },
  chipsTipo: {
    flexDirection: 'row',
    gap: tamaños.sm,
    marginBottom: tamaños.sm,
  },
  chipTipo: {
    flex: 1,
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    borderWidth: 2,
    borderColor: colores.borde,
    padding: tamaños.md,
    minHeight: tamaños.touchMin,
  },
  chipTipoActivo: {
    borderColor: colores.peligro,
    backgroundColor: colores.peligroFondo,
  },
  chipTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
  },
  chipDescripcion: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
  },
  chipTextoActivo: { color: '#fecaca' },
  nota: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    lineHeight: 18,
    marginBottom: tamaños.sm,
  },
  enviando: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    textAlign: 'center',
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  tarjetaExito: {
    borderLeftWidth: 4,
    borderLeftColor: colores.exito,
  },
  resultadoTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
  },
  resultadoEstado: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    marginTop: 4,
  },
  resultadoDetalle: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
    marginTop: tamaños.xs,
  },
  accionesResultado: {
    marginTop: tamaños.md,
  },
  espacio: { height: tamaños.sm },
  enlaceHistorial: {
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enlaceTexto: {
    color: colores.primario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
});