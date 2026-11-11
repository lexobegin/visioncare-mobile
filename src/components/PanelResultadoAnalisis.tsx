import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colores, tamaños } from '@/constants/tema';
import type {
  CapturaResponse,
  EstimacionAutenticidad,
} from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Panel de resultados por tipo de análisis (S2).
 *
 * Renderiza SOLO la sección del tipo ejecutado:
 *   OBJETOS → barras de confianza (S1)
 *   OCR → texto completo + tipo de documento
 *   SENALES → lista de señales/lugares
 *   PRODUCTOS → nombre, marca, categoría
 *   COLORES → muestras visuales (nombre → hex)
 *   BILLETES → valor + autenticidad + ⚠️ no-certificación
 *   DESCRIPCION → descripción completa + resumen
 *
 * + resumen_voz tocable (repite por TTS).
 * ══════════════════════════════════════════════════════
 */

/** Mapeo visual nombre de color → hex (para muestras) */
const COLORES_HEX: Record<string, string> = {
  negro: '#000000',
  blanco: '#ffffff',
  gris: '#94a3b8',
  'gris oscuro': '#475569',
  rojo: '#dc2626',
  naranja: '#ea580c',
  amarillo: '#eab308',
  'verde claro': '#84cc16',
  verde: '#16a34a',
  celeste: '#38bdf8',
  azul: '#2563eb',
  violeta: '#7c3aed',
  rosa: '#ec4899',
  'marrón': '#92400e',
};

const ETIQUETA_AUTENTICIDAD: Record<EstimacionAutenticidad, string> = {
  PROBABLEMENTE_AUTENTICO: '✅ Parece auténtico',
  PROBABLEMENTE_SOSPECHOSO: '⚠️ Posible billete sospechoso',
  INDETERMINADO: '❓ No se pudo determinar',
};

interface Props {
  resultado: CapturaResponse | null;
  onRepetirVoz: (texto: string) => void;
}

