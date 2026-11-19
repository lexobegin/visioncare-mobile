# Paso 1 — IA LOCAL en la app móvil (N3) · VisionCare AI

Delta que añade **TensorFlow.js embebido en el teléfono**: un modelo
entrenado por nosotros en Colab corre DENTRO de la app **sin internet**.
Es el nivel **N3** de la cascada IA para la defensa de la pregunta 4:

| Nivel | Motor | Cuándo | Estado |
|---|---|---|---|
| **N1** | Backend NestJS → **FastAPI con modelos locales** (YOLOv8, EasyOCR…) en la MV de GCP | hay internet (PRINCIPAL) | ya existe |
| **N2** | Colas de datos offline (CU25/26) | backend caído | ya existe |
| **N3** | **TF.js embebido** (este delta) | sin internet | **nuevo** |

> Argumento de defensa P4: *"IA con modelos locales: en el servidor propio
> (FastAPI + YOLOv8/EasyOCR en nuestra MV) **y** en el dispositivo (modelo
> propio entrenado en Colab embebido en la app). La app analiza sin internet."*

---

## 1. Instalar dependencias (repo SDK 58)

```bash
# Expo elige las versiones correctas del SDK automáticamente
npx expo install expo-gl expo-file-system expo-asset @react-native-community/netinfo

# TensorFlow.js (versiones fijas y compatibles entre sí)
npm install --legacy-peer-deps @tensorflow/tfjs@4.22.0 @tensorflow/tfjs-react-native@1.0.0 base64-js@1.5.1
```

⚠️ **NO instales `react-native-fs`** (aparece como peer-dependency pero es un
import dinámico que este paquete **evita por diseño**: el cargador propio usa
`expo-asset` + `expo-file-system`, que sí viven en Expo Go).

## 2. Copiar archivos al repo

```
visioncare-mobile/
├── assets/
│   └── models/ecoscan/            ← COPIAR (model.json + 2 shards ≈ 4.9 MB)
├── src/
│   └── ia-local/                  ← COPIAR (6 archivos + demo/)
└── metro.config.js                ← MERGE (ver abajo)
```

Si el repo **ya tiene** `metro.config.js`, solo añade la línea clave:

```js
config.resolver.assetExts.push('bin');
```

## 3. Registrar la pantalla demo

**`src/navigation/NavigationTypes.ts`** — en `RootStackParamList`:

```ts
DemoIaLocal: undefined;
```

**`src/navigation/RootNavigator.tsx`**:

```tsx
import PantallaDemoIaLocal from '@/ia-local/demo/PantallaDemoIaLocal';
// ... dentro del Stack, junto a las demás screens:
<Stack.Screen name="DemoIaLocal" component={PantallaDemoIaLocal} />
```

**`src/screens/inicio/PantallaMasMenu.tsx`** — un botón que lleve a
`navigation.navigate('DemoIaLocal')` (el que uses para las demos).

## 4. Ejecutar

```bash
npx expo start -c     # -c: limpiar caché de metro (IMPORTANTE la 1ª vez)
```

Abrir en **Expo Go** → iniciar sesión → Menú → **Demo IA Local**.

### Protocolo de prueba para la defensa (P4)

1. **Con internet**: analizar una botella/carta (♻️) y una fruta/hoja (🍌).
   El chip muestra `TF.js backend: rn-webgl` (GPU vía expo-gl).
2. **MODO AVIÓN**: repetir — el análisis sigue funcionando porque el modelo
   vive en la app (`✈️ sin internet → N3` en el chip de red).
3. Latencia esperada: primera carga del modelo ≈ 2–5 s (incluye warmup);
   cada inferencia posterior < 1 s en rn-webgl.

## 5. Cablear la cascada completa (N1 → N3) en `PantallaCamara`

Cuando el análisis en servidor ya esté integrado, reemplaza la llamada
directa por la cascada — un solo cambio:

```ts
import { analizarConCascada } from '@/ia-local';

// antes:  const r = await registrarCaptura(tipo, base64);
const r = await analizarConCascada(foto.uri, async (uri) => {
  // N1: llamada al backend NestJS → FastAPI (usa la api/ existente)
  const resp = await registrarCaptura(tipo, await uriABase64(uri));
  return { etiqueta: resp.etiqueta, confianza: resp.confianza };
});
// r.motor === 'SERVIDOR' | 'LOCAL'  ·  r.motivo registra por qué
```

Mientras no pases callback, la cascada va directa a LOCAL
(`motivo: SERVIDOR_NO_CONFIGURADO`) — exactamente lo que hace la demo.

## 6. Especificación del modelo `ecoscan-v1`

| Dato | Valor |
|---|---|
| Origen | Notebook `ecoscan_v1.ipynb` (Colab, GPU T4, dataset Kaggle ~25k imágenes) |
| Arquitectura | 4×(Conv2D+MaxPool) → Dropout 0.5 → Dense 512 → Dense 1 sigmoid |
| Entrada | `[1, 100, 100, 3]` RGB, **píxeles 0-255** (la capa `Rescaling(1/255)` vive DENTRO del modelo — no normalizar en la app) |
| Salida | prob sigmoid: `≥ 0.5 → RECICLABLE` · `< 0.5 → ORGÁNICO` |
| Pesos | `model.json` + `group1-shard{1,2}of2.bin` ≈ 4.9 MB (verificado: 5.161.732 bytes exactos) |
| Embebido | `assets/models/ecoscan/` (se empaqueta con la app → offline total) |

> **Importante (paso 2)**: al re-entrenar con Colab para billetes/objetos,
> el `model.json` que sale del convertidor Keras 3 necesita el parche de
> nombres (tfjs genera variables **sin** el prefijo `sequential_1/`). El
> parche ya está **aplicado** al `model.json` incluido; para re-entrenos
> futuros re-aplicar `scripts/patchear_nombres_ecoscan.py` con el nuevo json.

## 7. Verificaciones ya ejecutadas sobre este delta

| Verificación | Resultado |
|---|---|
| Carga + inferencia del modelo (Node + tfjs 4.22, mismo IOHandler que la app) | ✅ 14 capas, entrada `[null,100,100,3]`, salida `[null,1]`, `prob=0.4061` |
| Consistencia de shards | ✅ 12 pesos × float32 = 5.161.732 B = bytes reales |
| TypeScript estricto (tsc 6.0.3, React 19.3, RN 0.88.1, deps expo reales) | ✅ 0 errores |

## 8. Troubleshooting

| Síntoma | Causa/solución |
|---|---|
| `Provided weight data has no target variable` | `model.json` sin parche de nombres → aplicar el script del punto 6 |
| Assets `.bin` no encontrados | falta `assetExts.push('bin')` en metro o no reiniciaste con `-c` |
| Backend muestra `cpu` en vez de `rn-webgl` | expo-gl no disponible (raro en Expo Go) — funciona igual, más lento |
| Primera inferencia lenta | normal: el warmup está incluido en `cargarModeloLocal()` |
| `Errores de tipos` en el repo | asegurarse que `recursos.d.ts` se copió (declara `*.bin`, `*.json`, `base64-js`) |

## 9. Nota para build release

El cargador propio detecta el modo: en **Expo Go/dev** los assets llegan por
HTTP (metro) y en **build release** se leen como archivo local
(`readAsStringAsync` base64). Ambos caminos están cubiertos sin
`react-native-fs` — el APK/AAB final funciona igual.
