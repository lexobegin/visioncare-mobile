/**
 * ══════════════════════════════════════════════════════════════════════
 * VisionCare AI — Suite de Pruebas Unitarias CU18: Emitir Alertas por Voz
 *
 * Casos de prueba obligatorios requeridos:
 *   1. Una alerta válida se envía al motor TTS.
 *   2. Una alerta alta tiene prioridad sobre una baja.
 *   3. Una alerta crítica puede interrumpir un mensaje de menor importancia.
 *   4. Una alerta baja no interrumpe una alerta crítica.
 *   5. Las alertas no se reproducen simultáneamente.
 *   6. La reproducción respeta alertas_sonoras (CU03).
 *   7. La reproducción respeta voz_habilitada (CU03).
 *   8. El volumen configurado se aplica correctamente (CU03).
 *   9. La velocidad de lectura configurada se aplica correctamente (CU03).
 *   10. Las alertas obsoletas no se reproducen (TTL).
 *   11. No existen mensajes duplicados por la integración con la cámara.
 *   12. Los mecanismos existentes de voz continúan funcionando.
 * ══════════════════════════════════════════════════════════════════════
 */

import { AlertasService } from '../src/services/alertas.service';
import { TTSService, MotorSpeech } from '../src/services/tts.service';
import { AlertasVozService } from '../src/services/alertasVoz.service';
import type { AlertaRiesgo } from '../src/types/alerta';

// ─── Simulador de Motor TTS para ejecución en Node.js ───

interface LlamadaSpeak {
  texto: string;
  opciones?: {
    language?: string;
    rate?: number;
    volume?: number;
    pitch?: number;
    onDone?: () => void;
    onStopped?: () => void;
    onError?: (error: any) => void;
  };
}

class MotorSpeechSimulado implements MotorSpeech {
  public llamadas: LlamadaSpeak[] = [];
  public vecesDetenido: number = 0;
  public hablando: boolean = false;
  public autoCompletar: boolean = true;

  constructor(autoCompletar: boolean = true) {
    this.autoCompletar = autoCompletar;
  }

  speak(text: string, options?: any): void {
    this.hablando = true;
    const item: LlamadaSpeak = { texto: text, opciones: options };
    this.llamadas.push(item);

    if (this.autoCompletar) {
      this.hablando = false;
      options?.onDone?.();
    }
  }

  async stop(): Promise<void> {
    this.vecesDetenido++;
    this.hablando = false;
  }

  async isSpeakingAsync(): Promise<boolean> {
    return this.hablando;
  }

  simularFinLocucion(): void {
    if (this.llamadas.length > 0) {
      this.hablando = false;
      const actual = this.llamadas[this.llamadas.length - 1];
      actual.opciones?.onDone?.();
    }
  }
}

// ─── Utilidades de Aserción y Sincronía ───

const esperarTicks = (ms: number = 20) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function afirmar(condicion: boolean, mensaje: string): void {
  if (!condicion) {
    throw new Error(`[FALLO]: ${mensaje}`);
  }
}

function afirmarIgual<T>(obtenido: T, esperado: T, contexto: string = ''): void {
  if (obtenido !== esperado) {
    throw new Error(
      `[FALLO]: Valores no coinciden. Esperado: ${esperado}, Obtenido: ${obtenido} ${
        contexto ? `(${contexto})` : ''
      }`,
    );
  }
}

function fabricarAlerta(
  id: string,
  etiqueta: string,
  nivel: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO' | 'INFO',
  prioridad: number,
  timestamp: number = Date.now(),
  ttlMs: number = 10000,
): AlertaRiesgo {
  return {
    id,
    etiqueta,
    etiquetaEs: etiqueta,
    nivel,
    prioridad,
    mensaje: `¡Atención! ${etiqueta} detectado.`,
    areaRelativa: 0.15,
    posicion: 'FRENTE',
    proximidad: 'CERCA',
    confianza: 0.9,
    timestamp,
    ttlMs,
  };
}

