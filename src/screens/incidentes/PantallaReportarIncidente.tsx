import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { reportarIncidente } from '@/api/incidentes.api';
import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { CampoTexto } from '@/components/CampoTexto';
import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import { obtenerUbicacion } from '@/services/location.service';
import {
  TIPOS_INCIDENTE,
  type EvidenciaLocal,
  type SeveridadIncidente,
} from '@/types';
import { mensajeDeError } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * REPORTAR INCIDENTE (CU22 — móvil):
 *
 *   1. Tipo de incidente (chips) + descripción + severidad.
 *   2. GPS automático (el backend guarda la ubicación y
 *      genera el enlace del mapa para la web CU38).
 *   3. Hasta 5 evidencias fotográficas (cámara integrada).
 *   4. Al guardar: narra el mensaje_voz del backend.
 * ══════════════════════════════════════════════════════
 */

const MAX_EVIDENCIAS = 5;

const SEVERIDADES: SeveridadIncidente[] = [
  'BAJA',
  'MEDIA',
  'ALTA',
  'CRITICA',
];

export default function PantallaReportarIncidente() {
  const { anunciar } = useTTS();

  // ─── Formulario ───
  const [tipo, setTipo] = useState<string>('OBSTRUCCION');
  const [tipoOtro, setTipoOtro] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [severidad, setSeveridad] = useState<SeveridadIncidente>('MEDIA');

  // ─── Evidencias (cámara) ───
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camaraRef = useRef<CameraView>(null);
  const [evidencias, setEvidencias] = useState<EvidenciaLocal[]>([]);

  // ─── Envío ───
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);

  useEffect(() => {
    anunciar(
      'Pantalla para reportar un incidente en la vía. Elige el tipo, ' +
        'agrega fotos si quieres y pulsa enviar incidente.',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tipoFinal =
    tipo === 'OTRO' ? tipoOtro.trim().toUpperCase() : tipo;

  const capturarEvidencia = useCallback(async () => {
    if (evidencias.length >= MAX_EVIDENCIAS) return;

    try {
      const foto = await camaraRef.current?.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      if (!foto?.uri) return;

      setEvidencias((prev) => [
        ...prev,
        {
          uri: foto.uri,
          mimeType: 'image/jpeg',
          nombre: `evidencia-${Date.now()}.jpg`,
        },
      ]);
      void anunciar(
        `Evidencia ${evidencias.length + 1} agregada. Puedes agregar hasta ${MAX_EVIDENCIAS}.`,
        { forzar: true },
      );
    } catch {
      anunciar('No se pudo tomar la foto. Intenta de nuevo.', {
        forzar: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidencias.length, anunciar]);

  function quitarEvidencia(indice: number) {
    setEvidencias((prev) => prev.filter((_, i) => i !== indice));
  }

  const enviar = useCallback(async () => {
    if (enviando) return;

    if (!tipoFinal) {
      const m = 'Escribe el tipo de incidente (o elige uno de la lista).';
      setError(m);
      anunciar(m, { forzar: true });
      return;
    }

    setEnviando(true);
    setError(null);
    setEnviado(null);
    anunciar('Enviando incidente', { forzar: true });

    try {
      const u = await obtenerUbicacion({ timeoutMs: 6000 });

      const incidente = await reportarIncidente({
        tipo_incidente: tipoFinal,
        ...(descripcion.trim() && { descripcion: descripcion.trim() }),
        severidad,
        ...(u && {
          latitud: u.latitud,
          longitud: u.longitud,
          precision_metros: u.precision ?? undefined,
        }),
        evidencias,
      });

      setEnviado(
        incidente.mensaje_voz ??
          `Incidente #${incidente.id_incidente} registrado correctamente.`,
      );
      anunciar(
        incidente.mensaje_voz ??
          `Incidente registrado. Número ${incidente.id_incidente}. Gracias por ayudar a mejorar la ciudad.`,
        { forzar: true },
      );

      // Limpia el formulario para un nuevo reporte
      setDescripcion('');
      setTipoOtro('');
      setEvidencias([]);
      setSeveridad('MEDIA');
    } catch (e) {
      const m = mensajeDeError(e);
      setError(m);
      anunciar(`No se pudo enviar el incidente. ${m}`, { forzar: true });
    } finally {
      setEnviando(false);
    }
  }, [enviando, tipoFinal, descripcion, severidad, evidencias, anunciar]);

  return (
    <ScrollView
      style={estilos.pantalla}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled"
    >
      {enviado && (
        <Alerta variante="exito" mensaje={enviado} onCerrar={() => setEnviado(null)} />
      )}
      {error && <Alerta variante="error" mensaje={error} onCerrar={() => setError(null)} />}

      {/* ─── Tipo de incidente ─── */}
      <Text style={estilos.etiqueta}>Tipo de incidente</Text>
      <View style={estilos.chips}>
        {[...TIPOS_INCIDENTE].map((t) => {
          const activo = tipo === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`Tipo de incidente: ${t.replace(/_/g, ' ').toLowerCase()}`}
              onPress={() => setTipo(t)}
              style={[estilos.chip, activo && estilos.chipActivo]}
            >
              <Text style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}>
                {t.replace(/_/g, ' ')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tipo === 'OTRO' && (
        <CampoTexto
          etiqueta="Describe el tipo (texto corto)"
          valor={tipoOtro}
          onChangeText={setTipoOtro}
          placeholder="Ej: POSTE_CAIDO"
          autoCapitalizar="words"
        />
      )}

      <CampoTexto
        etiqueta="Descripción (opcional)"
        valor={descripcion}
        onChangeText={setDescripcion}
        placeholder="Ej: puerta del local bloqueando la acera"
        multilinea
        autoCapitalizar="sentences"
      />

      {/* ─── Severidad ─── */}
      <Text style={estilos.etiqueta}>Severidad</Text>
      <View style={estilos.chips}>
        {SEVERIDADES.map((s) => {
          const activo = severidad === s;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`Severidad ${s.toLowerCase()}`}
              onPress={() => setSeveridad(s)}
              style={[
                estilos.chip,
                estilos.chipSeveridad,
                activo && estilos.chipActivo,
              ]}
            >
              <Text style={[estilos.chipTexto, activo && estilos.chipTextoActivo]}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ─── Evidencias (cámara integrada) ─── */}
      <Text style={estilos.etiqueta}>
        Evidencias fotográficas ({evidencias.length}/{MAX_EVIDENCIAS})
      </Text>

      {!permiso ? (
        <Text style={estilos.sutil}>Preparando la cámara…</Text>
      ) : !permiso.granted ? (
        <View style={estilos.tarjetaPermiso}>
          <Text style={estilos.sutil}>
            Las fotos son opcionales. Concede el permiso de cámara para
            adjuntar evidencias.
          </Text>
          <Boton
            etiqueta="📷 Conceder permiso de cámara"
            variante="secundario"
            onPress={() => void pedirPermiso()}
          />
          {permiso.canAskAgain ? null : (
            <Boton
              etiqueta="Abrir ajustes del sistema"
              variante="secundario"
              onPress={() => void Linking.openSettings()}
            />
          )}
        </View>
      ) : (
        <>
          <View style={estilos.camaraZona}>
            <CameraView
              ref={camaraRef}
              style={estilos.camara}
              facing="back"
            />
            <Boton
              etiqueta="📷 Añadir foto"
              variante="secundario"
              onPress={() => void capturarEvidencia()}
              deshabilitado={evidencias.length >= MAX_EVIDENCIAS}
            />
          </View>

          {evidencias.length > 0 && (
            <View style={estilos.miniaturas}>
              {evidencias.map((evidencia, indice) => (
                <Pressable
                  key={`${evidencia.uri}-${indice}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar evidencia ${indice + 1}`}
                  onPress={() => quitarEvidencia(indice)}
                  style={({ pressed }) => [
                    estilos.miniatura,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Image
                    source={{ uri: evidencia.uri }}
                    style={estilos.miniaturaImagen}
                  />
                  <Text style={estilos.miniaturaQuitar}>✕</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      <Boton
        etiqueta="🚨 Enviar incidente"
        variante="peligro"
        onPress={() => void enviar()}
        cargando={enviando}
      />

      <Text style={estilos.sutil}>
        Tu ubicación se agrega automáticamente para que el equipo pueda
        ubicar el problema en el mapa.
      </Text>
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
  etiqueta: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
    marginTop: tamaños.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tamaños.sm,
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
  chipSeveridad: { minWidth: 96, alignItems: 'center' },
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

  camaraZona: { gap: tamaños.sm },
  camara: {
    height: 180,
    borderRadius: tamaños.radioLG,
    overflow: 'hidden',
  },
  miniaturas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tamaños.sm,
  },
  miniatura: {
    width: 72,
    height: 72,
    borderRadius: tamaños.radioSM,
    overflow: 'hidden',
  },
  miniaturaImagen: { width: '100%', height: '100%' },
  miniaturaQuitar: {
    position: 'absolute',
    top: 2,
    right: 4,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: '#000000',
    textShadowRadius: 4,
  },

  tarjetaPermiso: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
    gap: tamaños.sm,
  },

  sutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    lineHeight: 18,
  },
});
