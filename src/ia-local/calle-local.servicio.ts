/**
 * ══════════════════════════════════════════════════════
 * Motor IA LOCAL (N3-2) — CALLE: personas, vehículos y
 * objetos con distancia aproximada. Sin internet.
 *
 * Motor: COCO-SSD (SSD MobileNet V2) PREENTRENADO
 * (model.json + 5 shards oficiales de tfjs-models, ~18 MB):
 *   - 80 clases COCO → se agrupan en categorías para el TTS:
 *     PERSONA / VEHICULO / ANIMAL / SEÑAL / OBJETO.
 *
 * ⚠️ COMO FUNCIONA ESTE GRAFO REAL (verificado ejecutándolo en
 * Node con tfjs 4.22, scripts/test-model-node.js):
 *   - Entrada: tensor INT32 [1, H, W, 3] píxeles 0-255
 *     (el placeholder es uint8 en TF; tfjs lo expone como
 *     int32. La normalización [-1,1] vive DENTRO del grafo,
 *     Preprocessor/mul + Preprocessor/sub, y redimensiona a
 *     300×300 interno → N de anclas es FIJO).
 *   - Salidas (2, NO 4 — el grafo NO trae NMS ni
 *     num_detections):
 *       salida[0]  scores  [1, 1917, 90]  sigmoid por clase
 *       salida[1]  cajas   [1, 1917, 1, 4] ymin,xmin,ymax,xmax
 *                  normalizado 0..1 (geometría de anclas)
 *     N = 1917 anclas fijo; C = 90 columnas con ids COCO-90
 *     DISPERSOS (huecos en 12,26,29,30,45,66,68,69,71,83).
 *   - El NMS y el argmax de clase se hacen AQUÍ EN JS, igual
 *     que hace el paquete oficial @tensorflow-models/coco-ssd
 *     (infer() en su src/index.ts): executeAsync sin nombres
 *     → dataSync de ambas salidas → tf.dispose → argmax por
 *     ancla → tf.image.nonMaxSuppression(cajas [N,4], puntajes,
 *     maxOutputSize, iou, scoreThreshold) → índices elegidos.
 *   - Clase: id = argmax+1 → CLASES_POR_ID (mapa DISPERSO
 *     1..90, el de la lista oficial). Usar la lista densa de
 *     80 desalinea clases desde el id 13 (13='stop sign' pero
 *     la densa en 12 es 'parking meter').
 *
 * DISTANCIA (geométrica, cámara estenopeana):
 *   distancia ≈ (focal_px × altura_real_m) / alto_del_bbox_px
 *   focal_px ≈ (ancho_px / 2) / tan(FOV_horizontal / 2)
 *   FOV por defecto 65° (cámara trasera típica de Android).
 *   ES APROXIMADA (±30-50%): sirve para priorizar "lo más
 *   cercano" (eso NO necesita calibración — ordena por área
 *   del bbox) y dar un metraje de orientación, no para medir.
 *   Calibración: foto de una persona a distancia conocida y
 *   ajustar FOV (ver README-PASO2B.md).
 *
 * Tamaño de inferencia: cuadrado FIJO 320×320 (mismo shape que
 * el warmup → rn-webgl reusa los kernels; los bboxes son
 * normalizados y el mapeo por eje es lineal, así que siguen
 * válidos sobre la foto ORIGINAL).
 * ══════════════════════════════════════════════════════
 */

import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { toByteArray } from 'base64-js';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

import { prepararTensorflow } from './modelo-local.servicio';

import peso1 from '../../assets/models/calle/group1-shard1of5.bin';
import peso2 from '../../assets/models/calle/group1-shard2of5.bin';
import peso3 from '../../assets/models/calle/group1-shard3of5.bin';
import peso4 from '../../assets/models/calle/group1-shard4of5.bin';
import peso5 from '../../assets/models/calle/group1-shard5of5.bin';
import modeloJsonAsset from '../../assets/models/calle/model.json';

// ─── Tipos públicos ───

export type CategoriaCalle = 'PERSONA' | 'VEHICULO' | 'ANIMAL' | 'SEÑAL' | 'OBJETO';

