import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from 'expo-keep-awake';

import { colores, tamaños } from '@/constants/tema';
import { useTTS } from '@/hooks/useTTS';
import { vibrarNotificacion } from '@/services/haptics.service';
import {
  narracionService,
  type EstadoNarracion,
} from '@/services/narracion.service';

/**
 * ══════════════════════════════════════════════════════
 * ESCUDO TÁCTIL — FIX del Modo Continuo para uso en PECHERA.
 *
 * El teléfono va a la altura del pecho (usuario no vidente):
 * si la pantalla queda operativa, cualquier movimiento brusco
 * genera toques fantasma (cambia de tab, apaga el asistente…).
 *
 * Solución en 3 capas (sin módulos nativos extra):
 *
 *   1. KEEP-AWAKE (expo-keep-awake): la pantalla NO se apaga
 *      mientras el modo continúa → el TTS del sistema sigue
 *      hablando (con pantalla apagada el motor de voz se
 *      congela en la mayoría de Android) y las alertas
 *      hápticas se mantienen.
 *
 *   2. BLOQUEO TÁCTIL: al activarse el modo se bloquea la
 *      pantalla tras 1.5 s. El escudo es una capa que TRAGA
 *      todos los toques (nada de tabs, switches ni botones).
 *      Salida accesible: LONG-PRESS de 2.5 s en cualquier
 *      punto (anunciado por voz al bloquear).
 *
 *   3. BOTÓN DE RE-BLOQUEO: tras desbloquear, el asistente
 *      SIGUE activo y aparece un botón flotante para volver
 *      a bloquear sin detener la narración.
 *
 * Montar UNA vez en RootNavigator: cubre toda la app
 * (incluida la tab bar). Al desactivarse el modo (switch,
 * cambio de tab o logout) el escudo se levanta solo.
 * ══════════════════════════════════════════════════════
 */

/** Espera antes de bloquear (deja terminar el toque de activación) */
const RETARDO_BLOQUEO_MS = 1500;

/** Long-press para desbloquear (ms) — inconfundible, no accidental */
const RETARDO_DESBLOQUEO_MS = 2500;

export function EscudoTactilGlobal() {
  const { anunciar } = useTTS();

  // Estado del modo continuo (única fuente de verdad: el servicio)
  const [estado, setEstado] = useState<EstadoNarracion>(
    narracionService.estadoActual(),
  );
  const [bloqueado, setBloqueado] = useState(false);

  // Evita duplicar el anuncio de bloqueo entre renders
  const anuncioBloqueoRef = useRef(false);

  useEffect(() => narracionService.suscribir(setEstado), []);

  // ─── Ciclo de vida: activo → keep-awake + auto-bloqueo ───
  useEffect(() => {
    if (estado.activo) {
      void activateKeepAwakeAsync();

      const temporizador = setTimeout(() => {
        setBloqueado(true);
        if (!anuncioBloqueoRef.current) {
          anuncioBloqueoRef.current = true;
          anunciar(
            'Pantalla bloqueada para evitar toques accidentales. ' +
              'El asistente sigue hablando. Mantén presionada la ' +
              'pantalla dos segundos para desbloquearla.',
            { forzar: true },
          );
        }
      }, RETARDO_BLOQUEO_MS);

      return () => clearTimeout(temporizador);
    }

    // Modo desactivado: levantar todo
    deactivateKeepAwake();
    setBloqueado(false);
    anuncioBloqueoRef.current = false;
    return undefined;
  }, [estado.activo, anunciar]);

  function desbloquear() {
    if (!bloqueado) return;
    setBloqueado(false);
    void vibrarNotificacion();
    anunciar(
      'Pantalla desbloqueada. El asistente continúa activo. ' +
        'Puedes bloquearla de nuevo con el botón inferior.',
      { forzar: true },
    );
  }

  function bloquear() {
    if (!estado.activo || bloqueado) return;
    setBloqueado(true);
    void vibrarNotificacion();
    anunciar('Pantalla bloqueada.', { forzar: true });
  }

  const esLectura = estado.modo === 'lectura';

  return (
    <>
      {/* ─── Botón flotante de re-bloqueo (activo y desbloqueado) ─── */}
      {estado.activo && !bloqueado && (
        <View style={estilos.zonaPill} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bloquear pantalla para evitar toques accidentales"
            accessibilityHint="El asistente continuo sigue activo al bloquear"
            onPress={bloquear}
            style={({ pressed }) => [
              estilos.pill,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={estilos.pillTexto}>🔒 Bloquear pantalla</Text>
          </Pressable>
        </View>
      )}

      {/* ─── ESCUDO: capa a pantalla completa que traga toques ─── */}
      {bloqueado && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            'Pantalla bloqueada. El asistente sigue narrando. ' +
            'Mantén presionado dos segundos para desbloquear.'
          }
          delayLongPress={RETARDO_DESBLOQUEO_MS}
          onLongPress={desbloquear}
          style={estilos.escudo}
        >
          <Text aria-hidden style={estilos.icono}>
            🛡️
          </Text>
          <Text style={estilos.titulo}>Pantalla bloqueada</Text>
          <Text style={estilos.modo}>
            {esLectura
              ? '📖 Lectura continua en marcha'
              : '🔄 Asistente continuo en marcha'}
          </Text>

          {/* Última narración (para acompañante vidente) */}
          {estado.ultimoMensaje && (
            <View style={estilos.mensajeZona}>
              <Text style={estilos.mensaje} numberOfLines={4}>
                {estado.ultimoNivel === 'ALERTA' ? '🚨 ' : '💬 '}
                {estado.ultimoMensaje}
              </Text>
            </View>
          )}

          <View style={estilos.instruccionZona}>
            <Text style={estilos.instruccion}>
              Mantén presionado 2 segundos para desbloquear
            </Text>
            <Text style={estilos.instruccionSutil}>
              La voz y la vibración siguen funcionando
            </Text>
          </View>
        </Pressable>
      )}
    </>
  );
}

/* ═══════════════════ ESTILOS ═══════════════════ */

const estilos = StyleSheet.create({
  zonaPill: {
    position: 'absolute',
    bottom: 80, // sobre la tab bar (64dp)
    alignSelf: 'center',
    zIndex: 90,
  },
  pill: {
    backgroundColor: colores.superficie,
    borderColor: colores.primario,
    borderWidth: 2,
    borderRadius: tamaños.redondo,
    paddingHorizontal: tamaños.lg,
    paddingVertical: 10,
    minHeight: tamaños.touchMin,
    justifyContent: 'center',
  },
  pillTexto: {
    color: colores.texto,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
  },

  escudo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(2, 6, 23, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tamaños.xl,
    gap: tamaños.md,
  },
  icono: { fontSize: 64, marginBottom: tamaños.sm },
  titulo: {
    color: colores.texto,
    fontSize: tamaños.fuenteXXL,
    fontWeight: '700',
  },
  modo: {
    color: colores.exito,
    fontSize: tamaños.fuenteMD,
    fontWeight: '600',
  },
  mensajeZona: {
    marginTop: tamaños.md,
    backgroundColor: colores.superficie,
    borderColor: colores.borde,
    borderWidth: 1,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
    maxWidth: '100%',
  },
  mensaje: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    lineHeight: 20,
  },
  instruccionZona: {
    marginTop: tamaños.xl,
    alignItems: 'center',
    gap: tamaños.xs,
  },
  instruccion: {
    color: colores.advertencia,
    fontSize: tamaños.fuenteMD,
    fontWeight: '700',
    textAlign: 'center',
  },
  instruccionSutil: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    textAlign: 'center',
  },
});
