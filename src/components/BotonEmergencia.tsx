import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colores, tamaños } from '@/constants/tema';
import {
  vibrarAdvertencia,
  vibrarEmergencia,
  vibrarNotificacion,
} from '@/services/haptics.service';

/**
 * ══════════════════════════════════════════════════════
 * Botón de emergencia — MANTENER 1.5s para confirmar.
 *
 * Anti-activación accidental:
 *   - Progreso visible (barra que se llena)
 *   - Háptica escalonada: suave (inicio) → advertencia (50%)
 *     → confirmación (100%)
 *   - Soltar antes del 100% → CANCELA y avisa por voz (onCancela)
 *
 * Accesibilidad:
 *   - accessibilityHint explica el gesto de mantener
 *   - accessibilityState busy durante el envío
 * ══════════════════════════════════════════════════════
 */

const DURACION_MS = 1500;
const TICK_MS = 60;

interface Props {
  etiqueta: string;
  /** Confirmación completada (1.5s sostenidos) */
  onConfirmar: () => void;
  /** Soltó antes de tiempo (para anunciar por voz) */
  onCancela?: () => void;
  /** true = deshabilitado (enviando en curso) */
  deshabilitado?: boolean;
}

export function BotonEmergencia({
  etiqueta,
  onConfirmar,
  onCancela,
  deshabilitado = false,
}: Props) {
  const [progreso, setProgreso] = useState(0); // 0–100
  const [presionado, setPresionado] = useState(false);

  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progresoRef = useRef(0);
  const confirmadoRef = useRef(false);

  const limpiarIntervalo = useCallback(() => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  }, []);

  // Cleanup al desmontar (si se desmonta a mitad de mantener)
  useEffect(() => {
    return () => {
      limpiarIntervalo();
    };
  }, [limpiarIntervalo]);

  const iniciar = useCallback(() => {
    if (deshabilitado) return;

    confirmadoRef.current = false;
    progresoRef.current = 0;
    setProgreso(0);
    setPresionado(true);

    // Feedback háptico inicial (suave)
    void vibrarNotificacion();

    intervaloRef.current = setInterval(() => {
      progresoRef.current += (TICK_MS / DURACION_MS) * 100;
      const p = Math.min(100, progresoRef.current);
      setProgreso(p);

      // Háptica a mitad (advertencia: "sigue manteniendo")
      if (p >= 50 && p < 50 + (TICK_MS / DURACION_MS) * 100) {
        void vibrarAdvertencia();
      }

      // ─── Confirmación ───
      if (p >= 100 && !confirmadoRef.current) {
        confirmadoRef.current = true;
        limpiarIntervalo();
        setPresionado(false);
        void vibrarEmergencia(2);
        onConfirmar();
      }
    }, TICK_MS);
  }, [deshabilitado, limpiarIntervalo, onConfirmar]);

  const cancelar = useCallback(() => {
    limpiarIntervalo();
    setPresionado(false);

    if (!confirmadoRef.current && progresoRef.current > 0) {
      // Soltó a mitad → cancelación explícita
      progresoRef.current = 0;
      setProgreso(0);
      onCancela?.();
    } else {
      // Soltó casi inmediato (toque normal) → silencioso
      progresoRef.current = 0;
      setProgreso(0);
    }
  }, [limpiarIntervalo, onCancela]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${etiqueta}. Mantén presionado durante 1.5 segundos para confirmar.`}
      accessibilityHint="Mantén presionado hasta que el botón vibre 3 veces. Si sueltas antes, se cancela."
      accessibilityState={{ busy: deshabilitado, disabled: deshabilitado }}
      onPressIn={iniciar}
      onPressOut={cancelar}
      disabled={deshabilitado}
      style={({ pressed }) => [
        estilos.boton,
        deshabilitado && { opacity: 0.5 },
        (pressed || presionado) && !deshabilitado && {
          transform: [{ scale: 0.98 }],
        },
      ]}
    >
      <Text aria-hidden style={estilos.icono}>
        🆘
      </Text>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={estilos.instruccion}>
        Mantén presionado para confirmar
      </Text>

      {/* Barra de progreso del mantener */}
      <View style={estilos.zonaBarra}>
        <View style={estilos.barraFondo}>
          <View
            style={[
              estilos.barraRelleno,
              { width: `${progreso}%` },
              progreso >= 100 && { backgroundColor: colores.exito },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    backgroundColor: colores.peligro,
    borderRadius: tamaños.radioLG,
    padding: tamaños.lg,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
    width: '100%',
  },
  icono: { fontSize: 52, marginBottom: tamaños.xs },
  etiqueta: {
    color: '#ffffff',
    fontSize: tamaños.fuenteXXL,
    fontWeight: '700',
  },
  instruccion: {
    color: '#fecaca',
    fontSize: tamaños.fuenteSM,
    marginTop: tamaños.xs,
  },
  zonaBarra: {
    alignSelf: 'stretch',
    marginTop: tamaños.md,
    paddingHorizontal: tamaños.xl,
  },
  barraFondo: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  barraRelleno: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
});