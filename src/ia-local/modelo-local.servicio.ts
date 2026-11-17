/**
 * ══════════════════════════════════════════════════════
 * Motor IA LOCAL (N3) — TensorFlow.js embebido en la app.
 * v2 (paso 2): PERFIL de modelo + inferencia genérica
 * (sigmoid binario o softmax de N clases).
 *
 * Modelo actual `ecoscan-v1` (entrenado en Colab):
 *   - Entrada  [1, 100, 100, 3] RGB con píxeles 0-255
 *     (la normalización 1/255 va DENTRO del modelo).
 *   - Salida   1 neurona sigmoid → prob de RECICLABLE.
 *
 * Para el modelo del notebook visioncare_v1 (billetes/
 * productos, softmax de N clases): entrena, descarga el zip
 * a assets/models/visioncare/ y cambia los IMPORTS de assets
 * + el PERFIL (guía exacta en README-PASO2.md). Nada más.
 *
 * Pesos empaquetados en assets/models/<carpeta>/ (model.json
 * + shards .bin). Se cargan con un IOHandler propio sobre
 * expo-asset + expo-file-system/legacy:
 *   - Expo Go (dev): metro sirve los assets por HTTP → fetch.
 *   - build release: asset local → readAsStringAsync base64.
 * Así NO dependemos de react-native-fs en runtime (el shim
 * del metro config cubre la referencia estática de
 * bundle_resource_io.js; este servicio no la usa).
 *
 * Renderizado del tensor con tf.tidy() para no fugar memoria
 * de GPU (rn-webgl) — crítico en modo continuo.
 * ══════════════════════════════════════════════════════
 */

import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { toByteArray } from 'base64-js';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy'; // ← Fix 1: evita WARN

import peso1 from '../../assets/models/ecoscan/group1-shard1of2.bin';
import peso2 from '../../assets/models/ecoscan/group1-shard2of2.bin';
import modeloJsonAsset from '../../assets/models/ecoscan/model.json';

import type { ResultadoInferencia } from './tipos';

// ─── PERFIL del modelo embebido (cámbialo al pasar al paso 2) ───

interface PerfilModelo {
  /** Identificador para UI/bitácora */
  nombre: string;
  /** Clases en el ORDEN de salida del modelo (= clases.json del notebook) */
  clases: string[];
  /**
   * null → softmax multiclase (se elige por argmax).
   * número → sigmoid binario con ese umbral (clases[0] / clases[1]).
   */
  umbralSigmoid: number | null;
  /** Tamaño aproximado de los pesos (para la UI) */
  tamanioPesosMb: number;
}

/** Paso 1 (actual): ecoscan-v1, binario con umbral 0.5 */
const PERFIL: PerfilModelo = {
  nombre: 'ecoscan-v1',
  clases: ['ORGÁNICO', 'RECICLABLE'],
  umbralSigmoid: 0.5,
  tamanioPesosMb: 4.9,
};

// Paso 2 — cuando entrenes visioncare_bolivia_v1 en Colab, cambia a (además
// de apuntar los imports de assets a ../../assets/models/visioncare/):
//
// const PERFIL: PerfilModelo = {
//   nombre: 'visioncare-bolivia-v1',
//   clases: [
//     // ⚠️ EXACTAMENTE el array "clases" de clases.json — orden alfabético
//     // de las carpetas, el mismo del argmax de la softmax:
//     'Billete de 10 bolivianos',
//     'Billete de 100 bolivianos',
//     'Billete de 20 bolivianos',
//     'Billete de 200 bolivianos',
//     'Billete de 50 bolivianos',
//     'Moneda de 10 centavos',
//     'Moneda de 1 boliviano',
//     'Moneda de 20 centavos',
//     'Moneda de 2 bolivianos',
//     'Moneda de 50 centavos',
//     'Moneda de 5 bolivianos',
//   ],
//   umbralSigmoid: null, // softmax multiclase (argmax)
//   tamanioPesosMb: 5.0, // ← lo que imprime el paso 11 del notebook
// };

interface ModeloJsonTf {
  modelTopology: unknown;
  weightsManifest: Array<{
    paths: string[];
    weights: Array<{ name: string; shape: number[]; dtype: string }>;
  }>;
}

const ALTO = 100;
const ANCHO = 100;
const CANALES = 3;

// ─── Estado del motor (para la UI) ───

let tfListo = false;
let promesaCarga: Promise<tf.LayersModel> | null = null;

/** Info rápida del motor para banners/estado */
export function infoModeloLocal(): {
  nombre: string;
  tamanioPesosMb: number;
} {
  return { nombre: PERFIL.nombre, tamanioPesosMb: PERFIL.tamanioPesosMb };
}

// ─── Bootstrap de TensorFlow.js (backend GPU en el teléfono) ───

/**
 * Activa el backend de TF.js en React Native.
 * Preferimos 'rn-webgl' (GPU vía expo-gl, incluido en Expo Go);
 * si falla, caemos a 'cpu' (más lento pero funcional).
 */
export async function prepararTensorflow(): Promise<string> {
  if (!tfListo) {
    try {
      await tf.setBackend('rn-webgl');
    } catch {
      // rn-webgl no disponible → cpu puro (JS), lento pero sirve
      try {
        await tf.setBackend('cpu');
      } catch {
        // sin backends → cargarModeloLocal() reportará el error
      }
    }
    await tf.ready();
    tfListo = true;
  }
  return tf.getBackend();
}

