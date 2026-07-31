# 📄 PWA Dokument Scanner -- Gesamtkonzept

## 1. Überblick

Diese Anwendung ist eine vollständig clientseitige Progressive Web App
(PWA) zum Scannen von Dokumenten. Sie benötigt kein Backend und keine
Authentifizierung.

### Ziele

-   Dokumente mit Kamera erfassen
-   Automatische Erkennung und Zuschnitt
-   Bildoptimierung (Scan-Look)
-   Mehrseitige PDFs erzeugen
-   Teilen über Android / Browser Share API

------------------------------------------------------------------------

## 2. Systemarchitektur

    Browser (PWA)
    │
    ├── Kamera (getUserMedia)
    ├── OpenCV.js (Dokumenterkennung)
    ├── Canvas API (Bildverarbeitung)
    ├── pdf-lib (PDF Erstellung)
    ├── Web Share API (Export)
    └── optional: IndexedDB (Persistenz)

------------------------------------------------------------------------

## 3. Gesamtpipeline

    Live Kamera Frame
        ↓
    Frame Capture
        ↓
    Dokumentenerkennung (Konturen / ML optional)
        ↓
    4-Punkt Perspektivkorrektur
        ↓
    Image Enhancement (Kontrast / Threshold)
        ↓
    Speichern als „Page“
        ↓
    Mehrere Pages sammeln
        ↓
    PDF Generierung
        ↓
    Share / Download

------------------------------------------------------------------------

## 4. Module im Detail

## 4.1 Kamera Modul

-   getUserMedia API
-   Live Video Stream
-   Frame Capture via Canvas

------------------------------------------------------------------------

## 4.2 Dokumenterkennung (OpenCV.js)

Verwendete Schritte: - Graustufen - Gaussian Blur - Canny Edge
Detection - Konturenerkennung - Auswahl größtes Viereck

Ergebnis: → 4 Eckpunkte des Dokuments

------------------------------------------------------------------------

## 4.3 Perspektivkorrektur

-   Perspective Transform
-   WarpPerspective (OpenCV)

Ergebnis: → „gerades Dokument"

------------------------------------------------------------------------

## 4.4 Bildverbesserung

Optionale Filter: - Kontrastverstärkung - Adaptive Threshold
(Scan-Look) - Schärfen - Graustufen-Modus

------------------------------------------------------------------------

## 4.5 Page Buffer

Jede gescannte Seite wird gespeichert:

``` js
pages = [
  { image: "base64 / blob" },
  { image: "base64 / blob" }
];
```

------------------------------------------------------------------------

## 4.6 PDF Generierung (pdf-lib)

-   Jede Seite wird als Bild eingebettet
-   Multi-Page Dokument wird erzeugt

Output: → Blob (application/pdf)

------------------------------------------------------------------------

## 4.7 Sharing Modul

### Web Share API

-   Öffnet Android Share Sheet
-   Ziel: Google Drive, WhatsApp, Mail

Fallback: - Download Link

------------------------------------------------------------------------

## 5. Datenfluss pro Seite

    Kamera Frame
    → OpenCV Verarbeitung
    → Crop + Warp
    → Canvas Export
    → pages[] push

------------------------------------------------------------------------

## 6. Multi-Page Flow

    Seite 1 scannen → speichern
    Seite 2 scannen → speichern
    Seite 3 scannen → speichern

    → PDF erzeugen
    → Share

------------------------------------------------------------------------

## 7. PDF Erstellung (Pseudo)

    createPDF(pages):
      pdf = new PDFDocument()

      for page in pages:
        img = embedImage(page)
        pdf.addPage(img)

      return pdfBlob

------------------------------------------------------------------------

## 8. Performance-Strategie

### Empfohlen:

-   OpenCV.js für 90% der Fälle
-   Canvas API für Filter
-   Keine Serververarbeitung

### Optional:

-   ONNX-Modelle (DocShadow, DocAligner) via onnxruntime-web für
    schwierige Szenen -- siehe Kapitel 12
-   TensorFlow.js (MAXIM / ESRGAN) für Deblur / Super-Resolution
-   WebGPU/WebGL Beschleunigung

------------------------------------------------------------------------

## 9. Speicherstrategie

### Variante 1 (Standard)

-   RAM Speicher (pages array)

### Variante 2 (erweitert)

-   IndexedDB für große Dokumente
-   Resume bei App Neustart

------------------------------------------------------------------------

## 10. Limitierungen

-   Sehr große PDFs (\>100 Seiten) können RAM-lastig sein
-   OCR ist optional und langsam im Browser
-   Kamerazugriff nur HTTPS / localhost

------------------------------------------------------------------------

