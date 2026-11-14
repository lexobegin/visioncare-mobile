// ═══════════════════════════════════════════════════════════
// PantallaMasMenu — Sprint 3 (REEMPLAZA al anterior).
//
// 🆕 T11 — UX para no videntes: 13 botones en lista plana eran
// difíciles de recorrer palpando. Ahora está AGRUPADO por
// prioridad real de uso, cada grupo se anuncia por voz y el
// primer grupo es SEGURIDAD (lo que hay que encontrar rápido):
//
//   1) SEGURIDAD   → 🆘 Pedir ayuda · 📍 Compartir ubicación
//                     (CU21, toggle) · 🚨 Alertas
//   2) ASISTENCIA  → 🧭 Navegación · 🏋️ VisionCoach · 🚧 Incidente
//   3) MIS DATOS   → 📋 Mis incidentes · 📜 Historial · 🔄 Sync
//   4) CUENTA      → 👤 Perfil · 🔊 Accesibilidad · 📞 Contactos
//                     · 🚪 Cerrar sesión
//
// Cada grupo se anuncia al llegar (TTS) para orientar sin ver.
// ═══════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MasStackParamList } from '@/navigation/NavigationTypes';

import { useAuth } from '@/context/AuthContext';
import { useTTS } from '@/hooks/useTTS';
import { colores, tamaños } from '@/constants/tema';

import { listarAlertasPendientes } from '@/api/alertas.api';
import {
  ubicacionCompartidaService,
  type EstadoUbicacionCompartida,
} from '@/services/ubicacion-compartida.service';

export default function PantallaMasMenu() {
  const navigation = useNavigation<NativeStackNavigationProp<MasStackParamList>>();
  const { anunciar } = useTTS();
  const { usuario, cerrarSesion } = useAuth();

  const [alertasPendientes, setAlertasPendientes] = useState(0);
  const [ubicacion, setUbicacion] = useState<EstadoUbicacionCompartida>(
    ubicacionCompartidaService.estadoActual(),
  );

  useEffect(() => ubicacionCompartidaService.suscribir(setUbicacion), []);

  const alEnfocar = useCallback(() => {
    listarAlertasPendientes(1, 1)
      .then((r) => setAlertasPendientes(r.meta.total))
      .catch(() => setAlertasPendientes(0));
    anunciar(
      'Menú principal. Grupo uno: Seguridad. ' +
        'Pedir ayuda, Compartir mi ubicación y Alertas.',
      { forzar: false },
    );
  }, [anunciar]);

  useFocusEffect(alEnfocar);

  function alternarUbicacion() {
    ubicacionCompartidaService.alternar();
    const activara = !ubicacionCompartidaService.estadoActual().activo;
    anunciar(
      activara
        ? 'Ubicación compartida activada. Tu equipo de apoyo puede ' +
            'ver dónde estás en el mapa. Se envía cada un minuto.'
        : 'Ubicación compartida desactivada. Nadie puede ver tu posición.',
      { forzar: true },
    );
  }

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo}>
        {usuario?.perfil?.nombres ?? usuario?.correo}
      </Text>
      <Text style={estilos.sutil}>{usuario?.rol}</Text>

      {/* ═══════ 1 · SEGURIDAD (lo primero, siempre arriba) ═══════ */}
      <Seccion titulo="1. Seguridad" />

      <ItemMenu
        etiqueta="🆘  Pedir ayuda ahora (CU20)"
        peligrosa
        onPress={() => navigation.navigate('Ayuda')}
      />

      {/* 🆕 CU21 — toggle compartir ubicación */}
      <View style={estilos.filaToggle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            ubicacion.activo
              ? 'Compartir mi ubicación: activado'
              : 'Compartir mi ubicación: desactivado'
          }
          accessibilityHint="Tu equipo de apoyo ve tu posición en el mapa mientras esté activado"
          onPress={alternarUbicacion}
          style={({ pressed }) => [
            estilos.item,
            estilos.itemToggleZona,
            ubicacion.activo && { borderColor: colores.exito, borderWidth: 2 },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={estilos.itemTexto}>
            📍  Compartir mi ubicación (CU21)
          </Text>
          <Text style={estilos.itemSub}>
            {ubicacion.activo
              ? ubicacion.error ?? 'Enviando pings cada minuto…'
              : 'Desactivado: nadie ve tu posición'}
          </Text>
        </Pressable>
        <Switch
          value={ubicacion.activo}
          onValueChange={alternarUbicacion}
          trackColor={{ false: colores.superficieClara, true: colores.exito }}
          thumbColor="#ffffff"
          accessibilityLabel="Interruptor: compartir mi ubicación"
          style={estilos.switch}
        />
      </View>

      <ItemMenu
        etiqueta={
          alertasPendientes > 0
            ? `🚨  Alertas (${alertasPendientes} sin atender)`
            : '🔔  Alertas'
        }
        peligrosa={alertasPendientes > 0}
        onPress={() => navigation.navigate('Alertas')}
      />

      {/* ═══════ 2 · ASISTENCIA ═══════ */}
      <Seccion titulo="2. Asistencia" />
      <ItemMenu
        etiqueta="🧭  Navegación asistida (CU24)"
        onPress={() => navigation.navigate('Navegacion')}
      />
      <ItemMenu
        etiqueta="🏋️  VisionCoach (CU27-33)"
        onPress={() => navigation.navigate('VisionCoach')}
      />
      <ItemMenu
        etiqueta="🚧  Reportar incidente (CU22)"
        onPress={() => navigation.navigate('ReportarIncidente')}
      />

      {/* ═══════ 3 · MIS DATOS ═══════ */}
      <Seccion titulo="3. Mis registros" />
      <ItemMenu
        etiqueta="📋  Mis incidentes"
        onPress={() => navigation.navigate('MisIncidentes')}
      />
      <ItemMenu
        etiqueta="📜  Historial de actividades (CU23)"
        onPress={() => navigation.navigate('Historial')}
      />
      <ItemMenu
        etiqueta="🔄  Sincronización (CU25-26)"
        onPress={() => navigation.navigate('Sincronizacion')}
      />

      {/* ═══════ 4 · CUENTA ═══════ */}
      <Seccion titulo="4. Cuenta" />
      <ItemMenu
        etiqueta="👤  Mi perfil (CU04)"
        onPress={() => navigation.navigate('Perfil')}
      />
      <ItemMenu
        etiqueta="🔊  Accesibilidad (CU03)"
        onPress={() => navigation.navigate('Accesibilidad')}
      />
      <ItemMenu
        etiqueta="📞  Contactos de confianza (CU05)"
        onPress={() => navigation.navigate('Contactos')}
      />
      <ItemMenu
        etiqueta="🚪  Cerrar sesión"
        peligrosa
        onPress={() => void cerrarSesion()}
      />
    </View>
  );
}