export interface DeteccionCalle {
  /** Etiqueta en español para el TTS ("Persona", "Bus"…) */
  etiqueta: string;
  /** Clase COCO original en inglés */
  claseCoco: string;
  /** Confianza del detector 0..1 */
  puntaje: number;
  /** Categoría agregada para la UI */
  categoria: CategoriaCalle;
  /** [x, y, ancho, alto] normalizado 0..1 respecto a la foto */
  bboxNormalizado: [number, number, number, number];
  /** Distancia estimada en metros (geométrica, APROXIMADA) */
  distanciaM: number | null;
}

export interface OpcionesCalle {
  /** Confianza mínima (defecto 0.55 — evita falsos avisos al no vidente) */
  puntajeMin?: number;
  /** Máximo de objetos a anunciar (defecto 6) */
  maxDetecciones?: number;
  /** Lado del cuadrado de inferencia (defecto 320 — FIXED, ver header) */
  ladoMax?: number;
  /** FOV horizontal de la cámara en grados (defecto 65) */
  fovGrados?: number;
}

// ─── Clases COCO-90 DISPERSAS (mapa oficial de coco-ssd) ───
// La salida del grafo tiene 90 columnas (tras quitar el fondo):
// argmax j ∈ 0..89 → id COCO = j+1 → nombre por este mapa.
// ⚠️ NO usar una lista densa de 80: los ids 12,26,29,30,45,66,
// 68,69,71,83 NO existen y desalinean el resto.

const CLASES_POR_ID: Record<number, string> = {
  1: 'person', 2: 'bicycle', 3: 'car', 4: 'motorcycle', 5: 'airplane',
  6: 'bus', 7: 'train', 8: 'truck', 9: 'boat', 10: 'traffic light',
  11: 'fire hydrant', 13: 'stop sign', 14: 'parking meter', 15: 'bench',
  16: 'bird', 17: 'cat', 18: 'dog', 19: 'horse', 20: 'sheep', 21: 'cow',
  22: 'elephant', 23: 'bear', 24: 'zebra', 25: 'giraffe', 27: 'backpack',
  28: 'umbrella', 31: 'handbag', 32: 'tie', 33: 'suitcase', 34: 'frisbee',
  35: 'skis', 36: 'snowboard', 37: 'sports ball', 38: 'kite',
  39: 'baseball bat', 40: 'baseball glove', 41: 'skateboard',
  42: 'surfboard', 43: 'tennis racket', 44: 'bottle', 46: 'wine glass',
  47: 'cup', 48: 'fork', 49: 'knife', 50: 'spoon', 51: 'bowl',
  52: 'banana', 53: 'apple', 54: 'sandwich', 55: 'orange', 56: 'broccoli',
  57: 'carrot', 58: 'hot dog', 59: 'pizza', 60: 'donut', 61: 'cake',
  62: 'chair', 63: 'couch', 64: 'potted plant', 65: 'bed',
  67: 'dining table', 70: 'toilet', 72: 'tv', 73: 'laptop', 74: 'mouse',
  75: 'remote', 76: 'keyboard', 77: 'cell phone', 78: 'microwave',
  79: 'oven', 80: 'toaster', 81: 'sink', 82: 'refrigerator', 84: 'book',
  85: 'clock', 86: 'vase', 87: 'scissors', 88: 'teddy bear',
  89: 'hair drier', 90: 'toothbrush',
};

// ─── Etiquetas ES + alturas reales aproximadas (metros) ───
// La altura alimenta la distancia geométrica. Valores de cuerpo
// entero de referencias comunes; el resto usa ALTURA_DEFECTO_M.

interface EtiquetaCalle {
  es: string;
  alturaM: number;
}