## 11. Tech Stack

-   OpenCV.js
-   Canvas API
-   pdf-lib
-   Web Share API
-   getUserMedia
-   **onnxruntime-web** (ML-Inferenz im Browser, WebGPU/WASM)
-   optional: TensorFlow.js (MAXIM / ESRGAN via UpscalerJS)
-   optional: Tesseract.js

------------------------------------------------------------------------

## 12. ONNX Runtime Web -- Modelle & Pipeline (erweiterte Bildverbesserung)

Die klassische OpenCV-Pipeline deckt den Standardfall ab. Für
schwierige Aufnahmen (Schatten, gewölbte Seiten, Rauschen, niedrige
Auflösung) lassen sich vortrainierte Deep-Learning-Modelle im Browser
ausführen -- ohne Backend, ohne Upload. Empfohlene Runtime:
**onnxruntime-web**, da die meisten relevanten Dokument-Modelle aus
der PyTorch-Welt stammen und sauber nach ONNX exportierbar sind.

### 12.1 Modellauswahl pro Use Case

| Aufgabe | Modell | Quelle (ONNX) | Input | Größenordnung | Priorität |
|---|---|---|---|---|---|
| Eckpunkt-Erkennung (Backup für OpenCV) | **DocAligner** | DocsaidLab/DocAligner | 128×128 RGB | klein | hoch |
| Schattenentfernung (Handy-Aufnahme) | **DocShadow** (`docshadow_sd7k.onnx`) | fabio-sim/DocShadow-ONNX-TensorRT | 256×256 RGB | mittel | hoch |
| Text-Segmentierung / Scan-Look | **DBNet** | OnnxTR (docTR-Port) | variabel | mittel | mittel |
| Deblur / Denoise / Low-Light | **MAXIM** | UpscalerJS (TFJS) bzw. ONNX-Export | variabel | mittel–groß | optional |
| Super-Resolution (matschiger Text) | **ESRGAN** | UpscalerJS / ONNX | Tiles | groß | optional |

**Empfohlener Minimal-Stack für diesen Scanner:**
1. **DocAligner** -- robuste Eckpunkterkennung, wenn OpenCV-Konturen
   versagen (schlechter Kontrast zum Untergrund).
2. **DocShadow** -- der größte Qualitätssprung bei Handyfotos:
   entfernt Schlagschatten und Beleuchtungsgradienten, die jeden
   Adaptive-Threshold ruinieren.

### 12.2 Runtime-Einbindung

```bash
npm install onnxruntime-web
# Modelle als statische Assets ablegen, z.B. /public/models/*.onnx
```

Execution-Provider-Strategie (schnell → Fallback):
**WebGPU → WASM (SIMD + Threads) → WASM (single thread)**.

```js
import * as ort from 'onnxruntime-web';

// WASM-Assets-Pfad setzen (selbst hosten für Offline-PWA)
ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.simd = true;

async function createSession(modelUrl) {
  const providers = [];
  if (navigator.gpu) providers.push('webgpu');   // schnellster Pfad
  providers.push('wasm');                         // Fallback

  return await ort.InferenceSession.create(modelUrl, {
    executionProviders: providers,
    graphOptimizationLevel: 'all',
  });
}
```

> **Wichtig (Threads):** WASM-Multithreading benötigt
> Cross-Origin-Isolation. Im PWA-Server folgende Header setzen,
> sonst fällt ORT auf Single-Thread zurück:
> `Cross-Origin-Opener-Policy: same-origin`
> `Cross-Origin-Embedder-Policy: require-corp`

### 12.3 Pre-/Post-Processing (generisch)

Die meisten Bildmodelle erwarten **NCHW float32**, normalisiert auf
`[0,1]` oder `[-1,1]`. Ablauf: Canvas → Resize auf Modell-Input →
RGBA→RGB → Pixel umsortieren (HWC→CHW) → Tensor.

```js
// Canvas (RGBA) -> Float32 NCHW Tensor [1,3,H,W], normalisiert auf [0,1]
function canvasToTensor(canvas, W, H) {
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const ctx = tmp.getContext('2d');
  ctx.drawImage(canvas, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H); // RGBA, length W*H*4

  const chw = new Float32Array(3 * W * H);
  const plane = W * H;
  for (let i = 0; i < plane; i++) {
    chw[i]             = data[i * 4]     / 255; // R
    chw[i + plane]     = data[i * 4 + 1] / 255; // G
    chw[i + 2 * plane] = data[i * 4 + 2] / 255; // B
  }
  return new ort.Tensor('float32', chw, [1, 3, H, W]);
}

// Modell-Output [1,3,H,W] float32 [0,1] -> zurück auf ein Canvas
function tensorToCanvas(tensor, W, H) {
  const out = tensor.data;        // Float32Array
  const plane = W * H;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const img = canvas.getContext('2d').createImageData(W, H);
  for (let i = 0; i < plane; i++) {
    img.data[i * 4]     = Math.min(255, Math.max(0, out[i]             * 255));
    img.data[i * 4 + 1] = Math.min(255, Math.max(0, out[i + plane]     * 255));
    img.data[i * 4 + 2] = Math.min(255, Math.max(0, out[i + 2 * plane] * 255));
    img.data[i * 4 + 3] = 255;
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
  return canvas;
}
```

