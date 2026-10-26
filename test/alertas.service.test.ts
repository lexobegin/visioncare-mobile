/**
 * ══════════════════════════════════════════════════════════════════════
 * VisionCare AI — Móvil — Suite de Pruebas Unitarias para CU17
 * ══════════════════════════════════════════════════════════════════════
 *
 * Cobertura de requerimientos obligatorios:
 *  1. Priorización de alertas altas frente a bajas.
 *  2. Ordenamiento de múltiples alertas.
 *  3. Alertas con igual prioridad (desempate por cercanía / FIFO).
 *  4. Supresión de duplicados innecesarios (RNF06).
 *  5. Recepción de alerta crítica mientras existen otras pendientes.
 *  6. Manejo seguro de detecciones vacías o nulas.
 *  7. Manejo de datos inválidos o corruptos (Fail-safe).
 *  8. Correcta entrega de alertas a los consumidores (patrón observer para CU18).
 *  9. Escalamiento crítico durante el período de enfriamiento.
 *  10. Caducidad y limpieza de alertas obsoletas (TTL).
 */

import { AlertasService } from '../src/services/alertas.service';
import type { DeteccionResponse } from '../src/types';
import type { AlertaRiesgo } from '../src/types/alerta';

// ─── Aserciones tipadas estrictas (compatibles con Expo TypeScript) ───

function afirmar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) {
    throw new Error(`[FALLO]: ${mensaje}`);
  }
}

function afirmarIgual<T>(obtenido: T, esperado: T, mensaje?: string): void {
  if (obtenido !== esperado) {
    throw new Error(
      `[FALLO]: ${mensaje ?? 'Valores no coinciden'}. Esperado: ${String(esperado)}, Obtenido: ${String(obtenido)}`,
    );
  }
}

// ─── Ejecutor de pruebas ───

interface ResultadoPrueba {
  nombre: string;
  paso: boolean;
  error?: string;
}

