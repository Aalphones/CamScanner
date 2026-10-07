# Phase 7 — Filter-Rechenwerk

**Rating:** heikel — Bildverarbeitungs-Algorithmen in OpenCV.js, Speicherdisziplin, Laufzeit auf 12-MP-Bildern.

Ergebnis: `core/image-filters.ts` rechnet die fünf Scan-Looks aus Mockup-Figur 3 (Original, Auto, Scan, S/W, Grau) plus Kontrast und Helligkeit. Damit das ohne eigenen Bildschirm prüfbar ist, bekommt jede neu übernommene Seite in dieser Phase automatisch den Filter „Auto“ — sichtbar in der Seitenübersicht und im PDF.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`FilterSettings`, `renderFiltered`)
- `src/app/core/mat-scope.ts`, `perspective.ts` (Muster: Blob → ImageData → Mat → Blob), `opencv-loader.ts`, `page-factory.ts`, `filter-settings.ts`
- `docs/concept.md` Kapitel 4.4 und 12.8 (Background Division, CLAHE, Otsu, Unsharp Mask)
- `docs/glossary.md` — Einträge Background Division, CLAHE, Otsu, Unsharp Mask
- Vault-Fehlerklassen: `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **ADR-006:** Filter laufen mit OpenCV.js auf dem Haupt-Thread (ein Web Worker hieße, die 13-MB-OpenCV-Datei ein zweites Mal zu laden). Vorschauen werden verkleinert gerechnet (`maxEdge`), volle Auflösung nur beim Übernehmen.
- **Ablauf in `renderFiltered(warped, settings, maxEdge?)`:** Blob → `createImageBitmap` → bei `maxEdge` verkleinert auf `OffscreenCanvas` → `ImageData` → `cv.matFromImageData` (RGBA) → Filter → Kontrast/Helligkeit → zurück nach RGBA → `ImageData` → `OffscreenCanvas` → JPEG 0.92. Ein `MatScope` pro Aufruf, Freigabe im `finally`.
- **Bausteine** (private Funktionen, Konstanten benannt am Dateikopf):
  - `backgroundDivide(gray)`: Graubild auf 1/4 verkleinern (`INTER_AREA`, `BG_DOWNSCALE = 4`), `morphologyEx(MORPH_CLOSE)` mit Ellipse 9 × 9 (`BG_CLOSE_KERNEL`, entfernt Schriftstriche), `medianBlur` 21 (`BG_MEDIAN_KERNEL`), zurück auf volle Größe (`INTER_LINEAR`), `cv.divide(gray, background, out, 255)`.
  - `clahe(gray, clipLimit)`: `new cv.CLAHE(clipLimit, new cv.Size(8, 8))`, `apply`, `delete`. **Erster Schritt der Phase:** prüfen, dass `typeof cv.CLAHE === 'function'` zur Laufzeit gilt (der Typ steht in `_hacks.d.ts`, das Symbol im Bundle). Fehlt es: Ersatz `cv.equalizeHist` und Eintrag in `FINDINGS.md`.
  - `unsharp(mat, sigma, amount)`: `GaussianBlur(mat, blur, new cv.Size(0, 0), sigma)`, `addWeighted(mat, 1 + amount, blur, -amount, 0, out)`.
- **Die fünf Filter:**
  - `original`: unverändert.
  - `auto` (Farbe bleibt): RGBA → RGB → Lab; L-Kanal: `backgroundDivide`, dann `clahe(2.0)`; zurück nach RGB; `unsharp(1.5, 0.5)`.
  - `scan`: Grau; `backgroundDivide`; `clahe(2.5)`; `unsharp(1.5, 0.8)`.
  - `bw`: Grau; `backgroundDivide`; `GaussianBlur 3 × 3`; `threshold(…, 0, 255, THRESH_BINARY + THRESH_OTSU)`.
  - `gray`: Grau; `clahe(2.0)`.
- **Kontrast/Helligkeit** zuletzt, nur wenn nicht beide 50: `alpha = 0.5 + contrast / 100` (0,5 … 1,5), `beta = (brightness − 50) · 1.2` (−60 … +60), `mat.convertTo(out, -1, alpha, beta)`.
- **Zwischenschritt dieser Phase:** `createPage` setzt `filter = DEFAULT_FILTER_SETTINGS` (= `auto`) und `output = await renderFiltered(warped, filter)`. Phase 8 ersetzt das durch die Wahl im Filter-Bildschirm.

## Abnahme-Kriterien

- Jede neu übernommene Seite erscheint in Übersicht und PDF mit dem Auto-Look: Papier gleichmäßig hell, Schatten deutlich schwächer, Farben erhalten.
- Für die Prüfung einmalig (vor dem Commit wieder auf `auto`): `DEFAULT_FILTER_SETTINGS.filter` nacheinander auf `scan`, `bw`, `gray`, `original` stellen und je eine Seite scannen — jede sieht anders und plausibel aus; `bw` ist reines Schwarz-Weiß und lesbar.
- 12-MP-Seite in voller Auflösung in unter 3 Sekunden gefiltert (Messung mit `performance.now()` während der Entwicklung, vor dem Commit entfernen, Wert im Report-Back notieren).
- 20 Filterläufe hintereinander ohne wachsenden Speicher im Task-Manager des Browsers (alle Mats freigegeben).

## Checkliste

- [ ] Laufzeitprüfung `cv.CLAHE` (siehe Entscheidungen).
- [ ] `docs/decisions/006-filter-pipeline.md` (Kontext / Optionen: Canvas-`filter`-CSS · OpenCV Haupt-Thread · OpenCV im Worker / Entscheidung / Konsequenzen: UI blockiert während des Voll-Renderns kurz, deshalb Zustand „Speichert …“ in Phase 8).
- [ ] `ng generate service core/image-filters` → `renderFiltered` mit Bausteinen und Filtern laut Entscheidungen; Konstanten mit Kommentar je Zweck (Stil wie `document-detection.ts`).
- [ ] `core/page-factory.ts`: Zwischenschritt laut Entscheidungen.

## Doc-Updates

- [ ] `docs/code-map.md`: Core-Zeile `image-filters.ts`.
- [ ] `docs/glossary.md`: „Filter (Scan-Look)“ mit den fünf Namen und je einem Satz, was sie tun; „Background Division“ um die konkreten Schritte ergänzen.

## Report-Back
