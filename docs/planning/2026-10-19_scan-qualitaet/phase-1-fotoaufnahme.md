# Phase 1 — Aufnahme als echtes Foto

## Kontext

- `src/app/core/camera.ts` (ganz)
- `src/app/features/capture/capture.ts` (`onShutterClick`), `capture.html` (Auslöser hat bereits `[disabled]="capturing()"`)
- `docs/decisions/006-filter-pipeline.md` (Pipeline auf bis zu 12 MP ausgelegt — Quelle der Pixelgrenze)
- `docs/conventions/typescript.md`, `docs/conventions/angular.md`
- `ImageCapture`, `PhotoCapabilities`, `PhotoSettings` stehen in den DOM-Typen von TypeScript (`lib.dom.d.ts`) — keine eigene Deklaration nötig.
- Fehlerklassen geprüft: `frameworks/angular*.md` ohne Abschnitt, `sprachen/typescript.md` (nur `fetch`-Statusfehler) — keine einschlägig.

## Chesterton

- `captureFrame` macht heute `createImageBitmap(video)`: das aktuelle Videobild in Stream-Auflösung. Zweck: schnell, überall verfügbar. Bleibt als Rückfall erhalten.

## Entscheidungen

- **Taschenlampe an → Videobild.** Ob `takePhoto` die Dauerleuchte auf Android eingeschaltet lässt, ist ungeprüft; das Videobild ist sicher hell.
- **Pixelgrenze 12 MP** (`PHOTO_MAX_PIXELS = 12_000_000`), aus ADR-006. Größere Sensoren werden über `PhotoSettings` kleiner angefragt und, falls das Gerät das ignoriert, nach dem Dekodieren verkleinert.
- **Zeitgrenze 5 s** (`PHOTO_TIMEOUT_MS = 5_000`), danach Videobild. Ein spät eintreffendes Foto wird verworfen.

## AK

1. Mit `ImageCapture` und Taschenlampe aus liefert `captureFrame` ein Bitmap aus `takePhoto`, höchstens 12 MP (+5 % Toleranz), aufrecht gedreht (EXIF beachtet).
2. Ohne `ImageCapture`, mit Taschenlampe an, bei Fehler oder nach 5 s: Videobild wie bisher.
3. Konsole meldet einmal je Aufnahme `Camera: Foto W × H` oder `Fotoaufnahme nicht möglich, nehme das Videobild` mit Fehler.

## Checkliste

- [x] In `camera.ts` Konstanten mit Doc-Kommentar:
  - `PHOTO_MAX_PIXELS = 12_000_000` — `/** Obergrenze fürs Foto: die Pipeline ist auf bis zu 12 MP ausgelegt (ADR-006); mehr kostet nur Speicher. */`
  - `PHOTO_PIXEL_TOLERANCE = 1.05` — `/** Geräte runden die angefragte Größe; erst darüber wird nachträglich verkleinert. */`
  - `PHOTO_TIMEOUT_MS = 5_000` — `/** Manche Geräte beantworten takePhoto nie — danach zählt das Videobild (ADR-009). */`
- [x] Modul-Funktion `withTimeout<T>(work: Promise<T>, ms: number): Promise<T>` — `Promise.race` gegen ein `setTimeout`, das `new Error('Zeitüberschreitung')` wirft; Timer im `finally` per `clearTimeout` lösen.
- [x] `captureFrame` wird `async`, Doc-Kommentar: `/** Standbild für den Scan: echtes Foto in Sensor-Auflösung, wo der Browser es kann, sonst das Videobild (ADR-009). */` Ablauf:
  ```ts
  const photo = await this.takePhoto();
  return photo ?? createImageBitmap(video);
  ```
- [x] Private `async takePhoto(): Promise<ImageBitmap | null>`:
  1. `track = this.stream?.getVideoTracks()[0]`; `null` zurück, wenn kein Track, `typeof ImageCapture === 'undefined'` oder `this.torchOn()`.
  2. `try`: `const capture = new ImageCapture(track);` `const settings = await this.photoSettings(capture);` `const blob = await withTimeout(capture.takePhoto(settings), PHOTO_TIMEOUT_MS);` `const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });` `const limited = await this.limitPixels(bitmap);` `console.info('Camera: Foto', limited.width, '×', limited.height);` `return limited;`
  3. `catch (error: unknown)`: `console.warn('Fotoaufnahme nicht möglich, nehme das Videobild', error); return null;`
- [x] Private `async photoSettings(capture: ImageCapture): Promise<PhotoSettings>`: `getPhotoCapabilities()` in `try` (Fehler → `{}`). `maxWidth = capabilities.imageWidth?.max`, `maxHeight = capabilities.imageHeight?.max`; fehlt einer → `{}`. Ist `maxWidth * maxHeight <= PHOTO_MAX_PIXELS` → `{ imageWidth: maxWidth, imageHeight: maxHeight }`, sonst `factor = Math.sqrt(PHOTO_MAX_PIXELS / (maxWidth * maxHeight))` und `{ imageWidth: Math.round(maxWidth * factor), imageHeight: Math.round(maxHeight * factor) }`.
- [x] Private `async limitPixels(bitmap: ImageBitmap): Promise<ImageBitmap>`: liegt `bitmap.width * bitmap.height` unter `PHOTO_MAX_PIXELS * PHOTO_PIXEL_TOLERANCE` → unverändert zurück. Sonst `factor = Math.sqrt(PHOTO_MAX_PIXELS / (w * h))`, `createImageBitmap(bitmap, { resizeWidth: Math.round(w * factor), resizeHeight: Math.round(h * factor), resizeQuality: 'high' })`, Original im `finally` per `bitmap.close()` schließen.
- [x] `capture.ts` bleibt unverändert (ruft schon `await this.camera.captureFrame(...)` vor `camera.stop()` — die Reihenfolge ist Pflicht, `takePhoto` braucht den laufenden Track). Kommentar an der Zeile ergänzen: `// Vor stop(): die Fotoaufnahme braucht den laufenden Track.`
- [x] ADR `docs/decisions/009-fotoaufnahme.md` (Format wie 006/007): Kontext (Videobild höchstens 4K, Video-Rauschunterdrückung, kein Foto-Autofokus) · Optionen: Videobild lassen / `ImageCapture.takePhoto` mit Rückfall / Video-Auflösung hochdrehen · Entscheidung: `takePhoto`, 12 MP, 5 s, Taschenlampe → Videobild · Konsequenzen: nur Chromium-Browser haben `ImageCapture` (Safari/Firefox nehmen den Rückfall), Foto hat oft 4:3 statt des 16:9-Sucherausschnitts, Auslösen dauert länger. Phase 2 ergänzt den Absatz zum Rückfall.
- [x] `docs/code-map.md`, Zeile `core/camera.ts`: „Kapselt `getUserMedia`/Track-Handling, Zustand als Signal; Standbild per `ImageCapture.takePhoto` mit Rückfall aufs Videobild (ADR-009)“.
- [x] `docs/glossary.md`: Zeile **Standbild** ergänzen: „Das Bild, das der Auslöser festhält: Foto der Kamera (`takePhoto`, höchstens 12 MP), wo der Browser es kann, sonst ein Bild aus dem Videostream (ADR-009)“.
- [x] `npm run lint`, `npm run build`, `npm test`.

## Report-Back

**Status:** complete (2026-10-20). Umgesetzt wie geplant, keine Abweichung. Lint, Build, Tests (9/9) grün. Am Gerät ungeprüft — Smoke-Punkt 1 der README (Konsole `Camera: Foto W × H`, Dauer Auslöser → Zuschneiden).
