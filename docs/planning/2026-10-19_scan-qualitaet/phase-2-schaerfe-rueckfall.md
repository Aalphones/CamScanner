# Phase 2 — Schärfstes Videobild als Rückfall

## Kontext

- `src/app/core/camera.ts` (nach Phase 1)
- `src/app/core/opencv-loader.ts`, `src/app/core/mat-scope.ts` (Muster für OpenCV-Aufrufe)
- `src/app/core/document-detection.ts` (`drawScaled` — Muster: Bitmap verkleinert auf OffscreenCanvas → `ImageData`)
- `docs/decisions/009-fotoaufnahme.md` (aus Phase 1)
- AGENTS.md Regel 3: OpenCV nur über `core/`-Services.
- Fehlerklassen geprüft: keine einschlägig (siehe Phase 1).

## Entscheidungen

- **Fünf Bilder, 60 ms Abstand** (`FALLBACK_FRAME_COUNT = 5`, `FALLBACK_FRAME_GAP_MS = 60`): 60 ms liegt über einem Bildintervall bei 30 fps (33 ms), also kommt jedes Mal ein neues Bild. Gesamt rund ein halbe Sekunde.
- **Schärfemaß:** Varianz des Laplace-Bilds, gerechnet auf der mittleren Hälfte (Breite und Höhe je 50 %) einer auf 640 px lange Kante verkleinerten Kopie. Nur relativ verglichen — **kein Schwellwert**, es gewinnt das schärfste.
- Höchstens zwei volle Bitmaps gleichzeitig im Speicher (bestes + aktuelles).

## AK

1. Im Rückfall-Pfad liefert `captureFrame` das schärfste von fünf Videobildern; die übrigen vier sind geschlossen (`close()`).
2. Wirft die Schärfemessung, liefert `captureFrame` das zuerst gegriffene Bild wie bisher.

## Checkliste

- [ ] Neue Datei `src/app/core/sharpness.ts`, `@Service()` `Sharpness` mit `inject(OpencvLoader)`. Konstanten mit Doc-Kommentar: `SHARPNESS_MAX_EDGE = 640` (`/** Schärfe auf einer kleinen Kopie messen — Verwacklung sieht man dort genauso, die Rechnung bleibt billig. */`), `SHARPNESS_CENTER_RATIO = 0.5` (`/** Nur die Bildmitte: dort liegt das Dokument, der Tisch drumherum soll nicht mitentscheiden. */`).
- [ ] `async score(frame: ImageBitmap): Promise<number>`: OpenCV laden; verkleinerte Kopie der Bildmitte als `ImageData` zeichnen — `OffscreenCanvas` der verkleinerten Größe, `context.drawImage(frame, sx, sy, sw, sh, 0, 0, w, h)` mit `sw = frame.width * 0.5`, `sx = frame.width * 0.25` (analog y) und `w/h` so, dass die lange Kante höchstens 640 ist. Dann mit `MatScope`: `matFromImageData` → `cvtColor(RGBA2GRAY)` → `cv.Laplacian(gray, lap, cv.CV_64F)` → `cv.meanStdDev(lap, mean, stddev)` → Rückgabe `stddev.data64F[0] ** 2`. Doc-Kommentar: `/** Varianz des Laplace-Bilds: scharfe Kanten geben große Ausschläge, Verwacklung glättet sie weg. Nur zum Vergleichen zweier Bilder derselben Szene. */`
- [ ] `camera.ts`: `inject(Sharpness)`; Konstanten `FALLBACK_FRAME_COUNT = 5`, `FALLBACK_FRAME_GAP_MS = 60` mit Doc-Kommentar (`/** Rückfall ohne Foto: mehrere Videobilder greifen und das schärfste nehmen — gegen Verwacklung beim Antippen. 60 ms > ein Bildintervall bei 30 fps (ADR-009). */`).
- [ ] `captureFrame`: `return photo ?? this.sharpestVideoFrame(video);`
- [ ] Private `async sharpestVideoFrame(video: HTMLVideoElement): Promise<ImageBitmap>`:
  ```ts
  let best: { bitmap: ImageBitmap; score: number } | null = null;
  for (let index = 0; index < FALLBACK_FRAME_COUNT; index += 1) {
    if (index > 0) await delay(FALLBACK_FRAME_GAP_MS);
    const bitmap = await createImageBitmap(video);
    let score: number;
    try { score = await this.sharpness.score(bitmap); }
    catch (error: unknown) { console.warn('Schärfemessung fehlgeschlagen', error); best?.bitmap.close(); return bitmap; }
    if (best === null || score > best.score) { best?.bitmap.close(); best = { bitmap, score }; }
    else { bitmap.close(); }
  }
  return best!.bitmap;   // Schleife läuft mindestens einmal — statt `!` ein `if (best === null) throw new Error(...)` gemäß typescript.md
  ```
  Modul-Funktion `delay(ms: number): Promise<void>` = `new Promise((resolve) => setTimeout(resolve, ms))`.
- [ ] ADR-009, Abschnitt Entscheidung: Satz zum Rückfall ergänzen („Rückfall: fünf Videobilder im Abstand von 60 ms, das schärfste nach Varianz des Laplace-Bilds der Bildmitte“).
- [ ] `docs/code-map.md`: Zeile `core/sharpness.ts` — „Schärfemaß eines Bildes (Varianz des Laplace-Bilds der Bildmitte), nur relativ; wählt im Rückfall der Aufnahme das schärfste Videobild“.
- [ ] `npm run lint`, `npm run build`, `npm test`.

## Report-Back
