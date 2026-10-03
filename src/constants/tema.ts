/**
 * ══════════════════════════════════════════════════════
 * Tema accesible de VisionCare AI (móvil).
 *
 * Principios:
 *   - TEMA OSCURO de alto contraste (usuarios con baja visión)
 *   - Texto sobre fondo: contraste ≥ 7:1 (AAA donde es posible)
 *   - Áreas táctiles ≥ 48dp (botones: 56dp)
 *   - Fuentes base 16, títulos escalados con jerarquía clara
 *
 * Los estilos de componente (botones, tarjetas) se definen
 * como objetos reutilizables aquí para mantener consistencia
 * en TODAS las pantallas sin repetir StyleSheet.
 * ══════════════════════════════════════════════════════
 */

export const colores = {
  // ─── Fondo y superficies ───
  fondo: '#0f172a',          // slate-900
  superficie: '#1e293b',     // slate-800 (tarjetas)
  superficieClara: '#334155', // slate-700 (inputs, chips)

  // ─── Texto ───
  texto: '#f8fafc',          // slate-50 (principal, AAA sobre fondo)
  textoSecundario: '#cbd5e1', // slate-300 (secundario, AA+)
  textoSutil: '#94a3b8',     // slate-400 (hints, fechas)

  // ─── Primaria (azul accesible sobre oscuro) ───
  primario: '#3b82f6',       // botones
  primarioHover: '#2563eb',
  primarioTexto: '#ffffff',

  // ─── Semánticos ───
  exito: '#10b981',
  exitoFondo: '#064e3b',
  peligro: '#ef4444',
  peligroFondo: '#7f1d1d',
  advertencia: '#f59e0b',
  advertenciaFondo: '#78350f',
  info: '#38bdf8',

  // ─── Bordes ───
  borde: '#475569',          // slate-600
  bordeFuerte: '#64748b',
} as const;

export const tamaños = {
  // ─── Tipografía ───
  fuenteXS: 12,
  fuenteSM: 14,
  fuenteMD: 16,   // base — nada por debajo
  fuenteLG: 18,
  fuenteXL: 22,
  fuenteXXL: 28,
  fuenteTitulo: 32,

  // ─── Táctiles (≥48dp obligatorio) ───
  botonAltura: 56,
  botonAlturaSM: 48,
  iconoBoton: 48,  // área mínima de iconos clicables
  touchMin: 48,

  // ─── Espaciado ───
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,

  // ─── Radios ───
  radioSM: 8,
  radioMD: 12,
  radioLG: 16,
  redondo: 999,
} as const;

/** Estilos compartidos de botones (usa Button del Tanda con componentes) */
export const estilosComunes = {
  botonPrimario: {
    backgroundColor: colores.primario,
    borderRadius: tamaños.radioMD,
    height: tamaños.botonAltura,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: tamaños.lg,
  },
  botonTexto: {
    color: colores.primarioTexto,
    fontSize: tamaños.fuenteLG,
    fontWeight: '700' as const,
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: tamaños.radioLG,
    padding: tamaños.md,
  },
  input: {
    backgroundColor: colores.superficieClara,
    borderRadius: tamaños.radioMD,
    color: colores.texto,
    fontSize: tamaños.fuenteMD,
    height: tamaños.botonAltura,
    paddingHorizontal: tamaños.md,
  },
  etiqueta: {
    color: colores.textoSecundario,
    fontSize: tamaños.fuenteSM,
    fontWeight: '600' as const,
    marginBottom: tamaños.xs,
  },
  pantalla: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
} as const;