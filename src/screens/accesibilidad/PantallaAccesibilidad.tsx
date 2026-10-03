import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Alerta } from '@/components/Alerta';
import { Boton } from '@/components/Boton';
import { PantallaCargando } from '@/components/PantallaCargando';
import { SliderAjuste } from '@/components/SliderAjuste';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { colores, tamaños } from '@/constants/tema';
import { mensajeDeError, type ActualizarPreferenciasPayload } from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * Accesibilidad (CU03) — configuración en vivo:
 *
 *   Cada cambio → PATCH backend → AuthContext actualiza
 *   preferencias → useTTS sincroniza el servicio → el botón
 *   "Probar voz" reproduce la muestra con la config NUEVA.
 *
 * Sliders anuncian su valor final por voz al soltar.
 * ══════════════════════════════════════════════════════
 */

export default function PantallaAccesibilidad() {
  const { preferencias, actualizarPreferencias } = useAuth();
  const { anunciar } = useTTS();

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    anunciar(
      'Pantalla de accesibilidad. Configura la voz, volumen y vibración.',
    );
  }, [anunciar]);

  /** PATCH al backend con debounce simple (solo el último valor) */
  const guardar = useCallback(
    async (payload: ActualizarPreferenciasPayload) => {
      setGuardando(true);
      setError(null);
      try {
        await actualizarPreferencias(payload);
      } catch (e) {
        const m = mensajeDeError(e);
        setError(m);
        anunciar(`Error al guardar. ${m}`, { forzar: true });
      } finally {
        setGuardando(false);
      }
    },
    [actualizarPreferencias, anunciar],
  );

  if (!preferencias) {
    return <PantallaCargando mensaje="Cargando preferencias…" />;
  }

  return (
    <ScrollView
      style={estilos.flex}
      contentContainerStyle={estilos.contenido}
    >
      {error && <Alerta variante="error" mensaje={error} onCerrar={() => setError(null)} />}

      {/* ─── Sección voz ─── */}
      <Text style={estilos.tituloSeccion}>🔊 Voz</Text>

      <Toggle
        etiqueta="Asistente de voz"
        descripcion="Anuncios y respuestas habladas"
        valor={preferencias.voz_habilitada}
        onCambiar={(v) => {
          void guardar({ voz_habilitada: v });
          // Anuncio de confirmación (forzado si se apaga: último mensaje)
          anunciar(
            v ? 'Asistente de voz activado.' : 'Asistente de voz desactivado.',
            { forzar: !v },
          );
        }}
      />

      <SliderAjuste
        etiqueta="Volumen de la voz"
        valor={preferencias.volumen_voz}
        minimo={0}
        maximo={100}
        paso={5}
        onCambiar={(v) => void guardar({ volumen_voz: v })}
        alSoltar={(v) =>
          anunciar(`Volumen al ${Math.round(v)} por ciento.`, { forzar: true })
        }
        formatear={(v) => `${Math.round(v)}%`}
        deshabilitado={!preferencias.voz_habilitada}
      />

      <SliderAjuste
        etiqueta="Velocidad de la voz"
        valor={preferencias.velocidad_voz}
        minimo={0.5}
        maximo={3}
        paso={0.1}
        onCambiar={(v) => void guardar({ velocidad_voz: Number(v.toFixed(2)) })}
        alSoltar={(v) =>
          anunciar(
            `Velocidad ${v.toFixed(1)} por uno. Así sonaré al hablar.`,
            { forzar: true },
          )
        }
        formatear={(v) => `${v.toFixed(1)}x`}
        deshabilitado={!preferencias.voz_habilitada}
      />

      <Toggle
        etiqueta="Confirmaciones por voz"
        descripcion="Confirmar acciones importantes hablando"
        valor={preferencias.confirmaciones_por_voz}
        onCambiar={(v) => {
          void guardar({ confirmaciones_por_voz: v });
          anunciar(v ? 'Confirmaciones por voz activadas.' : 'Confirmaciones por voz desactivadas.');
        }}
      />

      <Boton
        etiqueta="🔊 Probar voz con esta configuración"
        onPress={() =>
          anunciar(
            'Esta es una prueba. Si me escuchas bien, tu configuración está lista.',
            { forzar: true },
          )
        }
      />

      {/* ─── Sección alertas ─── */}
      <Text style={estilos.tituloSeccion}>🚨 Alertas</Text>

      <Toggle
        etiqueta="Alertas sonoras"
        descripcion="Sonidos para riesgos y avisos"
        valor={preferencias.alertas_sonoras}
        onCambiar={(v) => {
          void guardar({ alertas_sonoras: v });
          anunciar(v ? 'Alertas sonoras activadas.' : 'Alertas sonoras desactivadas.');
        }}
      />

      <Toggle
        etiqueta="Vibración"
        descripcion="Alertas hápticas (Sprint 3: emergencias)"
        valor={preferencias.vibracion_habilitada}
        onCambiar={(v) => {
          void guardar({ vibracion_habilitada: v });
          anunciar(v ? 'Vibración activada.' : 'Vibración desactivada.');
        }}
      />

      <SliderAjuste
        etiqueta="Intensidad de la vibración"
        valor={preferencias.intensidad_vibracion}
        minimo={0}
        maximo={100}
        paso={5}
        onCambiar={(v) => void guardar({ intensidad_vibracion: v })}
        alSoltar={(v) =>
          anunciar(`Intensidad de vibración al ${Math.round(v)} por ciento.`)
        }
        formatear={(v) => `${Math.round(v)}%`}
        deshabilitado={!preferencias.vibracion_habilitada}
      />

      {/* ─── Sección energía ─── */}
      <Text style={estilos.tituloSeccion}>🔋 Energía</Text>

      <Toggle
        etiqueta="Modo bajo consumo"
        descripcion="Reduce procesos pesados para ahorrar batería"
        valor={preferencias.modo_bajo_consumo}
        onCambiar={(v) => {
          void guardar({ modo_bajo_consumo: v });
          anunciar(v ? 'Modo bajo consumo activado.' : 'Modo bajo consumo desactivado.');
        }}
      />

      {guardando && (
        <Text style={estilos.guardando}>Guardando en el servidor…</Text>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colores.fondo },
  contenido: {
    padding: tamaños.lg,
    paddingBottom: tamaños.xl * 2,
    gap: tamaños.sm,
  },
  tituloSeccion: {
    color: colores.texto,
    fontSize: tamaños.fuenteXL,
    fontWeight: '700',
    marginTop: tamaños.md,
  },
  guardando: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    textAlign: 'center',
    marginTop: tamaños.sm,
  },
});