export function PanelResultadoAnalisis({ resultado, onRepetirVoz }: Props) {
  if (!resultado) {
    return (
      <Text style={estilos.vacio}>
        Pulsa el botón para capturar y analizar, o activa el asistente
        continuo.
      </Text>
    );
  }

  const resumen = resultado.resumen_voz;

  return (
    <View>
      {/* ─── Resumen hablable (tocar = repetir) ─── */}
      {resumen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Repetir por voz: ${resumen}`}
          onPress={() => onRepetirVoz(resumen)}
          style={({ pressed }) => [
            estilos.resumenCaja,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={estilos.resumenTexto}>🗣️  {resumen}</Text>
          <Text style={estilos.resumenRepetir}>
            (toca para escuchar de nuevo)
          </Text>
        </Pressable>
      )}

      {!resultado.ia_disponible && (
        <Text style={estilos.avisoIA}>
          ⚠️ Servicio de IA no disponible — captura guardada como pendiente.
        </Text>
      )}

      {/* ═══════════ OBJETOS (S1) ═══════════ */}
      {resultado.detecciones && resultado.detecciones.length > 0 && (
        <View style={estilos.seccion}>
          {resultado.detecciones.slice(0, 6).map((d) => (
            <View key={d.id_deteccion} style={estilos.filaDeteccion}>
              <Text style={estilos.etiquetaObjeto}>
                {d.etiqueta_es || d.etiqueta}
              </Text>
              <View style={estilos.barraFondo}>
                <View
                  style={[
                    estilos.barraRelleno,
                    { width: `${Math.round(d.confianza * 100)}%` },
                  ]}
                />
              </View>
              <Text style={estilos.porcentaje}>
                {Math.round(d.confianza * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ═══════════ OCR (CU11) ═══════════ */}
      {resultado.lectura_ocr && (
        <View style={estilos.seccion}>
          {resultado.lectura_ocr.tipo_documento && (
            <Text style={estilos.badgeTipo}>
              📄 Tipo: {resultado.lectura_ocr.tipo_documento}
            </Text>
          )}
          <View style={estilos.cajaTexto}>
            <Text style={estilos.textoOCR}>
              {resultado.lectura_ocr.texto_extraido || '(sin texto)'}
            </Text>
          </View>
        </View>
      )}

      {/* ═══════════ SEÑALES (CU12) ═══════════ */}
      {resultado.senales && resultado.senales.length > 0 && (
        <View style={estilos.seccion}>
          {resultado.senales.map((s, i) => (
            <View key={`${s.tipo_senal}-${i}`} style={estilos.itemLista}>
              <Text style={estilos.itemTitulo}>
                🚏 {(s.nombre_reconocido ?? s.tipo_senal).replace(/_/g, ' ')}
              </Text>
              {s.descripcion && (
                <Text style={estilos.itemDetalle}>{s.descripcion}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ═══════════ PRODUCTOS (CU13) ═══════════ */}
      {resultado.productos && resultado.productos.length > 0 && (
        <View style={estilos.seccion}>
          {resultado.productos.map((p, i) => (
            <View key={`${p.nombre_producto ?? 'p'}-${i}`} style={estilos.itemLista}>
              <Text style={estilos.itemTitulo}>
                📦 {p.nombre_producto ?? 'Producto no identificado'}
              </Text>
              <Text style={estilos.itemDetalle}>
                {[
                  p.marca ? `Marca: ${p.marca}` : null,
                  p.categoria ? `Categoría: ${p.categoria}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ═══════════ COLORES (CU14) ═══════════ */}
      {resultado.colores && (
        <View style={estilos.seccion}>
          <View style={estilos.filaColores}>
            <View
              style={[
                estilos.muestra,
                {
                  backgroundColor:
                    COLORES_HEX[resultado.colores.color_principal] ?? '#94a3b8',
                },
              ]}
            />
            <View style={estilos.coloresTextos}>
              <Text style={estilos.itemTitulo}>
                {resultado.colores.color_principal}
              </Text>
              {resultado.colores.colores_secundarios && (
                <Text style={estilos.itemDetalle}>
                  Tonos: {resultado.colores.colores_secundarios.join(', ')}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ═══════════ BILLETES (CU15/16) ═══════════ */}
      {resultado.billete && (
        <View style={estilos.seccion}>
          <Text style={estilos.itemTitulo}>
            💵{' '}
            {resultado.billete.denominacion
              ? `${resultado.billete.denominacion} ${resultado.billete.moneda ?? ''}`
              : 'Billete no identificado'}
          </Text>

          {resultado.billete.autenticidad_estimacion && (
            <Text
              style={[
                estilos.badgeAutenticidad,
                resultado.billete.autenticidad_estimacion ===
                  'PROBABLEMENTE_SOSPECHOSO' && estilos.badgeSospechoso,
              ]}
            >
              {
                ETIQUETA_AUTENTICIDAD[
                  resultado.billete.autenticidad_estimacion
                ]
              }
            </Text>
          )}

          <Text style={estilos.advertenciaBillete}>
            ⚠️ Estimación visual — no constituye certificación de autenticidad.
          </Text>
        </View>
      )}

      {/* ═══════════ DESCRIPCIÓN (CU10) ═══════════ */}
      {resultado.descripcion && (
        <View style={estilos.seccion}>
          <Text style={estilos.textoDescripcion}>
            {resultado.descripcion.descripcion}
          </Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  vacio: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteSM,
    textAlign: 'center',
    paddingVertical: tamaños.md,
  },
  resumenCaja: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.sm,
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
  resumenTexto: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },
  resumenRepetir: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
  },
  avisoIA: {
    color: colores.advertencia,
    fontSize: tamaños.fuenteXS,
    marginTop: tamaños.sm,
  },
  seccion: {
    marginTop: tamaños.sm,
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    padding: tamaños.sm,
  },
  filaDeteccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tamaños.sm,
    paddingVertical: 3,
  },
  etiquetaObjeto: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    width: 110,
  },
  barraFondo: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colores.superficieClara,
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colores.primario,
  },
  porcentaje: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    fontWeight: '700',
    width: 38,
    textAlign: 'right',
  },
  badgeTipo: {
    color: colores.info,
    fontSize: tamaños.fuenteXS,
    fontWeight: '700',
    marginBottom: 4,
  },
  cajaTexto: {
    backgroundColor: colores.superficieClara,
    borderRadius: tamaños.radioSM,
    padding: tamaños.sm,
  },
  textoOCR: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    lineHeight: 22,
  },
  itemLista: { paddingVertical: 4 },
  itemTitulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },
  itemDetalle: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
  },
  filaColores: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tamaños.md,
  },
  muestra: {
    width: 56,
    height: 56,
    borderRadius: tamaños.radioMD,
    borderWidth: 2,
    borderColor: colores.bordeFuerte,
  },
  coloresTextos: { flex: 1 },
  badgeAutenticidad: {
    color: '#a7f3d0',
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
    marginTop: 4,
  },
  badgeSospechoso: { color: '#fecaca' },
  advertenciaBillete: {
    color: colores.advertencia,
    fontSize: tamaños.fuenteXS,
    marginTop: 6,
  },
  textoDescripcion: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    lineHeight: 22,
  },
});