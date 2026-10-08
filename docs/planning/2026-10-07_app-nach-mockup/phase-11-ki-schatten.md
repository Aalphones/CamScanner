# Phase 11 — KI-Schattenentfernung

**Rating:** heikel — neue Laufzeit (`onnxruntime-web`), großes Modell-Asset, Header auf Strato, Vor- und Nachverarbeitung je Modell, Offline-Verhalten.

Ergebnis: Im Filter-Bildschirm steht der Schalter „Schatten entfernen“ (Mockup-Figur 3). Eingeschaltet lädt die App einmalig das DocShadow-Modell und entfernt Schlagschatten, bevor der gewählte Filter greift.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`removeShadow`, `FilterSettings.removeShadow`)
- `artifacts/camscanner-mockup.html` — Figur 3, Klassen `.toggle`, `.sw`
- `docs/concept.md` Kapitel 12 (ganz, besonders 12.2, 12.3, 12.5, 12.7)
- `docs/PROJECT.md` — Constraints (Cross-Origin-Isolation), Offene Fragen
- `src/app/core/image-filters.ts`, `features/filter/`, `ngsw-config.json`, `public/.htaccess`, `angular.json`, `deploy.cmd`
- Skill `mode-dependencies` vor `npm install`
- Vault-Fehlerklassen: `sprachen/typescript.md` (`fetch` wirft nicht bei HTTP-Fehlerstatus — beim Modell-Download `response.ok` prüfen)

## Schritt 0 — Torprüfung (vor jedem Code)

Ergebnisse in `FINDINGS.md` und ADR-007 festhalten.

1. **Modell:** Quelle `fabio-sim/DocShadow-ONNX-TensorRT` (laut Konzept). Lizenz der Gewichte lesen (DocShadow-Original und ONNX-Export), Dateigröße, Eingabe-/Ausgabeform und Wertebereich bestimmen (Konzept vermutet 256 × 256, `[0,1]`, NCHW). Ist die Lizenz für eine öffentlich ausgelieferte private App nicht eindeutig erlaubt → **anhalten, 🔴 an den User**, keine Umgehung.
2. **Header:** in `public/.htaccess` testweise `Header set Cross-Origin-Opener-Policy "same-origin"` und `Header set Cross-Origin-Embedder-Policy "require-corp"` im `mod_headers`-Block, deployen (User), im Handy-Browser `crossOriginIsolated` in der Konsole (Remote-Debugging) bzw. per Anzeige im Entwicklungsbuild prüfen. `true` → Header bleiben, ORT darf Threads nutzen. `false` → Header wieder raus, ORT einfädig (`ort.env.wasm.numThreads = 1`).
3. **Strato-Dateigröße:** eine Testdatei in Modellgröße per `deploy.cmd` hochladen und per `curl -I` auf `Content-Length` und `Content-Type` prüfen.

## Entscheidungen (nicht neu verhandeln, sofern Schritt 0 besteht)

- **Nur DocShadow.** DocAligner bleibt außen vor (kein Design, nicht beauftragt).
- **ADR-007 Verstärkungskarte:** Das Modell läuft auf 256 × 256. Statt dessen Ausgang hochzuskalieren (macht Text unscharf), wird je Farbkanal eine Verstärkung `gain = (out + ε) / (in + ε)` auf 256 × 256 berechnet (`ε = 1/255`), mit `GaussianBlur` σ = 2 geglättet, mit `INTER_CUBIC` auf die volle Größe gebracht und mit dem Original multipliziert (Werte auf 0…255 begrenzt). Schatten sind niederfrequent — die Karte trägt sie, die Schrift bleibt scharf.
- **Reihenfolge:** `renderFiltered` ruft bei `settings.removeShadow` zuerst `removeShadow(warped)`, dann den gewählten Filter. Vorschau (1200 px) und Chip-Bilder nutzen dieselbe Kette; das Ergebnis der Schattenentfernung wird pro Entwurf zwischengespeichert (Map auf das `warped`-Blob), damit Reglerbewegungen das Modell nicht erneut laufen lassen.
- **Modell-Datei** `public/models/docshadow.onnx`, **nicht** im Git (`.gitignore`), geholt per `npm run fetch-models` (`scripts/fetch-models.mjs`: URL und SHA-256 als Konstanten aus Schritt 0, Prüfsumme nach dem Download vergleichen, bei Abweichung Datei löschen und mit Fehler enden). `deploy.cmd` prüft vor dem Upload, dass die Datei existiert, sonst Abbruch mit Hinweis auf `npm run fetch-models`.
- **ORT-Laufzeit:** `onnxruntime-web` per dynamischem `import()` erst beim Einschalten. WASM-Dateien über `angular.json`-Asset `{ "glob": "ort-wasm*.{wasm,mjs}", "input": "node_modules/onnxruntime-web/dist", "output": "ort" }`; `ort.env.wasm.wasmPaths = new URL('ort/', document.baseURI).href`. Ausführung: `webgpu`, falls `navigator.gpu`, sonst `wasm`.
- **Service Worker:** neue Asset-Gruppe `ml` mit `installMode: "lazy"`, `updateMode: "lazy"`, Dateien `/models/**` und `/ort/**` — einmal geladen, danach offline verfügbar, kein Vorab-Download für alle.
- **Laden mit Fortschritt:** Modell per `fetch` mit `response.ok`-Prüfung und Lesen des Streams (Fortschritt aus `Content-Length`), dann `InferenceSession.create(arrayBuffer)`. Sitzung einmal erstellen und behalten.
- **Schalter-Texte:** „Schatten entfernen“, darunter klein „Lädt KI-Modell · einmalig ca. N MB“ (N = gemessene Größe aus Schritt 0, gerundet). Während des Ladens „Lädt … 40 %“. Ist das Modell schon geladen: „KI-Modell ist geladen“. Fehler → Schalter zurück auf aus, Toast „KI-Modell konnte nicht geladen werden — Internet nötig beim ersten Mal“.
- **Speichern:** `removeShadow` ist Teil von `FilterSettings` und wird mit der Seite gespeichert; Bearbeiten zeigt den Schalter entsprechend.