const CALLE_ES: Record<string, EtiquetaCalle> = {
  person: { es: 'Persona', alturaM: 1.65 },
  bicycle: { es: 'Bicicleta', alturaM: 1.0 },
  car: { es: 'Auto', alturaM: 1.5 },
  motorcycle: { es: 'Motocicleta', alturaM: 1.1 },
  bus: { es: 'Bus', alturaM: 3.0 },
  train: { es: 'Tren', alturaM: 3.5 },
  truck: { es: 'Camión', alturaM: 3.0 },
  'traffic light': { es: 'Semáforo', alturaM: 0.9 },
  'stop sign': { es: 'Señal de PARE', alturaM: 0.75 },
  'parking meter': { es: 'Parquímetro', alturaM: 1.2 },
  'fire hydrant': { es: 'Hidrante', alturaM: 0.75 },
  bench: { es: 'Banco', alturaM: 0.5 },
  dog: { es: 'Perro', alturaM: 0.5 },
  cat: { es: 'Gato', alturaM: 0.3 },
  bird: { es: 'Ave', alturaM: 0.2 },
  backpack: { es: 'Mochila', alturaM: 0.45 },
  umbrella: { es: 'Paraguas', alturaM: 0.9 },
  handbag: { es: 'Bolso', alturaM: 0.3 },
  suitcase: { es: 'Maleta', alturaM: 0.55 },
  bottle: { es: 'Botella', alturaM: 0.25 },
  cup: { es: 'Vaso', alturaM: 0.1 },
  chair: { es: 'Silla', alturaM: 0.9 },
  couch: { es: 'Sofá', alturaM: 0.8 },
  'potted plant': { es: 'Planta', alturaM: 0.5 },
  'dining table': { es: 'Mesa', alturaM: 0.75 },
  tv: { es: 'Televisor', alturaM: 0.6 },
  'cell phone': { es: 'Celular', alturaM: 0.15 },
  laptop: { es: 'Laptop', alturaM: 0.3 },
  book: { es: 'Libro', alturaM: 0.25 },
  clock: { es: 'Reloj', alturaM: 0.3 },
  vase: { es: 'Florero', alturaM: 0.3 },
  'teddy bear': { es: 'Peluche', alturaM: 0.35 },
};

const ALTURA_DEFECTO_M = 1.0;
const ETIQUETA_DEFECTO = 'Objeto';

const CLASES_VEHICULO = new Set(['bicycle', 'car', 'motorcycle', 'bus', 'train', 'truck']);
const CLASES_ANIMAL = new Set(['bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe']);
const CLASES_SENAL = new Set(['traffic light', 'stop sign', 'parking meter', 'fire hydrant']);

function categoriaDeClase(clase: string): CategoriaCalle {
  if (clase === 'person') return 'PERSONA';
  if (CLASES_VEHICULO.has(clase)) return 'VEHICULO';
  if (CLASES_ANIMAL.has(clase)) return 'ANIMAL';
  if (CLASES_SENAL.has(clase)) return 'SEÑAL';
  return 'OBJETO';
}

function datosDeClase(clase: string): EtiquetaCalle {
  if (Object.prototype.hasOwnProperty.call(CALLE_ES, clase)) {
    return CALLE_ES[clase];
  }
  return { es: ETIQUETA_DEFECTO, alturaM: ALTURA_DEFECTO_M };
}

// ─── Estado del motor ───

interface ModeloJsonCalle {
  modelTopology: unknown;
  weightsManifest: Array<{
    paths: string[];
    weights: Array<{ name: string; shape: number[]; dtype: string }>;
  }>;
}

let promesaModeloCalle: Promise<tf.GraphModel> | null = null;

/** Info del motor para banners/estado de la UI */
export function resumenModeloCalle(): {
  nombre: string;
  motor: string;
  clasesCoco: number;
  pesosMb: number;
} {
  return {
    nombre: 'calle-v1',
    motor: 'COCO-SSD (SSD MobileNet V2 preentrenado, NMS en JS)',
    clasesCoco: Object.keys(CLASES_POR_ID).length,
    pesosMb: 18.0,
  };
}

// ─── IOHandler propio (mismo patrón que el servicio v2) ───

async function bytesDeAsset(assetId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(assetId);

  if (!asset.localUri) {
    await asset.downloadAsync();
  }

  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error('Asset de pesos de calle sin URI (¿"bin" en assetExts?)');
  }

  if (uri.startsWith('http')) {
    const respuesta = await fetch(uri);
    if (!respuesta.ok) {
      throw new Error(`Fetch de shard de calle falló: HTTP ${respuesta.status}`);
    }
    return new Uint8Array(await respuesta.arrayBuffer());
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return toByteArray(base64);
}

