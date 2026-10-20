# Plan — KI-Eckenerkennung (DocAligner)

Die automatische Blatterkennung findet auf hellem Untergrund gar nichts und auf gemustertem fast nichts. Ursache: `core/document-detection.ts` sucht Helligkeitssprünge mit festen Canny-Grenzen (75/200) und nimmt nur Umrisse, die exakt zu vier Ecken zerfallen. Weißes Blatt auf hellem Tisch hat keinen Sprung, ein Muster zerreißt den Umriss. Dieser Plan setzt das KI-Modell DocAligner (Variante `lcnet100`, 4,8 MB, Apache-2.0) vor die bestehende Erkennung — für das Standbild auf dem Zuschneiden-Bildschirm. Die Live-Vorschau im Sucher bleibt bei OpenCV.

**Messung (vor dem Plan, Desktop-CPU, Python-Nachbau beider Wege, 120 synthetische Handyfotos mit bekannten Ecken, je 30 auf dunklem Tisch / hellem Tisch / Muster / Holztisch mit Gegenständen; Fehler = größte Eckabweichung in % der Bilddiagonale):**

| Weg | kein Viereck | Fehler < 2 % | Fehler ≥ 5 % | Median-Fehler |
|---|---|---|---|---|
| heute (OpenCV) | 68 / 120 — heller Tisch 30 / 30, Muster 25 / 30 | 50 | 1 | 0,11 % |
| DocAligner allein (wie in Phase 2 gebaut) | 11 / 120 | 104 | 4 | 0,34 % |
| **Kombination (Phase 2)** | **11 / 120** | **104** | **4** | **0,23 %** |

`fastvit_t8` (13 MB) war schlechter (33 ohne Viereck) und fällt raus. RGB- und BGR-Eingang lieferten gleiche Werte. Die Szenen sind synthetisch (gedruckte Seite perspektivisch auf erzeugten Untergrund, Verlauf, Schlagschatten, Rauschen, JPEG) — echte Fotos sind die Wackelstelle Nr. 1 der Smoke-Checkliste.

**Nicht in diesem Plan:** KI in der Live-Vorschau (erst nach Handy-Zeitmessung, Follow-up) · Ecken auf voller Auflösung nachziehen (das macht Phase 4 des Plans `2026-10-19_scan-qualitaet` — sie setzt auf dem Ergebnis dieses Plans auf und gleicht die gröbere KI-Genauigkeit aus).

**Verhältnis zu den geparkten Plänen:** `2026-10-19_scan-qualitaet` fasst `document-detection.ts` und `crop.ts` ebenfalls an (Phase 4: neue Methode `refine`, Aufruf in `runDetection`). Beide Änderungen sind additiv und kollidieren nicht, wer zuerst läuft, ist egal; wer als Zweiter läuft, liest die Datei vorher neu. ADR-Nummern: auf Platte 001–007, reserviert 008 (`speichern-robust`), 009 und 010 (`scan-qualitaet`). Dieser Plan nimmt **ADR-011**.

Profil `private`: keine neuen automatisierten Tests. Nach jeder Phase `npm run lint`, `npm run build`, `npm test` (bestehende Tests) grün. Fehlerklassen geprüft: im Vault keine Entity für Angular, TypeScript, onnxruntime-web oder OpenCV vorhanden.

## Phasen

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | Modell bereitstellen, KI-Laufzeit teilen | standard | complete |
| 2 | DocAligner-Erkennung und Einbau | heikel | complete |

## Kontrakt

