/**
 * ══════════════════════════════════════════════════════
 * Validaciones de formulario — ESPEJO EXACTO de los DTOs
 * del backend (RegistroDto, LoginDto, CambiarContrasenaDto).
 *
 * Devuelven null si es válido, o el mensaje de error.
 * El backend re-valida (defensa en profundidad) — aquí solo
 * mejoramos la UX evitando peticiones que fallarán.
 * ══════════════════════════════════════════════════════
 */

const REGEX_CORREO = /^\S+@\S+\.\S+$/;
const REGEX_TELEFONO = /^[+0-9\s().-]{7,30}$/;

/** Formato de correo (backend: @IsEmail + @MaxLength(150)) */
export function validarCorreo(correo: string): string | null {
  const limpio = correo.trim();
  if (!limpio) return 'El correo es obligatorio.';
  if (!REGEX_CORREO.test(limpio)) return 'Formato de correo inválido.';
  if (limpio.length > 150) return 'El correo no puede superar 150 caracteres.';
  return null;
}

/**
 * Contraseña (backend: @MinLength(8) + mayúscula + minúscula + número).
 * Mensajes redactados por regla — el campo de error los lista uno a uno.
 */
export function validarContrasena(contrasena: string): string[] {
  const errores: string[] = [];

  if (contrasena.length < 8) {
    errores.push('al menos 8 caracteres');
  }
  if (!/[A-Z]/.test(contrasena)) {
    errores.push('una letra mayúscula');
  }
  if (!/[a-z]/.test(contrasena)) {
    errores.push('una letra minúscula');
  }
  if (!/[0-9]/.test(contrasena)) {
    errores.push('un número');
  }

  if (errores.length === 0) return [];

  return [`La contraseña debe tener ${errores.join(', ')}.`];
}

/** Teléfono opcional (backend: /^[+0-9\s().-]{7,30}$/) */
export function validarTelefono(telefono: string): string | null {
  const limpio = telefono.trim();
  if (!limpio) return null; // opcional
  if (!REGEX_TELEFONO.test(limpio)) {
    return 'El teléfono no tiene un formato válido (ej: +591 70011122).';
  }
  return null;
}

/** Nombres (backend: @MinLength(2) + @MaxLength(100)) */
export function validarNombres(nombres: string): string | null {
  const limpio = nombres.trim();
  if (limpio.length < 2) return 'Los nombres deben tener al menos 2 caracteres.';
  if (limpio.length > 100) return 'Los nombres no pueden superar 100 caracteres.';
  return null;
}