function crearHandlerCalle(
  modeloJson: ModeloJsonCalle,
  pesosIds: number[],
): tf.io.IOHandler {
  return {
    load: async () => {
      const buffers = await Promise.all(pesosIds.map(bytesDeAsset));
      const total = buffers.reduce((n, b) => n + b.byteLength, 0);
      const pesos = new Uint8Array(total);
      let offset = 0;
      for (const b of buffers) {
        pesos.set(b, offset);
        offset += b.byteLength;
      }
      return {
        modelTopology: modeloJson.modelTopology,
        weightSpecs: modeloJson.weightsManifest.flatMap((g) => g.weights),
        weightData: pesos.buffer,
      } as tf.io.ModelArtifacts;
    },
  };
}

// ─── Carga del grafo (singleton con warmup) ───

export async function cargarModeloCalle(): Promise<tf.GraphModel> {
  await prepararTensorflow();

  if (!promesaModeloCalle) {
    promesaModeloCalle = (async () => {
      const modeloJson = modeloJsonAsset as unknown as ModeloJsonCalle;

      const nPesos = modeloJson.weightsManifest.flatMap((g) => g.weights).length;
      console.log('[IA calle] weightSpecs count:', nPesos);

      const modelo = await tf.loadGraphModel(
        crearHandlerCalle(modeloJson, [peso1, peso2, peso3, peso4, peso5]),
      );

      // Warmup EN EL MISMO TAMAÑO FIJO que la inferencia real, dtype
      // INT32 y con executeAsync (ops dinámicas 'Exit' en el grafo).
      try {
        const prueba = tf.zeros([1, 320, 320, 3], 'int32');
        const salidas = await modelo.executeAsync(prueba);
        const lista = Array.isArray(salidas) ? salidas : [salidas];
        for (const t of lista as tf.Tensor[]) {
          t.dataSync(); // fuerza la ejecución completa del grafo
          t.dispose();
        }
        prueba.dispose();
      } catch (e) {
        console.warn('[IA calle] Warmup falló (no crítico):', e);
      }

      return modelo;
    })();
  }

  return promesaModeloCalle;
}

// ─── Post-proceso en JS (el grafo NO trae NMS) ───

interface AnclasMaximas {
  puntajes: number[]; // score máximo por ancla
  ids: number[]; // argmax 0..89 → id COCO = valor+1
  maxGlobal: number; // mayor score de toda la foto (diagnóstico)
}

/**
 * Igual que calculateMaxScores() del paquete oficial coco-ssd:
 * por cada ancla toma el máximo de sus C columnas de clase.
 */
function maximoPorAncla(
  datosScores: Float32Array,
  numAnclas: number,
  numClases: number,
): AnclasMaximas {
  const puntajes = new Array<number>(numAnclas);
  const ids = new Array<number>(numAnclas);
  let maxGlobal = 0;
  for (let i = 0; i < numAnclas; i += 1) {
    let mejor = -1;
    let idMejor = 0;
    const base = i * numClases;
    for (let j = 0; j < numClases; j += 1) {
      const v = datosScores[base + j];
      if (v > mejor) {
        mejor = v;
        idMejor = j;
      }
    }
    puntajes[i] = mejor;
    ids[i] = idMejor;
    if (mejor > maxGlobal) maxGlobal = mejor;
  }
  return { puntajes, ids, maxGlobal };
}

// ─── Distancia geométrica (estenopeana) ───

/**
 * distancia ≈ (focal_px × altura_real_m) / alto_del_bbox_px
 * con focal_px = (ancho_px / 2) / tan(FOV_horizontal / 2).
 * APROXIMADA (±30-50%): para priorizar cercanía y orientar,
 * no para medir con precisión.
 */
export function distanciaAproximada(
  bboxNormalizado: [number, number, number, number],
  alturaRealM: number,
  anchoPx: number,
  altoPx: number,
  fovGrados = 65,
): number | null {
  const altoObjetoPx = bboxNormalizado[3] * altoPx;
  if (altoObjetoPx <= 1 || anchoPx <= 0 || altoPx <= 0) {
    return null;
  }
  const focalPx = anchoPx / 2 / Math.tan((fovGrados * Math.PI) / 360);
  return (focalPx * alturaRealM) / altoObjetoPx;
}