```ts
// core/ml/ort-runtime.ts  (Phase 1, neu)
@Service() export class OrtRuntime {
  load(): Promise<Ort>;                       // einmal laden, wasmPaths setzen; bei Fehler darf der nächste Aufruf neu versuchen
}
export type Ort = typeof import('onnxruntime-web');

// core/ml/doc-aligner.ts  (Phase 2, neu)
@Service() export class DocAligner {
  load(): Promise<void>;                      // Laufzeit + Modell vorwärmen, wirft bei Fehler
  detect(source: ImageBitmap): Promise<Quad | null>;   // Ecken in Original-Koordinaten oder null
}

// core/document-detection.ts  (Phase 2, neue öffentliche Methode; detect() bleibt unverändert für die Live-Vorschau)
detectStill(source: ImageBitmap): Promise<Quad | null>;
```

## Finale AK

1. Weißes Blatt auf hellem Tisch: Der Zuschneiden-Bildschirm zeigt nach der Aufnahme einen Rahmen auf den Blattecken statt „Keine Blattkanten erkannt“.
2. Weißes Blatt auf dunklem Tisch: Der Rahmen liegt mindestens so genau wie heute (die Kombination nimmt dort die OpenCV-Ecken).
3. Ist das KI-Modell nicht ladbar (offline beim allerersten Start, Datei fehlt), verhält sich die Erkennung exakt wie heute; Konsole `DocAligner: nicht verfügbar`.
4. „Schatten entfernen“ funktioniert unverändert (gemeinsame Laufzeit).
5. `npm run lint`, `npm run build`, `npm test` grün; `npm run fetch-models` legt `public/models/docaligner.onnx` mit passender Prüfsumme ab; `deploy.cmd` bricht ohne diese Datei ab.

## Smoke-Checkliste (User, Handy)

Wackelstellen zuerst:

1. **Echte Fotos statt synthetischer (Wackelstelle 1):** je eine Seite auf hellem Tisch, auf dunklem Tisch, auf gemustertem Stoff/Teppich, ein Kassenbon, eine Seite schräg von der Seite. Liegt der Rahmen auf den Blattecken? Zählen: wie viele von fünf ohne Nacharbeit brauchbar.
2. **Wartezeit (Wackelstelle 2):** Zeit vom Auslösen bis der Rahmen erscheint. Konsole (PC-Chrome `chrome://inspect`) zeigt `DocAligner: N ms`. Über 1,5 s fühlbar → melden.
3. **Erster Start (Wackelstelle 3):** App frisch (Website-Daten löschen), online öffnen, erste Seite scannen — Rahmen kommt, kein Hänger. Danach Flugmodus, App neu laden, scannen — Rahmen kommt weiterhin (Modell im Offline-Speicher).
4. **Schatten entfernen** im Filter-Bildschirm einschalten — läuft wie vorher.
5. 10 Seiten hintereinander scannen — Tab bleibt stabil.

## Phase 1 — Modell bereitstellen, KI-Laufzeit teilen

### Kontext

- `scripts/fetch-models.mjs` (ganz) — holt heute nur DocShadow; Achtung: Zeile mit `process.exit(0)`, wenn DocShadow schon da ist.
- `deploy.cmd` (Abschnitt `:protocolOk` / `:modelFound`) — bricht ab, wenn `public\models\docshadow.onnx` fehlt.
- `src/app/core/ml/doc-shadow.ts` (ganz) — lädt heute `onnxruntime-web` selbst in `createModel()`.
- `public/licenses/docshadow.txt` (Muster für den Lizenzhinweis), `LICENSE` im Repo-Root (vollständiger Apache-2.0-Text).
- `ngsw-config.json` — Asset-Gruppe `ml` deckt `/models/**` schon ab, **nichts ändern**.
- `docs/decisions/007-ki-schattenentfernung.md` (Modelle nicht im Git, Prüfsummen-Muster).

**Verstanden, bevor es umgebaut wird:** `DocShadow.createModel()` importiert `onnxruntime-web` dynamisch (eigener JS-Chunk, damit die App ohne KI nichts davon lädt), setzt `ort.env.wasm.wasmPaths` auf den selbst gehosteten Ordner `ort/` (offline, kein CDN) und loggt `crossOriginIsolated`. Genau diese drei Dinge wandern nach `OrtRuntime`; der Rest von `createModel()` bleibt in `DocShadow`.