// ─── Ejecución de Casos de Prueba ───

export async function ejecutarPruebasCU18(): Promise<
  { nombre: string; paso: boolean; error?: string }[]
> {
  const resultados: { nombre: string; paso: boolean; error?: string }[] = [];

  async function ejecutarCaso(nombre: string, fn: () => Promise<void>) {
    try {
      await fn();
      resultados.push({ nombre, paso: true });
    } catch (e: any) {
      resultados.push({ nombre, paso: false, error: e?.message ?? String(e) });
    }
  }

  // 1. Una alerta válida se envía al motor TTS
  await ejecutarCaso('1. Una alerta válida se envía al motor TTS', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    despachador.iniciar();

    alertas.procesarDetecciones([
      {
        id_deteccion: 1,
        etiqueta: 'stairs',
        etiqueta_es: 'escalera',
        confianza: 0.92,
        bbox: { x_min: 0.4, y_min: 0.3, x_max: 0.6, y_max: 0.7 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
    ]);

    await esperarTicks();
    afirmar(motor.llamadas.length >= 1, 'El motor debe haber recibido la llamada de locución');
    afirmar(
      motor.llamadas[0].texto.includes('escalera'),
      'El texto hablado debe corresponder a la alerta emitida',
    );
    despachador.detener();
  });

  // 2. Una alerta alta tiene prioridad sobre una baja
  await ejecutarCaso('2. Una alerta alta tiene prioridad sobre una baja', async () => {
    const motor = new MotorSpeechSimulado(false); // manual
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    despachador.iniciar();
    alertas.procesarDetecciones([
      {
        id_deteccion: 10,
        etiqueta: 'chair',
        etiqueta_es: 'silla',
        confianza: 0.8,
        bbox: { x_min: 0.1, y_min: 0.1, x_max: 0.2, y_max: 0.2 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
      {
        id_deteccion: 11,
        etiqueta: 'car',
        etiqueta_es: 'auto',
        confianza: 0.95,
        bbox: { x_min: 0.3, y_min: 0.2, x_max: 0.7, y_max: 0.8 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
    ]);

    await esperarTicks();
    afirmarIgual(motor.llamadas.length, 1, 'Debe haber emitido la primera alerta');
    afirmar(
      motor.llamadas[0].texto.includes('auto'),
      'La alerta de auto (ALTO/CRITICO) debe hablarse antes que la silla (BAJO)',
    );
    despachador.detener();
  });

  // 3. Una alerta crítica puede interrumpir un mensaje de menor importancia
  await ejecutarCaso('3. Una alerta crítica puede interrumpir un mensaje de menor importancia', async () => {
    const motor = new MotorSpeechSimulado(false);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    despachador.iniciar();

    // 1. Mensaje de menor importancia (anuncio normal, prioridad 1)
    void tts.anunciar('Mensaje informativo largo de navegación...', { prioridad: 1 });
    await esperarTicks();

    afirmarIgual(motor.llamadas.length, 1);
    afirmarIgual(tts.obtenerPrioridadEnCurso(), 1);

    // 2. Llega alerta CRITICA (prioridad 5)
    const alertaCritica = fabricarAlerta('c1', 'camión', 'CRITICO', 5);
    despachador.alRecibirAlerta(alertaCritica);
    await esperarTicks();

    afirmar(motor.vecesDetenido >= 1, 'El mensaje menor debe haber sido detenido');
    afirmarIgual(motor.llamadas.length, 2, 'Debe haber emitido el mensaje crítico');
    afirmar(motor.llamadas[1].texto.includes('camión'), 'El segundo mensaje debe ser la alerta crítica');
    despachador.detener();
  });

  // 4. Una alerta baja no interrumpe una alerta crítica
  await ejecutarCaso('4. Una alerta baja no interrumpe una alerta crítica', async () => {
    const motor = new MotorSpeechSimulado(false);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    despachador.iniciar();

    // Emitir alerta crítica
    const alertaCritica = fabricarAlerta('c1', 'camión', 'CRITICO', 5);
    despachador.alRecibirAlerta(alertaCritica);
    await esperarTicks();

    afirmarIgual(motor.llamadas.length, 1);
    afirmar(
      motor.llamadas[0].texto.includes('camión'),
      'El mensaje debe contener camión',
    );

    const paradasPrevias = motor.vecesDetenido;

    // Llega alerta baja mientras la crítica sigue hablando
    const alertaBaja = fabricarAlerta('b1', 'banco', 'BAJO', 2);
    despachador.alRecibirAlerta(alertaBaja);
    await esperarTicks();

    afirmarIgual(
      motor.vecesDetenido,
      paradasPrevias,
      'No se debe invocar stop() en el motor ante una alerta baja',
    );
    afirmarIgual(motor.llamadas.length, 1, 'No debe hablarse simultáneamente');
    despachador.detener();
  });

  // 5. Las alertas no se reproducen simultáneamente
  await ejecutarCaso('5. Las alertas no se reproducen simultáneamente (Canal único y secuencial)', async () => {
    const motor = new MotorSpeechSimulado(false);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    despachador.iniciar();

    alertas.procesarDetecciones([
      {
        id_deteccion: 51,
        etiqueta: 'person',
        etiqueta_es: 'persona',
        confianza: 0.9,
        bbox: { x_min: 0.4, y_min: 0.4, x_max: 0.6, y_max: 0.6 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
      {
        id_deteccion: 52,
        etiqueta: 'dog',
        etiqueta_es: 'perro',
        confianza: 0.88,
        bbox: { x_min: 0.4, y_min: 0.5, x_max: 0.6, y_max: 0.7 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
    ]);

    await esperarTicks();
    afirmarIgual(motor.llamadas.length, 1, 'Solo debe emitirse una alerta inicialmente');
    afirmar(despachador.estaReproduciendo(), 'El despachador debe marcar estado reproduciendo');

    // Al terminar la primera, se despacha la segunda
    motor.simularFinLocucion();
    await esperarTicks();
    afirmarIgual(motor.llamadas.length, 2, 'Al terminar la primera, debe despacharse la segunda en cola');
    despachador.detener();
  });

  // 6. La reproducción respeta alertas_sonoras
  await ejecutarCaso('6. La reproducción respeta alertas_sonoras (CU03)', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    tts.configurar({ alertasSonoras: false, habilitada: true });
    despachador.iniciar();

    const alerta = fabricarAlerta('6', 'auto', 'CRITICO', 5);
    despachador.alRecibirAlerta(alerta);
    await esperarTicks();

    afirmarIgual(motor.llamadas.length, 0, 'No debe hablar nada si alertas_sonoras está apagada');
    afirmarIgual(despachador.estaReproduciendo(), false);
    despachador.detener();
  });

  // 7. La reproducción respeta voz_habilitada
  await ejecutarCaso('7. La reproducción respeta voz_habilitada (CU03)', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    tts.configurar({ habilitada: false, alertasSonoras: true });
    despachador.iniciar();

    const alerta = fabricarAlerta('7', 'escalera', 'CRITICO', 5);
    despachador.alRecibirAlerta(alerta);
    await esperarTicks();

    afirmarIgual(motor.llamadas.length, 0, 'No debe hablar si voz_habilitada está apagada');
    despachador.detener();
  });

  // 8. El volumen configurado se aplica correctamente
  await ejecutarCaso('8. El volumen configurado se aplica correctamente (CU03)', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    tts.configurar({ volumen: 60, velocidad: 1.0, habilitada: true, alertasSonoras: true });
    despachador.iniciar();

    const alerta = fabricarAlerta('8', 'poste', 'MEDIO', 3);
    despachador.alRecibirAlerta(alerta);
    await esperarTicks();

    afirmarIgual(motor.llamadas.length, 1);
    afirmarIgual(motor.llamadas[0].opciones?.volume, 0.6, 'El volumen de speech debe ser 0.6');
    despachador.detener();
  });

  // 9. La velocidad de lectura configurada se aplica correctamente
  await ejecutarCaso('9. La velocidad de lectura configurada se aplica correctamente (CU03)', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    tts.configurar({ velocidad: 1.5, habilitada: true, alertasSonoras: true });
    despachador.iniciar();

    const alerta = fabricarAlerta('9', 'poste', 'MEDIO', 3);
    despachador.alRecibirAlerta(alerta);
    await esperarTicks();

    afirmarIgual(motor.llamadas.length, 1);
    afirmarIgual(motor.llamadas[0].opciones?.rate, 1.5, 'La tasa de speech debe ser 1.5');
    despachador.detener();
  });

  // 10. Las alertas obsoletas no se reproducen (TTL)
  await ejecutarCaso('10. Las alertas obsoletas no se reproducen (TTL)', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    const ahora = 500000;
    const alertaObsoleta = fabricarAlerta('10', 'silla', 'MEDIO', 3, ahora - 15000, 10000);

    despachador.iniciar();
    (alertas as any).colaPrioritaria = [alertaObsoleta];

    despachador.despacharSiguiente(ahora);
    await esperarTicks();

    afirmarIgual(motor.llamadas.length, 0, 'La alerta obsoleta debe descartarse sin reproducirse');
    despachador.detener();
  });

  // 11. No existen mensajes duplicados por la integración con la cámara
  await ejecutarCaso('11. No existen mensajes duplicados por la integración con la cámara', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);
    const alertas = new AlertasService();
    const despachador = new AlertasVozService(alertas, tts);

    despachador.iniciar();

    const detecciones = [
      {
        id_deteccion: 110,
        etiqueta: 'car',
        etiqueta_es: 'auto',
        confianza: 0.95,
        bbox: { x_min: 0.3, y_min: 0.2, x_max: 0.7, y_max: 0.8 },
        fecha_deteccion: '2026-10-25T12:00:00Z',
      },
    ];

    const alertasGeneradas = alertas.procesarDetecciones(detecciones);
    const hayRiesgoElevado = alertasGeneradas.some((a) => a.prioridad >= 4);

    if (!hayRiesgoElevado) {
      void tts.anunciar('Se observa una calle con vehículos.', { forzar: true });
    }

    await esperarTicks();

    afirmarIgual(
      motor.llamadas.length,
      1,
      'Solo debe emitirse la alerta priorizada de riesgo sin duplicar ni pisarse con el resumen',
    );
    afirmar(
      motor.llamadas[0].texto.includes('auto'),
      'El mensaje debe contener auto',
    );
    despachador.detener();
  });

  // 12. Los mecanismos existentes de voz continúan funcionando
  await ejecutarCaso('12. Los mecanismos existentes de voz continúan funcionando (CU06 / Bienvenida / Perfil)', async () => {
    const motor = new MotorSpeechSimulado(true);
    const tts = new TTSService(motor);

    await tts.anunciar('Bienvenido a VisionCare AI.');
    afirmarIgual(motor.llamadas.length, 1);
    afirmarIgual(motor.llamadas[0].texto, 'Bienvenido a VisionCare AI.');

    tts.configurar({ habilitada: false });
    await tts.anunciar('Mensaje de emergencia forzado.', { forzar: true });
    afirmarIgual(motor.llamadas.length, 2);
    afirmarIgual(motor.llamadas[1].texto, 'Mensaje de emergencia forzado.');
  });

  return resultados;
}

// ─── Ejecución directa desde CLI / TSX ───
(async () => {
  const resultados = await ejecutarPruebasCU18();
  let errores = 0;

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log('  VisionCare AI — Resultados de Pruebas Unitarias CU18: Emitir Alertas por Voz');
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
})();