// ─── Inferencia sobre una foto ───

/**
 * Analiza una foto (uri local de la cámara) con el detector
 * embebido. Funciona SIN internet — respaldo N3-2 de calle.
 * Pipeline = el del paquete oficial coco-ssd:
 *   executeAsync → dataSync de scores y cajas → argmax por
 *   ancla → nonMaxSuppression en JS → detecciones.
 * Devuelve las detecciones ordenadas por cercanía estimada
 * (la más próxima primero).
 */
export async function detectarCalle(
  uri: string,
  opciones: OpcionesCalle = {},
): Promise<DeteccionCalle[]> {
  const inicio = Date.now();
  const puntajeMin = opciones.puntajeMin ?? 0.55;
  const maxDetecciones = opciones.maxDetecciones ?? 6;
  const lado = opciones.ladoMax ?? 320; // cuadrado FIJO (ver header)
  const fovGrados = opciones.fovGrados ?? 65;

  const modelo = await cargarModeloCalle();

  // 1) Leer la foto y decodificar (píxeles 0-255 — el grafo
  //    normaliza por dentro; NO reescalar los valores).
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = toByteArray(base64);

  // Decode + tensor de entrada dentro de tidy; se DEVUELVE `entrada`
  // para que sobreviva al tidy (decodeJpeg + resize crean tensores
  // intermedios que tf libera al salir del tidy).
  const { entrada, altoPx, anchoPx } = tf.tidy(() => {
    const imagen = decodeJpeg(
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes
        : new Uint8Array(bytes),
      3,
    );

    // Cuadrado FIJO: mismo shape que el warmup → rn-webgl reusa
    // los kernels ya compilados. Resize en float y cast a int32
    // JUSTO antes de ejecutar (el grafo exige image_tensor int32;
    // píxeles 0-255, la normalización vive por dentro).
    const entradaCast = tf.cast(
      tf.image.resizeBilinear(imagen.toFloat(), [lado, lado]).expandDims(0),
      'int32',
    );
    return {
      entrada: entradaCast,
      altoPx: imagen.shape[0] ?? 0,
      anchoPx: imagen.shape[1] ?? 0,
    };
  });

  // 2) Forward — 2 salidas: scores [1,1917,90] y cajas [1,1917,1,4].
  //    Se identifican por última dimensión (4 → cajas) por si el
  //    orden del array cambia entre versiones de tfjs.
  const salidas = await modelo.executeAsync(entrada);
  const listaSalidas = Array.isArray(salidas) ? salidas : [salidas];
  entrada.dispose();

  let cajasT: tf.Tensor | undefined;
  let scoresT: tf.Tensor | undefined;
  for (const s of listaSalidas as tf.Tensor[]) {
    const forma = s.shape as number[];
    if (forma.length >= 2 && forma[forma.length - 1] === 4) {
      cajasT = s;
    } else {
      scoresT = s;
    }
  }

  if (!cajasT || !scoresT) {
    listaSalidas.forEach((t) => (t as tf.Tensor).dispose());
    throw new Error(
      `Salidas del grafo de calle inesperadas: ${listaSalidas
        .map((t) => JSON.stringify((t as tf.Tensor).shape))
        .join(', ')}`,
    );
  }

  // 3) Leer a arrays JS y liberar la GPU (igual que el paquete
  //    oficial: dataSync → tf.dispose(result)).
  const datosScores = scoresT.dataSync() as Float32Array;
  const datosCajas = cajasT.dataSync() as Float32Array;
  const formaScores = scoresT.shape as number[];
  const numAnclas = formaScores[1] ?? 0;
  const numClases = formaScores[2] ?? 0;
  listaSalidas.forEach((t) => (t as tf.Tensor).dispose());

  if (numAnclas === 0 || numClases === 0) {
    return [];
  }

  // 4) Argmax por ancla (calculateMaxScores del paquete oficial).
  const { puntajes: puntajesAncla, ids: idsAncla, maxGlobal } =
    maximoPorAncla(datosScores, numAnclas, numClases);

  // 5) NMS en JS. tf.image.nonMaxSuppression es un op de CPU puro:
  //    corre igual aunque el backend sea rn-webgl (así lo hace el
  //    paquete oficial). iou 0.5 (estándar); scoreThreshold = puntajeMin.
  const indices = tf.tidy(() => {
    const cajas2 = tf.tensor2d(Array.from(datosCajas), [numAnclas, 4]);
    const sel = tf.image.nonMaxSuppression(
      cajas2,
      tf.tensor1d(puntajesAncla, 'float32'),
      maxDetecciones,
      0.5,
      puntajeMin,
    ) as tf.Tensor1D;
    return Array.from(sel.dataSync() as Int32Array);
  });

  // 6) Construir detecciones (solo arrays JS). id COCO = argmax+1
  //    → mapa DISPERSO → nombre EN → etiqueta ES + altura.
  const detecciones: DeteccionCalle[] = [];
  for (const idx of indices) {
    const idCoco = (idsAncla[idx] ?? 0) + 1;
    const clase = CLASES_POR_ID[idCoco];
    if (!clase) continue; // hueco COCO-90 que ganó un argmax (raro)

    const y0 = datosCajas[idx * 4] ?? 0;
    const x0 = datosCajas[idx * 4 + 1] ?? 0;
    const y1 = datosCajas[idx * 4 + 2] ?? 0;
    const x1 = datosCajas[idx * 4 + 3] ?? 0;
    const bbox: [number, number, number, number] = [
      Math.max(0, x0),
      Math.max(0, y0),
      Math.max(0, x1 - x0),
      Math.max(0, y1 - y0),
    ];

    const datos = datosDeClase(clase);
    detecciones.push({
      etiqueta: datos.es,
      claseCoco: clase,
      puntaje: puntajesAncla[idx] ?? 0,
      categoria: categoriaDeClase(clase),
      bboxNormalizado: bbox,
      distanciaM: distanciaAproximada(
        bbox,
        datos.alturaM,
        anchoPx,
        altoPx,
        fovGrados,
      ),
    });
  }

  // 7) Prioridad: lo más CERCANO primero (menor distancia);
  //    sin distancia, área mayor del bbox = más cerca.
  detecciones.sort((a, b) => {
    const da = a.distanciaM ?? Infinity;
    const db = b.distanciaM ?? Infinity;
    if (Number.isFinite(da) && Number.isFinite(db)) {
      return da - db;
    }
    const areaA = a.bboxNormalizado[2] * a.bboxNormalizado[3];
    const areaB = b.bboxNormalizado[2] * b.bboxNormalizado[3];
    return areaB - areaA;
  });

  const finales = detecciones.slice(0, maxDetecciones);
  console.log(
    `[IA calle] ${Date.now() - inicio} ms · backend ${tf.getBackend()} · ` +
      `anclas ${numAnclas}x${numClases} · maxScore ${maxGlobal.toFixed(2)} · ` +
      `${finales.length} detecciones ${finales.map((d) => d.etiqueta).join(',')}`,
  );
  return finales;
}

// ─── Anuncio para el TTS ───

/**
 * Texto para expo-speech: los objetos más CERCANOS primero.
 * Ej: "Persona a unos 2 metros. Bus a unos 8 metros."
 * La proximidad pura NO requiere calibración (área del bbox);
 * el metraje sí depende del FOV configurado.
 */
export function construirAnuncioCalle(
  detecciones: DeteccionCalle[],
  maxAnuncios = 3,
): string {
  const partes = detecciones.slice(0, maxAnuncios).map((d) => {
    const dist = d.distanciaM;
    if (dist !== null && dist > 0.5) {
      const metros = dist < 5 ? Math.round(dist) : Math.round(dist / 5) * 5;
      const texto =
        dist < 5 ? `a unos ${metros} metros` : `a unos ${metros} metros`;
      return `${d.etiqueta} ${texto}`;
    }
    if (dist !== null && dist <= 0.5) {
      return `${d.etiqueta} muy cerca`;
    }
    return d.etiqueta;
  });

  if (partes.length === 0) {
    return 'No veo nada familiar cerca';
  }
  return `${partes.join('. ')}.`;
}