### AK

1. `OrtRuntime.load()` liefert bei mehrfachem Aufruf dieselbe Promise; nach einem Fehler setzt es die Promise zurück, der nächste Aufruf versucht es neu.
2. `DocShadow` nutzt `OrtRuntime` und verhält sich sonst unverändert (Fortschritt, WebGPU-Wahl, Gain-Map).
3. `npm run fetch-models` lädt DocAligner auch dann, wenn DocShadow schon vorhanden ist.

### Checkliste

- [x] Neue Datei `src/app/core/ml/ort-runtime.ts`: `@Service() export class OrtRuntime` mit `private ortPromise: Promise<Ort> | null = null` und `load(): Promise<Ort>` nach dem Muster von `DocShadow.model()` (Promise cachen, im `catch` auf `null` zurücksetzen). Der Lade-Teil: `const ort = await import('onnxruntime-web'); ort.env.wasm.wasmPaths = new URL(ORT_ASSET_DIR, document.baseURI).href; console.info('OrtRuntime: crossOriginIsolated =', globalThis.crossOriginIsolated); return ort;`. Die Konstante `ORT_ASSET_DIR = 'ort/'` samt Doc-Kommentar zieht aus `doc-shadow.ts` hierher um. `export type Ort = typeof import('onnxruntime-web');` steht hier (in `doc-shadow.ts` löschen und importieren). Doc-Kommentar der Klasse: `/** Lädt onnxruntime-web genau einmal für alle KI-Modelle der App — selbst gehostet, erst beim ersten Bedarf. */`
- [x] `doc-shadow.ts`: `private readonly ortRuntime = inject(OrtRuntime);` (Import `inject` aus `@angular/core`). In `createModel()` die drei Zeilen (Import, `wasmPaths`, `console.info`) ersetzen durch `const ort = await this.ortRuntime.load();`. Sonst nichts ändern.
- [x] `scripts/fetch-models.mjs`: Kopfkommentar auf „Holt die KI-Modelle (DocAligner, DocShadow) …“ ändern. Konstanten ergänzen: `ALIGNER_URL = 'https://drive.usercontent.google.com/download?id=1IlbLPkCv-TdaBLOPh_4J97P1_KHYYJ7a&export=download&confirm=t'` (Kommentar: `// DocAligner lcnet100 (Heatmap, 256 px, fp32) — die Original-Ablage der Autoren liegt auf Google Drive.`), `ALIGNER_SHA256 = 'f4117b786e3a18470f3865c93f3c2bd69d9b998edd60f385574a5c665e79594e'`, `alignerTargetPath = join(root, 'public', 'models', 'docaligner.onnx')`. Direkt nach den beiden `mkdirSync`-Aufrufen — die vorher **vor** den DocShadow-Schnellausstieg verschoben werden — einen Block einfügen: ist `alignerTargetPath` vorhanden und stimmt `sha256`, Log `DocAligner ist schon da`; sonst `console.log('Lade DocAligner (5 MB) ...')`, `fetch(ALIGNER_URL)`, bei `!response.ok` → `fail(...)`, schreiben, Prüfsumme prüfen, bei Abweichung Datei löschen und `fail('Prüfsumme von DocAligner stimmt nicht — Datei gelöscht. Google Drive liefert bei Kontingent-Sperre eine HTML-Seite statt des Modells; später erneut versuchen.')`. Keine fp16-Umwandlung. Reihenfolge danach: der bestehende DocShadow-Schnellausstieg und der Rest unverändert.
- [x] `deploy.cmd`: vor `:modelFound` eine zweite Prüfung nach demselben Muster für `public\models\docaligner.onnx` (Sprungmarke `:alignerFound`, Text `[FEHLER] Das KI-Modell fehlt: public\models\docaligner.onnx`). Zeilenenden CRLF beibehalten.
- [x] `public/licenses/docaligner.txt`: Kopf nach Muster `docshadow.txt` — `KI-Modell für die automatische Blatterkennung: DocAligner (Variante lcnet100, Heatmap), unverändert als ONNX ausgeliefert.`, Quelle `https://github.com/DocsaidLab/DocAligner`, `Copyright DocsaidLab`, `Licensed under the Apache License, Version 2.0`, danach der vollständige Lizenztext aus `LICENSE` im Repo-Root (Zeilen ab „Apache License“ bis „END OF TERMS AND CONDITIONS“).
- [x] `npm run fetch-models` ausführen, prüfen: `public/models/docaligner.onnx` existiert, 4 767 987 Bytes.
- [x] `docs/code-map.md`: Zeile `core/ml/ort-runtime.ts` — „Lädt `onnxruntime-web` einmal für alle Modelle (selbst gehostet unter `ort/`)“; Zeile `public/models/` um „und DocAligner (fp32)“ ergänzen; Zeile `public/licenses/docaligner.txt` — „Apache-2.0-Hinweis des Erkennungsmodells“; Zeile zu `fetch-models.mjs` um „DocAligner direkt, ohne Umwandlung“ ergänzen.
- [x] `npm run lint`, `npm run build`, `npm test`.