> **Hinweis:** Normalisierung (`/255` vs. Mean/Std) und Output-Layout
> sind modellspezifisch. Vor dem Produktiveinsatz die Pre-/Post-Werte
> aus dem jeweiligen Repo verifizieren (DocShadow: 256×256, `[0,1]`).

### 12.4 Beispiel-Inferenz (DocShadow -- Schattenentfernung)

```js
const shadowSession = await createSession('/models/docshadow_sd7k.onnx');

async function removeShadow(sourceCanvas) {
  const W = 256, H = 256;                 // Modell-Inputgröße
  const input = canvasToTensor(sourceCanvas, W, H);

  const feeds = {};
  feeds[shadowSession.inputNames[0]] = input;
  const results = await shadowSession.run(feeds);
  const output = results[shadowSession.outputNames[0]];

  return tensorToCanvas(output, W, H);    // ggf. auf Originalgröße zurückskalieren
}
```

### 12.5 Hochauflösungs-Strategie (Tiling)

Modelle laufen oft auf kleiner Fixgröße (z.B. 256×256), Dokumente sind
aber hochauflösend. Zwei Optionen:

-   **Downscale-Apply-Upscale:** Für Schatten-/Beleuchtungskorrektur
    meist ausreichend, da der Effekt niederfrequent ist. Schnell.
-   **Tiling:** Bild in überlappende Kacheln zerlegen, einzeln
    inferieren, mit Blend an den Rändern zusammenfügen. Nötig bei
    Super-Resolution / Detailschärfung. Deutlich teurer.

### 12.6 Integration in die Gesamtpipeline

```
Kamera Frame
    ↓
Eckpunkt-Erkennung:  OpenCV-Konturen  ──(Fallback)──>  DocAligner (ONNX)
    ↓
4-Punkt Perspektivkorrektur  (OpenCV warpPerspective)
    ↓
[optional ML] DocShadow (ONNX)  →  Schatten/Beleuchtung entfernt
    ↓
[optional ML] MAXIM (Deblur/Denoise)  /  ESRGAN (Super-Resolution)
    ↓
Klassische Filter: CLAHE / Sauvola-Binarisierung / Unsharp Mask
    ↓
Page Buffer → PDF → Share
```

### 12.7 Performance & PWA-Praxis

-   **Lazy Loading:** Modelle erst beim Antippen von „Verbessern"
    laden, nicht beim App-Start. Session einmalig erstellen, dann
    wiederverwenden (Warm-up: erster Run deutlich langsamer).
-   **ORT-Format:** ONNX → `.ort` konvertieren für kleinere Binaries
    und schnelleren Init.
-   **WebGPU bevorzugen**, WASM+SIMD+Threads als Fallback.
-   **Caching:** Modelle via Service Worker / IndexedDB cachen →
    Offline-Fähigkeit + kein erneuter Download.
-   **Default bleibt klassisch:** ML nur als Opt-in pro Seite. Nicht
    jede Aufnahme braucht ein neuronales Netz.

### 12.8 Klassische Alternativen (pure OpenCV.js / Canvas)

Holen oft 80 % des Effekts zu 1 % der Kosten -- vor ML immer zuerst
prüfen:

-   **Background Division / Shadow Removal:** Hintergrund per starkem
    Blur schätzen, Original dadurch teilen → Beleuchtungsgradienten und
    Schatten verschwinden. Sehr effektiv, fast gratis.
-   **CLAHE** statt simpler Kontrastverstärkung.
-   **Sauvola / Niblack** statt naivem Adaptive Threshold (besser bei
    ungleichmäßiger Ausleuchtung).
-   **Unsharp Mask** (Schärfe) + **Otsu** (sauberer S/W-Modus).

------------------------------------------------------------------------

## 13. Fazit

Diese Architektur ersetzt klassische Scanner-Apps vollständig serverlos.
Alle kritischen Prozesse laufen im Browser.

→ Kein Backend notwendig → Kein OAuth notwendig → Vollständig
offlinefähig (bis auf Sharing)
