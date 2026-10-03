import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  iniciarSesion as iniciarSesionApi,
  obtenerPerfilActual,
  registrarUsuario as registrarUsuarioApi,
} from '@/api/auth.api';
import { alExpirarSesion } from '@/api/client';
import {
  actualizarMisPreferencias,
  obtenerMisPreferencias,
} from '@/api/accesibilidad.api';
import {
  eliminarToken,
  guardarToken,
  obtenerToken,
} from '@/api/token';
import type {
  ActualizarPreferenciasPayload,
  LoginPayload,
  PreferenciasAccesibilidad,
  RegistroPayload,
  Usuario,
} from '@/types';

/**
 * ══════════════════════════════════════════════════════
 * AuthContext — sesión global de la app móvil.
 *
 * Estado:
 *   usuario       → Usuario completo (con Perfil 1:1)
 *   preferencias  → Preferencias de accesibilidad (CU03)
 *                   cargadas SIEMPRE (el TTS global las lee)
 *   cargando      → hidratación inicial en curso
 *   autenticado   → derivado de usuario !== null
 *
 * Acciones:
 *   iniciarSesion()          → CU02 (token + perfil + prefs)
 *   registrarse()            → CU01 (auto-login tras registro)
 *   cerrarSesion()           → limpia token + estado
 *   refrescarPerfil()        → re-lee /usuarios/me
 *   actualizarPreferencias() → CU03 (persiste + estado local)
 *
 * Eventos externos que este contexto maneja:
 *   - 401 global (alExpirarSesion) → cierra sesión sin navegar
 *     (la navegación reacciona al cambio de autenticado)
 * ══════════════════════════════════════════════════════
 */

interface EstadoSesion {
  usuario: Usuario | null;
  preferencias: PreferenciasAccesibilidad | null;
  cargando: boolean;
  autenticado: boolean;
}

interface AccionesSesion {
  iniciarSesion: (payload: LoginPayload) => Promise<void>;
  registrarse: (payload: RegistroPayload) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  refrescarPerfil: () => Promise<void>;
  actualizarPreferencias: (
    payload: ActualizarPreferenciasPayload,
  ) => Promise<void>;
}

export type AuthContextValue = EstadoSesion & AccionesSesion;

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [preferencias, setPreferencias] =
    useState<PreferenciasAccesibilidad | null>(null);
  const [cargando, setCargando] = useState(true);

  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // ─── Carga de preferencias (paralela al perfil, tolerante) ───
  const cargarPreferencias = useCallback(async () => {
    try {
      const prefs = await obtenerMisPreferencias();
      if (montado.current) setPreferencias(prefs);
    } catch {
      // No bloquea la sesión: el TTS usará defaults del servicio
      if (montado.current) setPreferencias(null);
    }
  }, []);

  // ─── Hidratación inicial ───
  useEffect(() => {
    (async () => {
      const token = await obtenerToken();

      if (!token) {
        setCargando(false);
        return;
      }

      try {
        const perfil = await obtenerPerfilActual();
        if (montado.current) setUsuario(perfil);
        await cargarPreferencias();
      } catch {
        // 401 → el interceptor ya eliminó el token.
        // Otros fallos (backend caído): sesión anulada por seguridad.
        await eliminarToken();
        if (montado.current) setUsuario(null);
      } finally {
        if (montado.current) setCargando(false);
      }
    })();
  }, [cargarPreferencias]);

  // ─── Flujo compartido: guardar token + hidratar todo ───
  const establecerSesion = useCallback(
    async (token: string) => {
      await guardarToken(token);
      try {
        const perfil = await obtenerPerfilActual();
        if (!montado.current) return;
        setUsuario(perfil);
        await cargarPreferencias();
      } catch (error) {
        // Token válido pero perfil falló: revertir sesión a medias
        await eliminarToken();
        if (montado.current) setUsuario(null);
        throw error;
      }
    },
    [cargarPreferencias],
  );

  // ─── CU02: iniciar sesión ───
  const iniciarSesion = useCallback(
    async (payload: LoginPayload) => {
      const respuesta = await iniciarSesionApi(payload);
      await establecerSesion(respuesta.access_token);
    },
    [establecerSesion],
  );

  // ─── CU01: registro con auto-login ───
  const registrarse = useCallback(
    async (payload: RegistroPayload) => {
      const respuesta = await registrarUsuarioApi(payload);
      await establecerSesion(respuesta.access_token);
    },
    [establecerSesion],
  );

  // ─── Cerrar sesión ───
  const cerrarSesion = useCallback(async () => {
    await eliminarToken();
    if (montado.current) {
      setUsuario(null);
      setPreferencias(null);
    }
  }, []);

  // ─── CU04: re-ler perfil tras ediciones ───
  const refrescarPerfil = useCallback(async () => {
    const perfil = await obtenerPerfilActual();
    if (montado.current) setUsuario(perfil);
  }, []);

  // ─── CU03: actualizar preferencias (persistente + estado) ───
  const actualizarPreferencias = useCallback(
    async (payload: ActualizarPreferenciasPayload) => {
      const actualizadas = await actualizarMisPreferencias(payload);
      if (montado.current) setPreferencias(actualizadas);
    },
    [],
  );

  // ─── 401 global → anular sesión (sin navegar: lo hace el guard) ───
  useEffect(() => {
    const cancelar = alExpirarSesion(() => {
      if (montado.current) {
        setUsuario(null);
        setPreferencias(null);
      }
    });
    return cancelar;
  }, []);

  const valor = useMemo<AuthContextValue>(
    () => ({
      usuario,
      preferencias,
      cargando,
      autenticado: usuario !== null,
      iniciarSesion,
      registrarse,
      cerrarSesion,
      refrescarPerfil,
      actualizarPreferencias,
    }),
    [
      usuario,
      preferencias,
      cargando,
      iniciarSesion,
      registrarse,
      cerrarSesion,
      refrescarPerfil,
      actualizarPreferencias,
    ],
  );

  return (
    <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook de acceso tipado a la sesión.
 * @throws si se usa fuera de <AuthProvider>
 */
export function useAuth(): AuthContextValue {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error(
      'useAuth debe usarse dentro de <AuthProvider>. ' +
        'Verifica que el componente esté envuelto por el proveedor.',
    );
  }
  return contexto;
}