## Phase 2 — DocAligner-Erkennung und Einbau

### Kontext

- `src/app/core/ml/doc-shadow.ts` — Muster für Modell laden (`downloadModel`, hier ohne Fortschritt), `session.run`, Tensor `dispose`.
- `src/app/core/ml/ort-runtime.ts` (aus Phase 1).
- `src/app/core/document-detection.ts` (ganz) — `detect()` bleibt **unverändert**, die Live-Vorschau ruft es viermal pro Sekunde auf 480-px-Bildern.
- `src/app/core/geometry.ts` — `Point`, `Quad`, `sortQuadCorners`, `isConvexQuad`, `quadArea`, `quadsClose`.
- `src/app/features/crop/crop.ts` (`runDetection`) und `src/app/features/capture/capture.ts` (`ngOnInit`).
- Modell-Fakten (vor dem Plan per `onnxruntime` gemessen): Eingang `img`, `float32 [1, 3, 256, 256]`, RGB, Werte 0..1, Bild ohne Seitenverhältnis-Erhalt auf 256 × 256 gestaucht. Ausgang `heatmap`, `float32 [1, 4, 128, 128]`, Werte 0..1, ein Kanal je Ecke. Auswertung wie beim Hersteller: je Kanal Schwelle 0,3, größte zusammenhängende Fläche, deren Schwerpunkt ist die Ecke.

### AK

1. `DocAligner.detect` liefert für ein Blatt auf hellem Tisch vier sortierte Ecken in Original-Koordinaten.
2. Ein Kanal ohne Fläche über der Schwelle, ein nicht-konvexes Viereck oder eines unter 5 % der Bildfläche → `null`.
3. `detectStill`: Liegen OpenCV- und KI-Ecken je Ecke höchstens 3 % der Bilddiagonale auseinander, gewinnt OpenCV (genauer); sonst KI; ohne KI-Ergebnis OpenCV; ein Fehler der KI (Laden, Lauf) endet nie in einer Ausnahme, sondern im OpenCV-Ergebnis.
4. Konsole je Standbild genau eine Zeile `DocAligner: <ms> ms, Ergebnis <ki|opencv|keins>` bzw. einmalig `DocAligner: nicht verfügbar` + Fehler.

### Checkliste

