# Paso 2B — Calle: personas, vehículos y objetos con distancia (N3-2) · VisionCare AI

Complemento del **Paso 2** (moneda boliviana). El usuario pidió 4 modelos:
billetes ✓ (Paso 2), **personas en la calle**, **objetos en la calle** y
**vehículos en la calle** (+ distancia si es posible). Esta es la solución
defendible de las 3 de calle con UN motor embebido.

## 1. Por qué NO se "entrena" la detección de calle (y qué se hace)

- La detección (personas/vehículos/objetos) necesita **imágenes con cajas
  etiquetadas a escala** (millones) — no es un clasificador de carpetas.
- **Kaggle NO tiene datasets etiquetados de calles de Bolivia** (verificado por
  búsqueda, 2026-11). En **Roboflow** sí existe uno pequeño:
  [transporte-publico-bolivia](https://universe.roboflow.com/lab2e3/transporte-publico-bolivia)
  (120 imágenes, detección, jun 2025) — sirve para fine-tune opcional, no de base.
- **Ruta adoptada**: embeber un detector **preentrenado** —
  **COCO-SSD (SSDLite MobileNet V2)**, 80 clases COCO, Apache-2.0, **~18 MB en 5
  shards** — que ya sabe personas, autos, buses, motos, semáforos, perros,
  mochilas… y entrega la **caja** de cada objeto (sin caja no hay distancia ni
  ubicación: para un no vidente, la ubicación es la clave).
- Los 3 pedidos quedan cubiertos por las categorías del TTS:
  **PERSONA** · **VEHICULO** (bicicleta/auto/moto/bus/tren/camión) ·
  **ANIMAL** · **SEÑAL** (semáforo/PARE/parquímetro/hidrante) · **OBJETO**.

## 2. Distancia — geométrica, no otro modelo

`d ≈ (focal_px × altura_real_m) / alto_bbox_px`, con
`focal_px ≈ (ancho_px / 2) / tan(FOV_horizontal / 2)`.

- **Proximidad pura NO necesita calibración** (área del bbox = más cerca).
- El **metraje** sí depende del FOV (defecto 65°): precisión honesta
  **±30-50%** — para orientar, no para medir.
- Calibración en 2 min: persona a distancia conocida → ajustar `fovGrados`.
- Un modelo de profundidad entrenado (KITTI/nuScenes) no cabe en el N3 del
  teléfono ni en el tiempo del equipo — queda como trabajo futuro.

## 3. Notebooks y archivos

| Archivo | Rol |
|---|---|
| `visioncare_calle_v1.ipynb` (Paso 2B) | descarga COCO-SSD, verifica bytes de shards, empaqueta + fine-tune opcional (YOLOv8n, desactivado por defecto) |
| `assets/models/calle/` (delta v2.2) | model.json + 5 shards **ya embebidos** (18 MB) |
| `src/ia-local/calle-local.servicio.ts` | carga del grafo (IOHandler propio), detección, categorías ES, distancia, anuncio TTS |

Nota descubierta al embeber: los shards de este modelo van **sin extensión
`.bin`** en el servidor de tfjs-models; el delta ya los trae renombrados.

## 4. Uso en la app (compilado: tsc estricto, 0 errores)

```ts
import { detectarCalle, construirAnuncioCalle } from '@/src/ia-local';

const detecciones = await detectarCalle(uri, { puntajeMin: 0.55, maxDetecciones: 6 });
anunciar(construirAnuncioCalle(detecciones, 3));
// "Persona a unos 2 metros. Bus a unos 8 metros."
```

- Entrada: JPEG completo (píxeles 0-255 — normaliza el grafo; reescala a lado
  máx 480 para velocidad; los bboxes son normalizados y no se afectan).
- Salidas del grafo identificadas **por forma + contenido** (el orden alfabético
  de tfjs: boxes, classes, scores, num).
- Detecciones ordenadas **por cercanía** (la más próxima primero) — criterio
  defensable para "¿qué tengo enfrente?".

### 🖥️ Pantalla lista: `src/ia-local/demo/PantallaModoCalle.tsx` (delta v2.3)

Demo autocontenida del modo calle (misma estética que `PantallaDemoIaLocal`):

- **Botón "¿Qué hay al frente?"**: captura → `detectarCalle` → habla los 3
  objetos más cercanos → haptic.
- **MODO AUTO** (interruptor): detección automática cada **5 s** — asistencia
  continua para caminar.
- Lista visual: emoji por categoría (🚶🚗🐕🚦📦) · `~distancia` · `% confianza`,
  ordenada por cercanía; debajo el texto exacto que pronuncia el TTS.
- Para la defensa: **MODO AVIÓN** y repetir — detección + voz siguen funcionando.

Para navegarla (mismo patrón que la demo de moneda):

```tsx
import PantallaModoCalle from '@/src/ia-local/demo/PantallaModoCalle';
// … en el stack/navegador de la app:
// <Stack.Screen name="ModoCalle" component={PantallaModoCalle} />
```

## 5. Cascada actualizada para la defensa

| Capa | Motor | Offline | Qué resuelve |
|---|---|---|---|
| **N1 SERVIDOR** | FastAPI (EasyOCR, escenas, fine-tune YOLO futuro) | ❌ | reconocimiento completo — camino principal |
| **N2 NATIVA** | **ML Kit** (`@react-native-ml-kit/text-recognition` + barcode) — **sigue en pie** | ✅ (dev build) | leer texto, códigos de barra/QR |
| **N3-1 EMBEBIDO** | TF.js `visioncare-bolivia-v1` (entrenado por nosotros) | ✅ (Expo Go) | billetes y monedas → TTS |
| **N3-2 EMBEBIDO** | TF.js COCO-SSD preentrenado (calle-v1) | ✅ (Expo Go) | personas/vehículos/objetos + distancia aproximada → TTS |

Fine-tune de vehículos locales (micro/trufi) con el dataset de Roboflow o
fotos propias etiquetadas: corre en **N1** o con **dev build** — trabajo futuro.

## 6. Estado de verificación

| Verificación | Resultado |
|---|---|
| TypeScript estricto (`calle-local.servicio.ts` + index v2.2) | ✅ 0 errores |
| Modelo descargado y verificado (elementos×4 vs bytes de shards) | ✅ 18.034.528 B = 18.034.528 B |
| Clases COCO (80) + etiquetas ES + alturas reales | ✅ en código y en `clases_calle.json` |
| Notebook Paso 2B (16 celdas, JSON válido) | ✅ |
| Datasets bolivianos citados | ✅ fuentes reales (Roboflow), verificado hoy |