## Struktur & Maße (Abnahme-Punkte, Mockup-Figur 3)

- Zeile unter den Reglern im Panel: links Text `.8rem`, darunter Untertitel `.7rem` `--cam-muted`; rechts Schalter 42 × 24, Pillenform, aus `--cam-line`, an `--cam-accent`, Knopf 18 px weiß, 3 px Rand innen, Weg 18 px. Umgesetzt als `<button role="switch" aria-checked>`.

## Abnahme-Kriterien

- Schritt 0 ist dokumentiert (Lizenz, Größe, Eingabeform, `crossOriginIsolated`-Ergebnis).
- Seite mit hartem Handschatten: mit Schalter ist der Schatten deutlich schwächer; Text ist nicht weicher als ohne Schalter (Smoke-Punkt 7).
- Erstes Einschalten zeigt Fortschritt; danach ist das Modell auch im Flugmodus verfügbar.
- Ohne Einschalten lädt die App weder Modell noch ORT (Netzwerk-Tab).
- Start-Bundle bleibt unter der 500-kB-Warnschwelle.
- Schalter aus → Ergebnis identisch mit Phase 8.

## Checkliste

- [x] Schritt 0 (siehe oben), Ergebnisse festhalten. *Punkt 1 erledigt; Punkte 2 und 3 (Header, Dateigröße auf Strato) brauchen den Deploy durch den User — offen in FINDINGS.*
- [x] `docs/decisions/007-ki-schattenentfernung.md` (Kontext / Optionen: Ausgang hochskalieren · Kacheln · Verstärkungskarte / Entscheidung / Konsequenzen: Modell nicht im Git, Header-Ergebnis).
- [x] `npm install onnxruntime-web` (nach `mode-dependencies`).
- [x] `scripts/fetch-models.mjs`, `package.json`-Skript `fetch-models`, `.gitignore` `public/models/`, Prüfung in `deploy.cmd`.
- [x] `angular.json` Asset-Eintrag für ORT; `ngsw-config.json` Gruppe `ml`; `public/.htaccess` laut Schritt 0.
- [x] `core/ml/doc-shadow.ts` (`ng generate service core/ml/doc-shadow`): Laden, Sitzung, `removeShadow` mit Verstärkungskarte; OpenCV-Teile mit `MatScope`.
- [x] `core/image-filters.ts`: `removeShadow` vor dem Filter, Zwischenspeicher pro `warped`-Blob.
- [x] `features/filter`: Schalter nach „Struktur & Maße“ und Entscheidungen.

## Doc-Updates

- [x] `docs/PROJECT.md`: offene Frage „Cross-Origin-Isolation-Header auf Strato“ mit dem Ergebnis aus Schritt 0 schließen.
- [x] `docs/code-map.md`: `core/ml/doc-shadow.ts`, `public/models/` (nicht im Git, `npm run fetch-models`), `scripts/fetch-models.mjs`.
- [x] `AGENTS.md` Quickstart: `npm run fetch-models   # KI-Modell holen (vor dem ersten Deploy)`.
- [x] `docs/glossary.md`: „Verstärkungskarte (Gain Map)“.

## Report-Back

- **Abweichung (User-Entscheidung):** Modell auf fp16 umgewandelt, 62 MB statt 120 MB; `fetch-models` wandelt per `uv` um und prüft beide Prüfsummen. Schalter-Text nennt „ca. 70 MB“ (Modell plus komprimierte Laufzeit).
- **Abweichung (Kontrakt):** `DocShadow` liefert `gainMap(warped)` statt `removeShadow(Blob)`; die Karte wird in `image-filters.ts` angewendet — kein JPEG-Umweg, ein Modelllauf je Seite für Vorschau, Chips und Vollbild. README nachgezogen.
- Multiplikation bei voller Auflösung in 16-Bit-Festkomma statt Float (Speicher).
- `namedChunks` in der Produktion an, damit der ORT-Chunk aus dem Prefetch ausgenommen werden kann.
- Header COOP/COEP stehen in `.htaccess`; Wirkung auf Strato ungeprüft.
- Nicht geprüft: Lauf im echten Browser (WebGPU-Pfad, Laden über den Service Worker) — nur WASM in Node gemessen.