- [x] Neue Datei `src/app/core/ml/doc-aligner.ts`, `@Service() export class DocAligner`. Konstanten mit Doc-Kommentar:
  - `MODEL_URL = 'models/docaligner.onnx'` — `/** DocAligner lcnet100, erzeugt per \`npm run fetch-models\` (ADR-011). */`
  - `INPUT_SIZE = 256` — `/** Eingangsgröße des Modells; das Bild wird ohne Rand gestaucht, so ist es trainiert. */`
  - `HEATMAP_THRESHOLD = 0.3` — `/** Schwelle des Herstellers: darunter ist eine Heatmap-Zelle keine Ecke. */`
  - `MIN_AREA_RATIO = 0.05` — `/** Kleiner als 5 % des Bildes ist kein Dokument, sondern ein Fehlgriff — Kassenbons liegen darüber. */`
- [x] Felder: `private readonly ortRuntime = inject(OrtRuntime);`, `private sessionPromise: Promise<{ ort: Ort; session: InferenceSession }> | null = null;`. `load()` = `await this.session()`. `private session()` nach Muster `DocShadow.model()` (cachen, im `catch` auf `null`). Anlegen: `const ort = await this.ortRuntime.load();`, Modell per `fetch(new URL(MODEL_URL, document.baseURI))` → bei `!response.ok` `throw new Error(\`DocAligner nicht ladbar: HTTP ${response.status}\`)` → `new Uint8Array(await response.arrayBuffer())` → `ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] })`. Nur WASM: das Modell ist klein, das Anlegen einer WebGPU-Sitzung kostet beim ersten Scan mehr, als der Lauf spart (Kommentar so in den Code).
- [x] `detect(source)`: Eingang per `OffscreenCanvas(INPUT_SIZE, INPUT_SIZE)`, `imageSmoothingQuality = 'high'`, `drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE)`, `getImageData` → CHW-Float32 wie `DocShadow.readModelInput` (RGB, `/255`). Kein 2D-Kontext → `throw`. `session.run({ img: new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]) })`, Ausgang `results['heatmap']`; fehlt er → `throw`. Daten lesen, im `finally` `output.dispose()`. Gittergröße `grid = output.dims[3]` (128). Je Kanal `c` (0..3) `this.peak(data, c, grid)` → `Point | null`; ein `null` → Rückgabe `null`. Punkte auf Original umrechnen: `x = (gx + 0.5) * source.width / grid - 0.5`, analog `y`. Dann `sortQuadCorners(points)`; nicht `isConvexQuad` oder `quadArea < source.width * source.height * MIN_AREA_RATIO` → `null`.
- [x] `private peak(data: Float32Array, channel: number, grid: number): Point | null` — Ebene `offset = channel * grid * grid`. Zusammenhangsflächen über Zellen `> HEATMAP_THRESHOLD` per Flutfüllung mit explizitem Stapel (8er-Nachbarschaft, `Uint8Array` als Besucht-Markierung, keine Rekursion). Je Fläche: Zellenzahl sowie die mit dem Heatmap-Wert gewichteten Summen `Σ w·x`, `Σ w·y`, `Σ w`. Größte Fläche nach Zellenzahl gewinnt, Rückgabe `{ x: Σw·x / Σw, y: Σw·y / Σw }` in Gitterkoordinaten; keine Fläche → `null`. Doc-Kommentar: `/** Schwerpunkt der größten Fläche über der Schwelle — wie die Auswertung des Herstellers, aber auf dem 128er-Gitter statt auf hochskalierter Heatmap (gleiches Ergebnis, ein Bruchteil der Rechenzeit). */`
- [x] `document-detection.ts`: `private readonly docAligner = inject(DocAligner);`, Konstante `AGREEMENT_RATIO = 0.03` — `/** Liegen KI- und OpenCV-Ecken so nah beisammen (Anteil der Diagonale), haben beide dasselbe Blatt gefunden — dann zählt das genauere OpenCV-Ergebnis. */`. Neue Methode mit Doc-Kommentar `/** Erkennung fürs Standbild: KI-Modell als Hauptweg, OpenCV für die Feinlage und als Rückfall (ADR-011). */`:
  ```ts
  async detectStill(source: ImageBitmap): Promise<Quad | null> {
    const opencvQuad = await this.detect(source);
    const started = performance.now();
    let aiQuad: Quad | null = null;

    try {
      aiQuad = await this.docAligner.detect(source);
    } catch (error: unknown) {
      console.info('DocAligner: nicht verfügbar', error);
      return opencvQuad;
    }

    const tolerance = Math.hypot(source.width, source.height) * AGREEMENT_RATIO;
    const result = aiQuad === null ? opencvQuad : opencvQuad !== null && quadsClose(opencvQuad, aiQuad, tolerance) ? opencvQuad : aiQuad;
    const label = result === null ? 'keins' : result === aiQuad ? 'ki' : 'opencv';

    console.info(`DocAligner: ${Math.round(performance.now() - started)} ms, Ergebnis ${label}`);
    return result;
  }
  ```
  `quadsClose(previous, next, tolerance)` aus `geometry.ts` prüft je Ecke `distance < tolerance` (beim Planen gelesen). Den verschachtelten Ternär auflösen, falls die Lint-Regeln ihn verbieten (`if`/`else`, gleiche Logik).
