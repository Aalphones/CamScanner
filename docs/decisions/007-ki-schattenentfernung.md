# 007 — KI-Schattenentfernung über eine Verstärkungskarte

**Status:** Akzeptiert
**Datum:** 2026-10-08

## Kontext

Der Schalter „Schatten entfernen“ im Filter-Bildschirm soll harte Schlagschatten (Hand, Handy) entfernen, die der klassische Hintergrund-Ausgleich aus ADR-006 nicht sauber trifft. Dafür läuft DocShadow (SD7K-Gewichte, ONNX-Export von fabio-sim) im Browser über `onnxruntime-web`. Das Modell nimmt Bilder beliebiger Größe (Ein- und Ausgang `[1, 3, H, W]`, Werte 0..1, Opset 12), ist aber auf 256 × 256 trainiert; Seiten haben bis zu 12 MP. Die Original-Datei ist 120 MB groß (float32).

## Optionen

- **Modell-Ausgang auf volle Größe hochskalieren** — billig, aber das Modell sieht die Seite nur in 256 × 256; hochskaliert wird die Schrift unscharf.
- **Kacheln** — volle Auflösung durchs Modell, in überlappenden Kacheln. Bei 12 MP Hunderte Modellläufe pro Seite, auf dem Handy Minuten.
- **Verstärkungskarte** — das Modell läuft auf 256 × 256; je Pixel und Farbkanal wird `gain = (out + ε) / (in + ε)` gebildet (`ε = 1/255`, Ausgang vorher auf 0..1 begrenzt), mit `GaussianBlur` σ = 2 geglättet, mit `INTER_CUBIC` auf volle Größe gebracht und mit dem Original multipliziert. Schatten sind niederfrequent: die Karte trägt die Beleuchtung, die Schrift kommt unverändert aus dem Original.

## Entscheidung

Verstärkungskarte. `core/ml/doc-shadow.ts` lädt Laufzeit und Modell erst beim ersten Einschalten, rechnet die Karte einmal pro begradigter Seite (`WeakMap` auf das `warped`-Blob) und gibt sie als Float-Feld zurück. `core/image-filters.ts` wendet sie in `renderFiltered` vor dem gewählten Filter an — Vorschau, Chip-Bilder und Vollbild nutzen dieselbe Karte. Bei voller Auflösung rechnet die Multiplikation in 16-Bit-Festkomma (Faktor 4096) statt Float: halber Speicher, die Stufen bleiben unsichtbar fein.

Das Modell wird auf fp16 umgewandelt (`scripts/convert-fp16.py`, Ein- und Ausgang bleiben float32): 62 MB statt 120 MB. Gemessen mit `onnxruntime-web` 1.30 auf dem WASM-Backend (Entwicklungsrechner, ein Thread, 256 × 256): Abweichung zum float32-Modell höchstens 0,48/255, im Mittel 0,05/255; Laufzeit 0,7 s statt 0,55 s.

## Konsequenzen

- Das Modell liegt nicht im Git. `npm run fetch-models` lädt die Original-Datei, prüft die SHA-256, wandelt per `uv` mit gepinnten Paketversionen um und prüft auch die Prüfsumme des Ergebnisses (die Umwandlung ist reproduzierbar). `deploy.cmd` bricht ohne Modell ab.
- Erstes Einschalten lädt rund 70 MB (Modell 62 MB plus WebAssembly-Laufzeit, komprimiert 7 MB). Der Service Worker hält beides danach offline vor (Asset-Gruppe `ml`, lazy); ohne Einschalten lädt die App nichts davon, auch nicht den ORT-JavaScript-Chunk.
- Lizenz: Code und Gewichte stehen unter MIT (DocShadow-SD7K, Nick Chen; ONNX-Export, Fabio M. Sim). Der Hinweis wird unter `licenses/docshadow.txt` mit ausgeliefert.
- `.htaccess` setzt `Cross-Origin-Opener-Policy: same-origin` und `Cross-Origin-Embedder-Policy: require-corp`, damit ORT mehrere Threads nutzen darf. Ob Strato die Header durchreicht, prüft der User nach dem Deploy (Konsole: `crossOriginIsolated`); ohne sie läuft ORT von selbst einfädig.
- Ausführung: WebGPU, falls der Browser es anbietet, sonst WASM.
