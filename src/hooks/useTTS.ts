import { useCallback, useEffect } from 'react';

import { ttsService } from '@/services/tts.service';
import { useAuth } from '@/context/AuthContext';

/**
 * ══════════════════════════════════════════════════════
 * Hook de acceso al TTS — sincroniza automáticamente las
 * preferencias de accesibilidad (CU03) del usuario con el
 * servicio singleton. TODAS las pantallas lo usan:
 *
 *   const { anunciar, detener } = useTTS();
 *   anunciar('Bienvenido de nuevo, María.');
 *   anunciar('Error: credenciales inválidas.');
 *   anunciar('Emergencia.', { forzar: true }); // ignora el OFF
 * ══════════════════════════════════════════════════════
 */
export function useTTS() {
  const { preferencias, usuario } = useAuth();

  // Preferencias cambian (login, hidratación, edición CU03)
  // → el servicio singleton se actualiza al instante.
  useEffect(() => {
    ttsService.configurar({
      habilitada: preferencias?.voz_habilitada ?? true,
      velocidad: preferencias?.velocidad_voz ?? 1.0,
      volumen: preferencias?.volumen_voz ?? 80,
      idioma: usuario?.perfil?.idioma ?? 'es',
      alertasSonoras: preferencias?.alertas_sonoras ?? true,
    });
  }, [preferencias, usuario?.perfil?.idioma]);

  // Limpieza al desmontar el árbol con sesión (logout):
  // corta cualquier voz en curso.
  useEffect(() => {
    return () => {
      void ttsService.detener();
    };
  }, []);

  const anunciar = useCallback(
    (texto: string, opciones?: { forzar?: boolean; alTerminar?: () => void }) =>
      void ttsService.anunciar(texto, opciones),
    [],
  );

  const detener = useCallback(() => void ttsService.detener(), []);

  const estaHablando = useCallback(
    () => ttsService.estaHablando(),
    [],
  );

  return { anunciar, detener, estaHablando };
}