- [x] `crop.ts`, `runDetection`: `this.documentDetection.detect(frame)` → `this.documentDetection.detectStill(frame)`. Sonst nichts.
- [x] `capture.ts`: `private readonly docAligner = inject(DocAligner);` und am Ende von `ngOnInit` `this.docAligner.load().catch(() => undefined);` mit Kommentar `// Vorwärmen, während der User zielt — beim Auslösen ist das Modell dann meist schon da. Fehler zeigt erst die Erkennung.`
- [x] ADR `docs/decisions/011-ki-eckenerkennung.md` (Muster ADR-007): Kontext (feste Canny-Grenzen, Messung aus der Tabelle oben) · Optionen: OpenCV nachschärfen (automatische Grenzen, Sättigungskanal, Kandidaten bewerten — hilft bei Kontrast, nicht bei hellem Tisch ohne Kante) / DocAligner `fastvit_t8` (13 MB, in der Messung schlechter) / DocAligner `lcnet100` + OpenCV-Feinlage · Entscheidung: `lcnet100` fp32 (4,8 MB, keine Umwandlung), nur Standbild, nur WASM, Kombination mit 3 %-Regel · Konsequenzen: erster Scan lädt Laufzeit (~7 MB komprimiert) + Modell (~5 MB), danach offline über die Asset-Gruppe `ml`; Modell-Quelle ist Google Drive (kann ausfallen oder sperren — Prüfsumme fängt es ab); Live-Vorschau bleibt OpenCV, auf hellem Tisch also weiterhin ohne Live-Rahmen; Lizenz Apache-2.0, Hinweis unter `licenses/docaligner.txt`.
- [x] `docs/code-map.md`: Zeile `core/ml/doc-aligner.ts` — „KI-Eckenerkennung (DocAligner): Heatmap → vier Ecken, nur fürs Standbild (ADR-011)“; Zeile `core/document-detection.ts` um „, `detectStill` kombiniert KI und OpenCV fürs Standbild“ ergänzen.
- [x] `docs/PROJECT.md`: wo DocAligner als „optional / nicht im MVP“ steht, auf „aktiv für die Standbild-Erkennung (ADR-011)“ ändern.
- [x] `npm run lint`, `npm run build`, `npm test`.
- [ ] Lokal `npm start`, ein Foto eines Blatts auf hellem Hintergrund scannen, Konsole zeigt `DocAligner: … Ergebnis ki`. — Nicht ausgeführt (kein Browser in der Session), wandert in die Smoke-Checkliste. Ersatz: Modell in Node mit synthetischem Blatt geprüft (siehe Deviations).

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups

- KI in der Live-Vorschau, falls die Handy-Zeit aus Smoke-Punkt 2 unter ~150 ms liegt.
