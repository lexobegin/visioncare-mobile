import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  narracionService,
  type EstadoNarracion,
  type FotogramaCapturado,
} from '@/services/narracion.service';

/**
 * ══════════════════════════════════════════════════════
 * Hook del MODO CONTINUO — conecta el servicio de narración
 * con la pantalla de cámara y las preferencias (CU03).
 *
 * Uso en PantallaCamara (T18):
 *
 *   const { activo, procesando, estado, alternar } = useModoContinuo(
 *     capturarFotograma  // () => takePictureAsync → {uri, ancho, alto}
 *   );
 *
 * Responsabilidades:
 *   - Sincroniza preferencias CU03 (bajo consumo, vibración)
 *     al activar (el servicio las usa durante TODO el modo)
 *   - Suscribe la UI al estado del bucle (chip de estado)
 *   - Limpieza: desactiva al desmontar la pantalla (y con ello
 *     al cambiar de tab — el modo es de sesión de cámara)
 * ══════════════════════════════════════════════════════
 */
export function useModoContinuo(
  capturarFotograma: () => Promise<FotogramaCapturado | null>,
) {
  const { preferencias } = useAuth();

  const [estado, setEstado] = useState<EstadoNarracion>(
    narracionService.estadoActual(),
  );

  // Ref estable: la función de captura más reciente sin
  // re-suscribir el servicio en cada render de la pantalla
  const capturarRef = useRef(capturarFotograma);
  capturarRef.current = capturarFotograma;

  // Suscripción al estado del servicio
  useEffect(() => narracionService.suscribir(setEstado), []);

  const activar = useCallback(
    (opciones?: { modoLectura?: boolean }) => {
      narracionService.activar({
        capturarFotograma: () => capturarRef.current(),
        bajoConsumo: preferencias?.modo_bajo_consumo ?? false,
        vibracionHabilitada: preferencias?.vibracion_habilitada ?? true,
        modoLectura: opciones?.modoLectura ?? false,
      });
    },
    [preferencias?.modo_bajo_consumo, preferencias?.vibracion_habilitada],
  );

  const desactivar = useCallback(() => {
    narracionService.desactivar();
  }, []);

  const alternar = useCallback(
    (opciones?: { modoLectura?: boolean }) => {
      if (narracionService.estaActivo()) {
        desactivar();
      } else {
        activar(opciones);
      }
    },
    [activar, desactivar],
  );

  // Cleanup al desmontar (cambiar de tab / logout / app close)
  useEffect(() => {
    return () => {
      narracionService.desactivar();
    };
  }, []);

  return {
    estado,
    activo: estado.activo,
    procesando: estado.procesando,
    activar,
    desactivar,
    alternar,
  };
}