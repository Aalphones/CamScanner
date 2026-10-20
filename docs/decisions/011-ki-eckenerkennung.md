# 011 — KI-Eckenerkennung mit DocAligner fürs Standbild

**Status:** Akzeptiert
**Datum:** 2026-10-20

## Kontext

Die automatische Blatterkennung in `core/document-detection.ts` sucht Helligkeitssprünge mit festen Canny-Grenzen (75/200) und nimmt nur Umrisse, die exakt zu vier Ecken zerfallen. Ein weißes Blatt auf hellem Tisch hat keinen Sprung, ein Muster im Untergrund zerreißt den Umriss. Gemessen (Desktop-CPU, Python-Nachbau, 120 synthetische Handyfotos mit bekannten Ecken, je 30 auf dunklem Tisch / hellem Tisch / Muster / Holztisch mit Gegenständen; Fehler = größte Eckabweichung in % der Bilddiagonale):

| Weg | kein Viereck | Fehler < 2 % | Fehler ≥ 5 % | Median-Fehler |
|---|---|---|---|---|
| OpenCV (bisher) | 68 / 120 — heller Tisch 30 / 30, Muster 25 / 30 | 50 | 1 | 0,11 % |
| DocAligner `lcnet100` allein | 11 / 120 | 104 | 4 | 0,34 % |
| DocAligner + OpenCV-Feinlage | 11 / 120 | 104 | 4 | 0,23 % |

## Optionen

- **OpenCV nachschärfen** — automatische Canny-Grenzen, Sättigungskanal, Kandidaten bewerten. Hilft bei schwachem Kontrast, nicht bei hellem Blatt auf hellem Tisch ohne jede Kante.
- **DocAligner `fastvit_t8`** — 13 MB, in der Messung schlechter (33 Bilder ohne Viereck).
- **DocAligner `lcnet100` plus OpenCV-Feinlage** — 4,8 MB, KI als Hauptweg; finden beide dasselbe Blatt, zählen die genaueren OpenCV-Ecken.

## Entscheidung

DocAligner `lcnet100` in fp32 (4,8 MB, keine Umwandlung), nur fürs Standbild auf dem Zuschneiden-Bildschirm, nur WASM. `DocumentDetection.detectStill` rechnet beide Wege: liegen KI- und OpenCV-Ecken je Ecke höchstens 3 % der Bilddiagonale auseinander, gewinnt OpenCV, sonst die KI; ohne KI-Ergebnis oder bei einem Fehler der KI bleibt es beim OpenCV-Ergebnis. Die Heatmap (4 Kanäle, 128 × 128) wird wie beim Hersteller ausgewertet — Schwelle 0,3, größte zusammenhängende Fläche, deren gewichteter Schwerpunkt ist die Ecke —, aber direkt auf dem Gitter statt auf hochskalierter Heatmap.

## Konsequenzen

- Der erste Scan lädt die Laufzeit (~7 MB komprimiert) und das Modell (~5 MB); die Aufnahme-Ansicht wärmt beides vor, während der User zielt. Danach offline über die Asset-Gruppe `ml`.
- Modell-Quelle ist Google Drive (Original-Ablage der Autoren) — kann ausfallen oder bei Kontingent-Sperre eine HTML-Seite liefern. `npm run fetch-models` prüft die SHA-256 und löscht eine falsche Datei; `deploy.cmd` bricht ohne Modell ab.
- Die Live-Vorschau im Sucher bleibt bei OpenCV, auf hellem Tisch also weiterhin ohne Live-Rahmen. KI dort erst nach einer Zeitmessung am Handy.
- Lizenz Apache-2.0 (DocsaidLab); der Hinweis wird unter `licenses/docaligner.txt` mit ausgeliefert.
