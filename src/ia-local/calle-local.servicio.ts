/**
 * ══════════════════════════════════════════════════════
 * Motor IA LOCAL (N3-2) — CALLE: personas, vehículos y
 * objetos con distancia aproximada. Sin internet.
 *
 * Motor: COCO-SSD (SSDLite MobileNet V2) PREENTRENADO
 * (no se entrena desde cero — ver README-PASO2B.md):
 *   - 80 clases COCO → se agrupan en categorías para el TTS:
 *     PERSONA / VEHICULO / ANIMAL / SEÑAL / OBJETO.
 *   - Entrada: foto JPEG completa [1, H, W, 3] con píxeles
 *     0-255 (la normalización vive DENTRO del grafo).
 *   - Salida (4 tensores, N=100 candidatos):
 *       detection_boxes   [1,N,4]  (ymin,xmin,ymax,xmax normalizado)
 *       detection_classes [1,N]    (ids 1..80)
 *       detection_scores  [1,N]    (0..1)
 *       num_detections    [1]
 *     El orden del array que devuelve tf es el alfabético de los
 *     nodos; se identifican por FORMA + contenido (enteros vs no).
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
 * Pesos empaquetados en assets/models/calle/ (model.json +
 * group1-shard{1..5}of5.bin, ~18 MB) con el mismo IOHandler
 * propio del servicio v2 (expo-asset + expo-file-system/legacy).
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
  /** Lado máximo de la foto para inferir (defecto 480 — velocidad) */
  ladoMax?: number;
  /** FOV horizontal de la cámara en grados (defecto 65) */
  fovGrados?: number;
}

// ─── Clases COCO (orden canónico de la salida del grafo, 1-indexado) ───

const CLASES_COCO: readonly string[] = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train',
  'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign',
  'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag',
  'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball', 'kite',
  'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon',
  'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot',
  'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant',
  'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote',
  'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush',
];

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
    motor: 'COCO-SSD (SSDLite MobileNet V2, preentrenado)',
    clasesCoco: CLASES_COCO.length,
    pesosMb: 17.2,
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

      // Warmup con un tamaño intermedio (la entrada del grafo es variable)
      try {
        tf.tidy(() => {
          const salida = modelo.predict(tf.zeros([1, 320, 320, 3])) as tf.Tensor;
          salida.dataSync();
        });
      } catch (e) {
        console.warn('[IA calle] Warmup falló (no crítico):', e);
      }

      return modelo;
    })();
  }

  return promesaModeloCalle;
}

// ─── Separación de las 4 salidas del grafo ───

interface SalidasCalle {
  cajas: number[]; // [N,4] → ymin,xmin,ymax,xmax normalizado
  puntajes: number[]; // [N]
  clases: number[]; // [N] ids 1..80
  num: number;
}

/**
 * Identifica los 4 tensores de salida por FORMA (y contenido como
 * desempate): cajas = último dim 4; num = 1 dim; clases vs puntajes
 * = los ids de clase son enteros en [1,80]. El orden alfabético del
 * grafo (boxes, classes, scores, num) queda como respaldo.
 */
function separarSalidasCalle(salidas: tf.Tensor[]): SalidasCalle | null {
  const aPlano = (t: tf.Tensor): number[] =>
    Array.from(t.dataSync() as Float32Array);

  let cajasT: tf.Tensor | undefined;
  let numT: tf.Tensor | undefined;
  const pares: tf.Tensor[] = [];

  for (const s of salidas) {
    const forma = s.shape as number[];
    if (forma.length >= 2 && forma[forma.length - 1] === 4) {
      cajasT = s;
    } else if (forma.length === 1) {
      numT = s;
    } else {
      pares.push(s);
    }
  }

  if (!cajasT || !numT || pares.length < 2) {
    return null;
  }

  const esEnteros = (vals: number[]): boolean =>
    vals.length > 0 &&
    vals.every(
      (v) => v >= 1 && v <= 80 && Math.abs(v - Math.round(v)) < 1e-4,
    );

  const va = aPlano(pares[0]);
  const vb = aPlano(pares[1]);
  const intA = esEnteros(va);
  const intB = esEnteros(vb);

  let clasesArr: number[];
  let puntajesArr: number[];
  if (intA && !intB) {
    clasesArr = va;
    puntajesArr = vb;
  } else if (intB && !intA) {
    clasesArr = vb;
    puntajesArr = va;
  } else {
    // Respaldo: orden alfabético del grafo → classes antes que scores
    clasesArr = va;
    puntajesArr = vb;
  }

  return {
    cajas: aPlano(cajasT),
    puntajes: puntajesArr,
    clases: clasesArr,
    num: aPlano(numT)[0] ?? 0,
  };
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
  const ladoMax = opciones.ladoMax ?? 480;
  const fovGrados = opciones.fovGrados ?? 65;

  const modelo = await cargarModeloCalle();
  const backend = tf.getBackend();

  // 1) Leer la foto y decodificar (píxeles 0-255 — el grafo
  //    normaliza por dentro; NO reescalar los valores).
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = toByteArray(base64);

  const resultado = tf.tidy(() => {
    const imagen = decodeJpeg(
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes
        : new Uint8Array(bytes),
      3,
    );
    const altoPx = imagen.shape[0] ?? 0;
    const anchoPx = imagen.shape[1] ?? 0;

    // Reescalar a un lado máx. para velocidad (los bboxes son
    // normalizados: la escala de inferencia no afecta el cálculo)
    const escala = Math.min(1, ladoMax / Math.max(altoPx, anchoPx, 1));
    const altoInf = Math.max(1, Math.round(altoPx * escala));
    const anchoInf = Math.max(1, Math.round(anchoPx * escala));
    const entrada =
      escala < 1
        ? tf.image
            .resizeBilinear(imagen.toFloat(), [altoInf, anchoInf])
            .expandDims(0)
        : imagen.toFloat().expandDims(0);

    const salidas = modelo.execute(entrada) as tf.Tensor[];
    const sep = separarSalidasCalle(salidas);
    const vacio = { cajas: [] as number[], puntajes: [] as number[], clases: [] as number[], num: 0 };
    return {
      ...(sep ?? vacio),
      altoPx,
      anchoPx,
    };
  });

  // 2) Construir detecciones (fuera de tidy: solo arrays JS)
  const detecciones: DeteccionCalle[] = [];
  const n = Math.min(
    Math.round(resultado.num),
    resultado.puntajes.length,
    resultado.clases.length,
  );

  for (let i = 0; i < n; i += 1) {
    const puntaje = resultado.puntajes[i] ?? 0;
    if (puntaje < puntajeMin) continue;

    const id = Math.round(resultado.clases[i] ?? 0);
    const clase = CLASES_COCO[Math.max(1, Math.min(80, id)) - 1] ?? 'person';

    const y0 = resultado.cajas[i * 4] ?? 0;
    const x0 = resultado.cajas[i * 4 + 1] ?? 0;
    const y1 = resultado.cajas[i * 4 + 2] ?? 0;
    const x1 = resultado.cajas[i * 4 + 3] ?? 0;
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
      puntaje,
      categoria: categoriaDeClase(clase),
      bboxNormalizado: bbox,
      distanciaM: distanciaAproximada(
        bbox,
        datos.alturaM,
        resultado.anchoPx,
        resultado.altoPx,
        fovGrados,
      ),
    });
  }

  // 3) Prioridad: lo más CERCANO primero (menor distancia);
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
  void backend;
  void inicio; // (latencia disponible para UI si se necesita)
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