/** Encabezado de grupo (anunciado por el useFocusEffect inicial) */
function Seccion({ titulo }: { titulo: string }) {
  return (
    <Text style={estilos.seccion} accessibilityRole="header">
      {`─ ${titulo} ─`}
    </Text>
  );
}

function ItemMenu(props: { etiqueta: string; onPress: () => void; peligrosa?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.etiqueta}
      onPress={props.onPress}
      style={({ pressed }) => [
        estilos.item,
        props.peligrosa && { backgroundColor: colores.peligroFondo },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={estilos.itemTexto}>{props.etiqueta}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
    padding: tamaños.lg,
    gap: tamaños.xs,
  },
  titulo: { color: colores.texto, fontSize: tamaños.fuenteXL, fontWeight: '700' },
  sutil: { color: colores.textoSutil, fontSize: tamaños.fuenteSM, marginBottom: tamaños.md },
  seccion: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteSM,
    fontWeight: '700',
    marginTop: tamaños.sm,
    marginBottom: 2,
  },
  item: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioMD,
    minHeight: tamaños.botonAltura,
    justifyContent: 'center',
    paddingHorizontal: tamaños.md,
  },
  itemToggleZona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tamaños.sm,
  },
  itemSub: {
    color: colores.textoSutil,
    fontSize: tamaños.fuenteXS,
    marginTop: 2,
    flexShrink: 1,
  },
  itemTexto: {
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    fontWeight: '600',
    flexShrink: 1,
  },
  switch: { marginLeft: 'auto' },
  filaToggle: { gap: 0 },
});
