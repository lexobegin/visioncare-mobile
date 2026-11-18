# Paso 2 — Modelo propio de moneda BOLIVIANA (N3) · VisionCare AI

Complemento del **Paso 1** (IA LOCAL ya funcionando con `ecoscan-v1`).
Ahora el objetivo real de la app (persona no vidente en **Bolivia**):
**billetes y monedas bolivianas** anunciadas por voz, sin internet.

> 👉 **Ver también [README-PASO2B.md](README-PASO2B.md)** — calle: personas,
> vehículos y objetos con distancia aproximada (COCO-SSD preentrenado embebido).

## 1. Moneda de curso legal (verificado en fuentes del BCB)

| Tipo | Denominaciones |
|------|----------------|
| 💵 Billetes (familia 2018) | 10 · 20 · 50 · 100 · 200 bolivianos |
| 🪙 Monedas | 10 · 20 · 50 centavos · 1 · 2 · 5 bolivianos |

Fuentes: BCB (Medidas de seguridad del Boliviano; Monedas de circulación legal),
Wikipedia (Boliviano). → **11 clases** para el modelo.

## 2. De dónde salen las imágenes (la realidad de los datasets)

- **Kaggle NO tiene dataset de clasificación de moneda boliviana** (verificado por
  búsqueda, 2026-11). Solo existe uno de **detección** en Roboflow
  ([billetes-de-bolivia, UCB](https://universe.roboflow.com/ucb-mqs6d/billetes-de-bolivia-object-detenction-bills), 202 imágenes,
  formato YOLO — requiere cuenta Roboflow; sirve como complemento, no como base).
- Por eso el notebook tiene **3 modos de dataset**:
  - **STARTER** → `dataset_visioncare_bo_starter.zip` incluido: imágenes web
    organizadas en carpetas y **limpiadas a mano** (revisión visual índice por
    índice). Es un arranque, no el dataset final: mezcla familia 2018 con
    billetes/monedas antiguos de colección y fotos de catálogo.
  - **PROPIO** ⭐ → fotos del equipo (una carpeta por clase). **RUTA RECOMENDADA**:
    ≥ 50 fotos por clase, en mano, luz real, fondos variados. Las monedas se
    fotografían en una tarde (no se mueven).
  - **KAGGLE** → dataset público (frutas) solo para probar el pipeline.
- ⚖️ Las imágenes del starter son de la web con **fin educativo**; para producción
  usa fotos propias.

## 3. El notebook — `visioncare_v1.ipynb`

35 celdas, Colab + T4. Receta validada del paso 1 con:
- softmax de 11 clases + top-3, aumento de datos (clave con pocas fotos)
- **3 parches TF.js integrados** (batch_input_shape, dtype, nombres sin prefijo)
- chequeo de consistencia antes de descargar (paso 11)
- `clases.json` con **etiquetas TTS** ("Billete de 20 bolivianos", "Moneda de 5 bolivianos"…)

Salida: `visioncare_tfjs.zip` → `assets/models/visioncare/` en la app.

## 4. Lo que NO se entrena localmente → ML Kit nativo offline

Tu decisión es la correcta: NO re-entrenar todo lo que ya hace FastAPI. Mapa de la
cascada para la defensa:

| Capa | Motor | Funciona | Qué resuelve |
|------|-------|----------|--------------|
| **N1 SERVIDOR** | Backend NestJS → FastAPI (EasyOCR, etc.) | con internet | reconocimiento completo (texto, escenas, señales, productos) — camino principal |
| **N2 NATIVA** | **Google ML Kit** en el teléfono | **offline** (dev build) | leer texto (OCR on-device), códigos de barra/QR |
| **N3 EMBEBIDO** | TensorFlow.js (`visioncare-bolivia-v1`) | **offline** (Expo Go ✓) | billetes y monedas bolivianas → TTS |

- Paquete verificado: [`@react-native-ml-kit/text-recognition`](https://www.npmjs.com/package/@react-native-ml-kit/text-recognition)
  (v2.0.0, OCR on-device de Google, offline, español = script latino).
  Alternativas: [`react-native-vision-camera-mlkit`](https://github.com/pedrol2b/react-native-vision-camera-mlkit)
  (OCR + códigos de barra en tiempo real con vision-camera), `react-native-nitro-ocr`.
- ⚠️ **ML Kit NO funciona en Expo Go**: requiere **dev build** (`npx expo run:android`
  — ya tienen el script) o EAS development build. El N3 de TF.js sí vive en Expo Go.

## 5. Sobre billetes falsos (honestidad para la defensa)

El modelo local lee la **DENOMINACIÓN** (uso asistivo: "Billete de 20 bolivianos").
**Detectar falsos con una CNN de 100×100 NO es fiable**: los rasgos de seguridad
(marca de agua, microtexto, hilo, relieve, UV) no sobreviven a la resolución ni se
entrenan sin datos de falsos reales. Queda como trabajo futuro (UV + transformers,
o análisis de alta resolución). Para P4, el mecanismo defendible es: modelo propio +
inferencia local + TTS.

## 6. Modelo convertido y conectado (delta v2.3 — hecho, no pendiente)

El equipo entrenó en Colab y entregó `visioncare-bolivia-v1.keras`
(MobileNetV2 transfer + cabeza Dense(256,relu)→Dense(11,softmax), entrada
100×100×3). La conversión a TF.js la hicimos aquí y **ya está integrada**:

1. **Imports de assets** → `../../assets/models/visioncare/` (model.json + 3 shards, **9.9 MB**) ✅
2. **PERFIL** → `visioncare-bolivia-v1`, 11 clases (orden alfabético = argmax), `umbralSigmoid: null` ✅
3. `predecirImagenLocal()` no se tocó: interpreta softmax y devuelve `top3`
4. La carpeta `assets/models/ecoscan/` ya no se usa (puedes borrarla de tu repo: −5 MB)

**Cómo se convirtió** (script `scripts/convertir_keras_tfjs.py`, reproducible):
Keras 3 `.keras` → carga con keras 3.15 → re-guardar **H5 legacy** →
`tensorflowjs_converter` (tfjs 4.22) → **parche determinista**: Keras 3 escribe
`batch_shape` y nodos `__keras_tensor__`/nodos aplanados; el script los normaliza
a los nombres/formatos que tfjs espera (`batch_input_shape`, nodos keras-2).
Verificado: 264 weightSpecs, 2.588.747 elementos × 4 B = bytes de shards exactos,
formato layers-model. Problema conocido del camino directo: el conversor viejo
falla con Keras 3 — por eso la ruta H5 legacy + parche.

> ⚠️ Si entrenas de nuevo con OTRAS clases, reordena `PERFIL.clases` igual que
> las carpetas del dataset (alfabético) y reconvierte con el script.

## 7. Estado de verificación

| Verificación | Resultado |
|---|---|
| TypeScript estricto (tsc 6.0.3, React 19.3, RN 0.88.1, `expo-file-system/legacy`) | ✅ 0 errores |
| Notebook (35 celdas, JSON válido, parches, modos, etiquetas TTS) | ✅ |
| Denominaciones BCB | ✅ verificadas con fuentes citadas |
| Dataset starter | imágenes validadas con PIL + revisión visual + limpieza índice por índice (ver README.txt del zip) |
| Conversión `.keras`→TF.js (264 specs, bytes exactos, layers-model) | ✅ model.json + 3 shards (9.9 MB) en assets/models/visioncare/ |
| Carga del modelo convertido con tf.loadLayersModel (IOHandler propio) | ✅ (test Node con el mismo patrón de la app) |
