# Phase 5 — S/W mit lokalem Schwellwert (Sauvola)

## Kontext

- `src/app/core/image-filters.ts` (ganz; Fall `'bw'` in `applyFilter`, `backgroundDivide`, Konstanten-Block oben)
- `src/app/features/filter/filter.ts` (`PREVIEW_EDGE = 1200`, `CHIP_EDGE = 160` — Vorschauen werden verkleinert gerechnet)
- `docs/decisions/006-filter-pipeline.md`
- `docs/glossary.md` (Einträge **Sauvola / Niblack**, **Otsu** existieren)
- Fehlerklassen geprüft: keine einschlägig.

## Chesterton

- `cv.threshold(… THRESH_OTSU)` wählt einen Schwellwert fürs ganze Bild. Nach `backgroundDivide` ist das Papier gleichmäßig hell, daher funktioniert Otsu ordentlich — verliert aber blasse Striche, weil der globale Wert zwischen Papier und kräftiger Schrift landet.
- Die `GaussianBlur` mit `BW_BLUR_KERNEL` davor bleibt: sie verhindert Sprenkel aus Papierrauschen.

## Entscheidungen

- Formel: Schwelle `T = m · (1 + k · (s / R − 1))` mit lokalem Mittel `m` und Standardabweichung `s` im Fenster; Pixel `> T` → weiß.
- `SAUVOLA_K = 0.2`, `SAUVOLA_R = 128`. Mit k = 0,2 liegt die Schwelle auf flachem Papier (≈ 255) bei rund 204 — Bleistift (≈ 150–190) wird schwarz, Papierrauschen nach der Hintergrund-Division nicht.
- Fenster relativ zur Bildgröße: `SAUVOLA_WINDOW_RATIO = 0.02` der langen Kante (4000 px → 81, 1200 px → 25, ungerade, mindestens 3). So sehen Vorschau und gespeicherte Seite gleich aus.
- Statistik ab 1000 px langer Kante auf halber Auflösung (`SAUVOLA_STATS_MIN_EDGE = 1000`), Schwellbild danach linear hochskaliert: spart drei Viertel des Float-Speichers; Mittel und Streuung über ein 40-px-Fenster ändern sich nur langsam.

## AK

1. Look S/W rechnet nach `backgroundDivide` und Glättung Sauvola statt Otsu; Ergebnis bleibt einkanalig 0/255.
2. Vorschau (1200 px) und gespeicherte Seite zeigen dieselbe Schrift (gleiche Strichdicke im Rahmen der Skalierung).

## Checkliste

- [x] Konstanten in `image-filters.ts` nach `BW_BLUR_KERNEL`, je mit Doc-Kommentar:
  - `SAUVOLA_WINDOW_RATIO = 0.02` — `/** Fenster für die lokale Schwelle als Anteil der langen Kante — gleiche Wirkung in Vorschau und Vollbild. Etwa zwei Zeilenhöhen normaler Schrift. */`
  - `SAUVOLA_K = 0.2` — `/** Wie weit die Schwelle unter das lokale Mittel rutscht: kleiner hält blasse Schrift, größer macht das Papier sauberer. */`
  - `SAUVOLA_R = 128` — `/** Größte erwartete Streuung bei 8 Bit (Standardwert des Verfahrens). */`
  - `SAUVOLA_STATS_MIN_EDGE = 1000` — `/** Ab dieser langen Kante Mittel und Streuung auf halber Auflösung schätzen — spart Speicher, ändert das Ergebnis nicht sichtbar. */`
- [x] Fall `'bw'`: `cv.threshold(… THRESH_OTSU)` ersetzen durch `this.sauvola(cv, image, scope);`
- [x] Private Methode `sauvola(cv: OpenCv, gray: Mat, scope: MatScope): void`, Doc-Kommentar `/** Lokaler Schwellwert nach Sauvola: jede Stelle wird an ihrer Umgebung gemessen, nicht am ganzen Blatt — blasse Striche bleiben schwarz. */`. Ablauf (alle Mats per `scope.track`):
  1. `longEdge = Math.max(gray.cols, gray.rows)`, `statsScale = longEdge >= SAUVOLA_STATS_MIN_EDGE ? 2 : 1`.
  2. `small`: bei `statsScale === 2` `cv.resize(gray, small, new cv.Size(Math.round(gray.cols / 2), Math.round(gray.rows / 2)), 0, 0, cv.INTER_AREA)`, sonst `gray.copyTo(small)`. Dann `small.convertTo(small, cv.CV_32F)`.
  3. `window = this.oddAtLeast3(Math.round(longEdge * SAUVOLA_WINDOW_RATIO / statsScale))`; Hilfsmethode `oddAtLeast3(n)` = `Math.max(3, n % 2 === 0 ? n + 1 : n)`.
  4. `mean`: `cv.boxFilter(small, mean, cv.CV_32F, new cv.Size(window, window), new cv.Point(-1, -1), true, cv.BORDER_REPLICATE)`.
  5. `squared`: `cv.multiply(small, small, squared)`; `meanSquared`: `boxFilter` wie 4 auf `squared`.
  6. `variance`: `cv.multiply(mean, mean, meanPow)`, `cv.subtract(meanSquared, meanPow, variance)`, `cv.threshold(variance, variance, 0, 0, cv.THRESH_TOZERO)` (Rundungsfehler unter 0 abschneiden), `cv.sqrt(variance, deviation)`.
  7. `factor`: `deviation.convertTo(factor, cv.CV_32F, SAUVOLA_K / SAUVOLA_R, 1 - SAUVOLA_K)`; Schwelle `cv.multiply(mean, factor, limit)`.
  8. Bei `statsScale === 2`: `cv.resize(limit, limit, new cv.Size(gray.cols, gray.rows), 0, 0, cv.INTER_LINEAR)`.
  9. `full`: `gray.convertTo(full, cv.CV_32F)`; `cv.subtract(full, limit, full)`; `cv.threshold(full, full, 0, 255, cv.THRESH_BINARY)`; `full.convertTo(gray, cv.CV_8U)`.
- [x] Doc-Kommentar über der Klasse bzw. `renderFiltered` unverändert lassen; Kommentar im Fall `'bw'` (falls vorhanden) auf Sauvola anpassen.
- [x] `docs/decisions/006-filter-pipeline.md`, Abschnitt Konsequenzen: Zeile `- Nachtrag: S/W trennt seit dem Plan „Scan-Qualität“ mit Sauvola (lokaler Schwellwert, Fenster 2 % der langen Kante) statt Otsu; Statistik ab 1000 px auf halber Auflösung.`
- [x] `docs/code-map.md`, Zeile `core/image-filters.ts`: „Otsu“ → „Sauvola“.
- [x] `npm run lint`, `npm run build`, `npm test`.

## Report-Back

Umgesetzt wie geplant, keine Abweichung. Lint, Build, Tests grün (9 Tests). Wirkung auf echten Fotos ungeprüft — das ist die Smoke-Prüfung (Punkt 3).