// ─── IOHandler propio (expo-asset + expo-file-system, sin RNFS) ───

/** Fix 2: fuerza downloadAsync si el asset aún no está local */
async function bytesDeAsset(assetId: number): Promise<Uint8Array> {
  const asset = Asset.fromModule(assetId);

  if (!asset.localUri) {
    await asset.downloadAsync();
  }

  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error('Asset de pesos sin URI (¿falta "bin" en assetExts?)');
  }

  if (uri.startsWith('http')) {
    // Expo Go / metro dev: el asset se sirve por HTTP
    const respuesta = await fetch(uri);
    if (!respuesta.ok) {
      throw new Error(`Fetch de shard falló: HTTP ${respuesta.status}`);
    }
    return new Uint8Array(await respuesta.arrayBuffer());
  }

  // Build release: archivo local dentro del paquete
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return toByteArray(base64);
}

/** Fix 3: concatena TODOS los grupos de weightsManifest */
function crearHandlerEcoscan(
  modeloJson: ModeloJsonTf,
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
      const weightSpecs = modeloJson.weightsManifest.flatMap(
        (g) => g.weights,
      );
      return {
        modelTopology: modeloJson.modelTopology,
        weightSpecs,
        weightData: pesos.buffer,
      } as tf.io.ModelArtifacts;
    },
  };
}

// ─── Carga del modelo (singleton con warmup) ───

/**
 * Carga (una sola vez) el modelo embebido y ejecuta un warmup
 * para que la primera inferencia real no tarde el triple.
 */
export async function cargarModeloLocal(): Promise<tf.LayersModel> {
  await prepararTensorflow();

  if (!promesaCarga) {
    promesaCarga = (async () => {
      const modeloJson = modeloJsonAsset as unknown as ModeloJsonTf;

      // Fix 3b: validación legible
      const weightSpecs = modeloJson.weightsManifest.flatMap(
        (g) => g.weights,
      );
      console.log('[IA local] weightSpecs count:', weightSpecs.length);
      if (weightSpecs.length === 0) {
        throw new Error(
          'model.json no tiene pesos (weightsManifest vacío o parche de nombres no aplicado)',
        );
      }

      const modelo = await tf.loadLayersModel(
        crearHandlerEcoscan(modeloJson, [peso1, peso2]),
      );

      // Fix 4: warmup con dataSync() forzado + try/catch
      try {
        tf.tidy(() => {
          const salida = modelo.predict(
            tf.zeros([1, ALTO, ANCHO, CANALES]),
          ) as tf.Tensor;
          salida.dataSync();
        });
      } catch (e) {
        console.warn('[IA local] Warmup falló (no crítico):', e);
      }

      return modelo;
    })();
  }

  return promesaCarga;
}

// ─── Inferencia (genérica: sigmoid binario o softmax N clases) ───

/**
 * Analiza una foto (uri local de la cámara) con el modelo
 * embebido. Funciona SIN internet — es el respaldo N3.
 * El PERFIL determina la interpretación de la salida:
 * binaria con umbral (ecoscan) o argmax softmax (paso 2).
 */
export async function predecirImagenLocal(
  uri: string,
): Promise<ResultadoInferencia> {
  const inicio = Date.now();
  const modelo = await cargarModeloLocal();
  const backend = tf.getBackend();

  // 1) Leer la foto (base64). Píxeles 0-255: la normalización
  //    1/255 vive DENTRO del modelo (capa Rescaling).
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = toByteArray(base64);

  // Fix 5: decodeJpeg con buffer explícito (copia defensiva si es vista)
  const tensor = tf.tidy(() => {
    const imagen = decodeJpeg(
      bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
        ? bytes
        : new Uint8Array(bytes),
      CANALES,
    );
    return tf.image
      .resizeBilinear(imagen.toFloat(), [ALTO, ANCHO])
      .expandDims(0);
  });

  // 2) Inferencia fuera de tidy (el tensor de salida se lee ya)
  const datos = tf.tidy(() => {
    const salida = modelo.predict(tensor) as tf.Tensor;
    return Array.from(salida.dataSync() as Float32Array);
  });
  tensor.dispose();

  let etiqueta: string;
  let confianza: number;
  let probabilidadBruta: number;
  let top3: ResultadoInferencia['top3'];

  if (PERFIL.umbralSigmoid !== null && datos.length === 1) {
    // ── Sigmoid binario (ecoscan-v1) ──
    const prob = datos[0];
    const positiva = prob >= PERFIL.umbralSigmoid;
    etiqueta = positiva
      ? (PERFIL.clases[1] ?? 'POSITIVO')
      : (PERFIL.clases[0] ?? 'NEGATIVO');
    confianza = positiva ? prob : 1 - prob;
    probabilidadBruta = prob;
  } else {
    // ── Softmax de N clases (visioncare-v1 del paso 2) ──
    const iMax = datos.indexOf(Math.max(...datos));
    etiqueta = PERFIL.clases[iMax] ?? `clase ${iMax}`;
    confianza = datos[iMax];
    probabilidadBruta = confianza;
    top3 = datos
      .map((p, i) => ({
        etiqueta: PERFIL.clases[i] ?? `clase ${i}`,
        confianza: p,
      }))
      .sort((a, b) => b.confianza - a.confianza)
      .slice(0, 3);
  }

  return {
    etiqueta,
    confianza,
    probabilidadBruta,
    latencia_ms: Date.now() - inicio,
    backend,
    modelo: PERFIL.nombre,
    top3,
  };
}
