# Phase 3 — Begradigen verlustärmer

## Kontext

- `src/app/core/perspective.ts` (ganz)
- `docs/decisions/005-page-buffer-modell.md` (Seiten als JPEG-Blobs im Arbeitsspeicher)
- Fehlerklassen geprüft: keine einschlägig.

## Chesterton

- `cv.INTER_LINEAR` im `warpPerspective`: schnellste brauchbare Interpolation. Weicht, weil die Begradigung einmal pro Seite läuft und Schriftkanten bei bikubischer Interpolation sichtbar schärfer bleiben.
- `WARPED_IMAGE_QUALITY = 0.92`: Kompromiss Größe/Qualität. Das begradigte Bild ist aber nur ein Zwischenstand — der Filter liest es und komprimiert erneut; jeder Durchgang kostet Schärfe.

## Entscheidungen

- **`cv.INTER_CUBIC`** statt `INTER_LINEAR` (in OpenCV.js vorhanden, Wert 2; Lanczos wäre langsamer bei kaum sichtbarem Unterschied).
- **JPEG 0,97** statt 0,92 fürs begradigte Bild. Verlustfrei (PNG) wäre bei 12 MP rund fünfmal so groß und liegt pro Seite dauerhaft im Page Buffer — zu teuer für viele Seiten.

## AK

1. `warp` nutzt `cv.INTER_CUBIC` und liefert `image/jpeg` mit Qualität 0,97.

## Checkliste

- [ ] `perspective.ts`: `WARPED_IMAGE_QUALITY = 0.97` mit Doc-Kommentar `/** Zwischenstand vor dem Filter, der noch einmal komprimiert — hier wenig verlieren. PNG wäre rund fünfmal so groß und liegt pro Seite im Page Buffer. */`
- [ ] `warpPerspective`-Aufruf: `cv.INTER_LINEAR` → `cv.INTER_CUBIC`; Kommentar darüber: `// Bikubisch: Schriftkanten bleiben schärfer als linear; läuft nur einmal pro Seite.`
- [ ] `docs/code-map.md`, Zeile `core/perspective.ts`: „…(OpenCV-Perspektivtransformation, bikubisch), liefert JPEG 0,97“.
- [ ] `npm run lint`, `npm run build`, `npm test`.

## Report-Back