export function ejecutarPruebasCU17(): ResultadoPrueba[] {
  const resultados: ResultadoPrueba[] = [];

  function ejecutarCaso(nombre: string, fn: () => void): void {
    try {
      fn();
      resultados.push({ nombre, paso: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      resultados.push({ nombre, paso: false, error: msg });
    }
  }

  // 1. Priorización de alertas altas frente a bajas
  ejecutarCaso('1. Priorización de alertas altas frente a bajas', () => {
    const service = new AlertasService();

    const deteccionBaja: DeteccionResponse = {
      id_deteccion: 1,
      etiqueta: 'bottle',
      etiqueta_es: 'botella',
      confianza: 0.85,
      bbox: { x_min: 0.1, y_min: 0.1, x_max: 0.2, y_max: 0.2 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    const deteccionAlta: DeteccionResponse = {
      id_deteccion: 2,
      etiqueta: 'car',
      etiqueta_es: 'auto',
      confianza: 0.92,
      bbox: { x_min: 0.3, y_min: 0.2, x_max: 0.7, y_max: 0.8 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    service.procesarDetecciones([deteccionBaja, deteccionAlta]);

    const primeraAlerta = service.obtenerSiguienteAlerta();
    const segundaAlerta = service.obtenerSiguienteAlerta();

    afirmar(primeraAlerta !== null, 'Debe haber una primera alerta');
    afirmarIgual(primeraAlerta.etiqueta, 'car', 'El auto (crítico) debe salir primero');
    afirmarIgual(primeraAlerta.nivel, 'CRITICO');

    afirmar(segundaAlerta !== null, 'Debe haber una segunda alerta');
    afirmarIgual(segundaAlerta.etiqueta, 'bottle', 'La botella debe salir después');
    afirmarIgual(segundaAlerta.nivel, 'INFO');
  });

  // 2. Ordenamiento de múltiples alertas
  ejecutarCaso('2. Ordenamiento de múltiples alertas de distinta severidad', () => {
    const service = new AlertasService();

    const detecciones: DeteccionResponse[] = [
      {
        id_deteccion: 10,
        etiqueta: 'cup',
        etiqueta_es: 'taza',
        confianza: 0.70,
        bbox: { x_min: 0.1, y_min: 0.1, x_max: 0.15, y_max: 0.15 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
      {
        id_deteccion: 20,
        etiqueta: 'bus',
        etiqueta_es: 'bus',
        confianza: 0.95,
        bbox: { x_min: 0.25, y_min: 0.1, x_max: 0.75, y_max: 0.8 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
      {
        id_deteccion: 30,
        etiqueta: 'person',
        etiqueta_es: 'persona',
        confianza: 0.88,
        bbox: { x_min: 0.4, y_min: 0.3, x_max: 0.6, y_max: 0.7 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
    ];

    service.procesarDetecciones(detecciones);
    const pendientes = service.obtenerAlertasPendientes();

    afirmarIgual(pendientes.length, 3, 'Deben registrarse las 3 alertas');
    afirmarIgual(pendientes[0].etiqueta, 'bus', 'El bus debe ocupar posición 0 (CRITICO)');
    afirmarIgual(pendientes[1].etiqueta, 'person', 'La persona debe ocupar posición 1 (MEDIO)');
    afirmarIgual(pendientes[2].etiqueta, 'cup', 'La taza debe ocupar posición 2 (INFO)');
  });

  // 3. Alertas con igual prioridad
  ejecutarCaso('3. Alertas con igual prioridad (desempate por cercanía y FIFO)', () => {
    const service = new AlertasService();

    const sillaLejana: DeteccionResponse = {
      id_deteccion: 101,
      etiqueta: 'chair',
      etiqueta_es: 'silla',
      confianza: 0.8,
      bbox: { x_min: 0.1, y_min: 0.1, x_max: 0.3, y_max: 0.3 }, // área 0.04
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    const sillaCercana: DeteccionResponse = {
      id_deteccion: 102,
      etiqueta: 'chair',
      etiqueta_es: 'silla',
      confianza: 0.8,
      bbox: { x_min: 0.7, y_min: 0.2, x_max: 0.95, y_max: 0.8 }, // área 0.15
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    service.procesarDetecciones([sillaLejana, sillaCercana]);

    const primera = service.obtenerSiguienteAlerta();
    const segunda = service.obtenerSiguienteAlerta();

    afirmar(primera !== null && segunda !== null, 'Ambas sillas deben generarse');
    afirmarIgual(primera.posicion, 'DERECHA', 'La silla con mayor área debe atenderse primero');
    afirmarIgual(segunda.posicion, 'IZQUIERDA', 'La silla lejana debe atenderse después');
  });

  // 4. Supresión de duplicados
  ejecutarCaso('4. Supresión de duplicados dentro del intervalo configurado (RNF06)', () => {
    const service = new AlertasService();
    service.configurar({ intervaloDeduplicacionMs: 4000 });

    const deteccion: DeteccionResponse = {
      id_deteccion: 201,
      etiqueta: 'person',
      etiqueta_es: 'persona',
      confianza: 0.85,
      bbox: { x_min: 0.4, y_min: 0.2, x_max: 0.6, y_max: 0.8 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    const tiempoBase = 100000;

    const res1 = service.procesarDetecciones([deteccion], tiempoBase);
    afirmarIgual(res1.length, 1, 'La primera detección debe admitirse');

    const res2 = service.procesarDetecciones([deteccion], tiempoBase + 1000);
    afirmarIgual(res2.length, 0, 'La segunda detección debe suprimirse por deduplicación');

    const res3 = service.procesarDetecciones([deteccion], tiempoBase + 5000);
    afirmarIgual(res3.length, 1, 'Tras expirar el cooldown de 4s, debe admitirse nuevamente');
  });

  // 5. Recepción de alerta crítica mientras existen pendientes
  ejecutarCaso('5. Recepción de alerta crítica mientras existen otras pendientes', () => {
    const service = new AlertasService();

    const obstaculoNormal: DeteccionResponse = {
      id_deteccion: 301,
      etiqueta: 'chair',
      etiqueta_es: 'silla',
      confianza: 0.80,
      bbox: { x_min: 0.4, y_min: 0.5, x_max: 0.6, y_max: 0.7 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    service.procesarDetecciones([obstaculoNormal]);
    afirmarIgual(service.obtenerAlertasPendientes().length, 1);

    const vehiculoCritico: DeteccionResponse = {
      id_deteccion: 302,
      etiqueta: 'truck',
      etiqueta_es: 'camión',
      confianza: 0.96,
      bbox: { x_min: 0.3, y_min: 0.2, x_max: 0.7, y_max: 0.8 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    service.procesarDetecciones([vehiculoCritico]);

    const siguiente = service.obtenerSiguienteAlerta();
    afirmar(siguiente !== null, 'Debe haber una siguiente alerta');
    afirmarIgual(siguiente.etiqueta, 'truck', 'El camión crítico debe anteponerse al frente de la cola');
    afirmarIgual(siguiente.nivel, 'CRITICO');

    const posterior = service.obtenerSiguienteAlerta();
    afirmar(posterior !== null, 'Debe quedar la silla');
    afirmarIgual(posterior.etiqueta, 'chair');
  });

  // 6. Manejo de detecciones vacías
  ejecutarCaso('6. Manejo de detecciones vacías o nulas', () => {
    const service = new AlertasService();

    afirmarIgual(service.procesarDetecciones([]).length, 0);
    afirmarIgual(service.procesarDetecciones(null).length, 0);
    afirmarIgual(service.procesarDetecciones(undefined).length, 0);
    afirmarIgual(service.obtenerSiguienteAlerta(), null);
    afirmarIgual(service.obtenerAlertasPendientes().length, 0);
  });

  // 7. Manejo de datos inválidos
  ejecutarCaso('7. Manejo de datos inválidos o corruptos (Fail-safe)', () => {
    const service = new AlertasService();

    const deteccionesInvalidas: any[] = [
      null,
      {},
      { etiqueta: '', confianza: 0.9 },
      { etiqueta: 'car', confianza: -1 },
      { etiqueta: 'car', confianza: NaN },
      { etiqueta: 'car', confianza: 0.1 },
      { etiqueta: 'dog', confianza: 0.85, bbox: { x_min: 'no-numero' } },
    ];

    const admitidas = service.procesarDetecciones(deteccionesInvalidas);

    afirmar(Array.isArray(admitidas), 'Debe retornar un arreglo válido');
    for (const a of admitidas) {
      afirmar(a.confianza >= 0.40, 'Las admitidas deben superar el umbral');
      afirmar(a.etiqueta.length > 0, 'La etiqueta no debe estar vacía');
    }
  });

  // 8. Correcta entrega de alertas al consumidor
  ejecutarCaso('8. Correcta entrega de alertas al consumidor (Oyente / CU18)', () => {
    const service = new AlertasService();
    const alertasRecibidas: AlertaRiesgo[] = [];

    const desuscribir = service.alGenerarAlerta((alerta) => {
      alertasRecibidas.push(alerta);
    });

    const deteccion: DeteccionResponse = {
      id_deteccion: 501,
      etiqueta: 'bicycle',
      etiqueta_es: 'bicicleta',
      confianza: 0.88,
      bbox: { x_min: 0.35, y_min: 0.3, x_max: 0.65, y_max: 0.8 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    service.procesarDetecciones([deteccion]);

    afirmarIgual(alertasRecibidas.length, 1, 'El oyente debe recibir la alerta inmediatamente');
    afirmarIgual(alertasRecibidas[0].etiqueta, 'bicycle');
    afirmar(alertasRecibidas[0].mensaje.includes('bicicleta'), 'El mensaje debe incluir la etiqueta');

    desuscribir();

    service.procesarDetecciones([
      {
        id_deteccion: 502,
        etiqueta: 'dog',
        etiqueta_es: 'perro',
        confianza: 0.85,
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
    ]);

    afirmarIgual(alertasRecibidas.length, 1, 'No debe recibir más alertas tras desuscribirse');
  });

  // 9. Escalamiento crítico sobrepasando cooldown
  ejecutarCaso('9. Escalamiento de alerta crítica sobrepasa cooldown anterior', () => {
    const service = new AlertasService();
    service.configurar({ intervaloDeduplicacionMs: 4000, permitirEscalamientoCritico: true });

    const tiempo = 200000;

    const autoLejano: DeteccionResponse = {
      id_deteccion: 601,
      etiqueta: 'car',
      etiqueta_es: 'auto',
      confianza: 0.85,
      bbox: { x_min: 0.45, y_min: 0.45, x_max: 0.55, y_max: 0.55 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    const res1 = service.procesarDetecciones([autoLejano], tiempo);
    afirmarIgual(res1.length, 1, 'El auto lejano debe admitirse inicialmente');
    afirmarIgual(service.obtenerAlertasPendientes(tiempo).length, 1);

    const autoCercano: DeteccionResponse = {
      id_deteccion: 602,
      etiqueta: 'car',
      etiqueta_es: 'auto',
      confianza: 0.95,
      bbox: { x_min: 0.3, y_min: 0.2, x_max: 0.7, y_max: 0.85 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    const admitidas = service.procesarDetecciones([autoCercano], tiempo + 1000);
    afirmarIgual(admitidas.length, 1, 'El auto crítico debe emitirse aunque el cooldown no haya expirado');
    afirmarIgual(admitidas[0].nivel, 'CRITICO');
  });

  // 10. Caducidad y limpieza de alertas viejas (TTL)
  ejecutarCaso('10. Caducidad de alertas obsoletas en cola (TTL)', () => {
    const service = new AlertasService();
    service.configurar({ tiempoCaducidadAlertaMs: 3000 });

    const deteccion: DeteccionResponse = {
      id_deteccion: 701,
      etiqueta: 'chair',
      etiqueta_es: 'silla',
      confianza: 0.80,
      bbox: { x_min: 0.4, y_min: 0.4, x_max: 0.6, y_max: 0.6 },
      fecha_deteccion: '2026-10-25T12:00:00Z',
    };

    const t0 = 300000;
    service.procesarDetecciones([deteccion], t0);

    afirmarIgual(service.obtenerAlertasPendientes(t0 + 1000).length, 1, 'En t+1s debe seguir vigente');
    afirmarIgual(service.obtenerAlertasPendientes(t0 + 4000).length, 0, 'En t+4s debe haber caducado');
  });

  return resultados;
}

// Si se ejecuta directamente desde Node
const resultados = ejecutarPruebasCU17();
let errores = 0;
console.log('\n══════════════════════════════════════════════════════════════════════');
console.log('  VisionCare AI — Resultados de Pruebas Unitarias CU17: Priorizar Alertas');
console.log('══════════════════════════════════════════════════════════════════════\n');

for (const r of resultados) {
  if (r.paso) {
    console.log(`  [PASÓ]  ${r.nombre}`);
  } else {
    console.error(`  [FALLÓ] ${r.nombre} -> ${r.error}`);
    errores++;
  }
}

console.log(`\nTotal: ${resultados.length} pruebas | Pasaron: ${resultados.length - errores} | Fallaron: ${errores}\n`);

if (errores > 0) {
  process.exit(1);
}
