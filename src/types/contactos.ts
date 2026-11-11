/**
 * ══════════════════════════════════════════════════════
 * Contactos de confianza (CU05) — sin cambios S2.
 * ══════════════════════════════════════════════════════
 */

import type { ConsultaPaginada } from './common';

export type EstadoContacto = 'ACTIVO' | 'INACTIVO';

export interface Contacto {
  id_contacto: number;
  id_usuario: number;
  nombre: string;
  parentesco?: string | null;
  telefono?: string | null;
  correo?: string | null;
  prioridad: number;
  autorizado_ubicacion: boolean;
  autorizado_emergencias: boolean;
  estado: EstadoContacto;
}

export interface ContactoQuery extends ConsultaPaginada {
  estado?: 'ACTIVO' | 'INACTIVO' | 'TODOS';
}

export interface CrearContactoPayload {
  nombre: string;
  parentesco?: string;
  telefono?: string;
  correo?: string;
  prioridad?: number;
  autorizado_ubicacion?: boolean;
  autorizado_emergencias?: boolean;
}

export type ActualizarContactoPayload = Partial<CrearContactoPayload>;