# Findings — App nach Mockup

Erkenntnisse, die während der Umsetzung auffallen und eine spätere Phase betreffen. Format:

```
- [ ] → Phase N: <Erkenntnis in einem Satz>
```

Erledigte Einträge abhaken, nicht löschen — sie erklären am Plan-Ende die Abweichungen.

## Übernommen aus dem Meilenstein-1-Plan (dort für dessen Phase 4 notiert)

- [x] → Phase 3: `detect()` hat noch keinen Aufrufer, deshalb entsteht auch der OpenCV-Lazy-Chunk noch nicht. Die Sichtprüfung der Erkennung fällt in Phase 3, sobald der Zuschneiden-Bildschirm `DocumentDetection` injiziert.
- [x] → Phase 3: Das Freigabe-Muster für OpenCV-Speicher steht als `MatScope` in `core/document-detection.ts`. Phase 3 zieht es nach `core/mat-scope.ts` hoch, `warp()` und später die Filter nutzen es.
- [x] → Phase 3: Zielgröße des begradigten Bildes nicht neu rechnen — `quadOutputSize()` aus `core/geometry.ts` liefert sie.

## Aus Phase 3

- [x] → Phase 9: Der OpenCV-Lazy-Chunk ist 17,55 MB roh, ~2,9 MB komprimiert. Für den Offline-Start muss der Service Worker ihn cachen — Prefetch beim Installieren oder lazy beim ersten Zuschneiden entscheiden; außerdem prüfen, dass Strato ihn komprimiert ausliefert (`.htaccess`), sonst lädt das Handy beim ersten Scan 17 MB. *Phase 9: Prefetch über `/*.js`; `mod_deflate`-Block in `.htaccess` ergänzt, Wirkung auf Strato nach dem Deploy mit `curl` prüfen.*
- [x] → Phase 6: `/crop` überspringt die Erkennung, wenn der Entwurf schon Ecken hat (Rückweg aus dem nächsten Schritt behält die Ecken des Users). `startEdit()` muss deshalb `corners` **und** `detectedCorners` setzen — sonst ist „Auto“ beim Bearbeiten ausgegraut. *Gelöst ohne `detectedCorners` in `startEdit`: im Bearbeiten-Modus ist „Auto“ aktiv, solange noch nicht erkannt wurde, und der erste Druck erkennt nach (wie in der Phase-6-Entscheidung).*
- [x] → Phase 4: `/crop` navigiert nach „Übernehmen“ bereits auf `/export`; die Route muss dort nur noch entstehen.
- [ ] → Vault: Angular-Build (esbuild) mit `@techstark/opencv-js` — Symptom: `Could not resolve "fs"` / `"crypto"` erst, sobald der Chunk wirklich importiert wird · Ursache: die Emscripten-Datei enthält `require("fs")` in einem Node-Zweig · Fix: `"externalDependencies": ["fs", "crypto", "path"]` in `angular.json` (der Zweig läuft im Browser nie), dazu `allowedCommonJsDependencies` gegen die CommonJS-Warnung.

## Aus Phase 6

- [x] → Phase 8: Der Übernehmen-Ablauf steht in `features/crop/crop.ts` → `onApplyClick` samt Bearbeiten-Zweig (`id`, `rotation` und das alte `source`-JPEG der Seite an `createPage` weiterreichen, dann `replace` statt `add`). Beim Verlegen an „Fertig“ im Filter diesen Zweig mitnehmen; `/crop` setzt dann nur noch `setWarpedPage` und navigiert nach `/filter`. `createPage` kennt dafür das optionale Feld `source` (README-Kontrakt nachgezogen).
- [x] → Phase 8: `/crop` → „Zurück“/„Abbrechen“ setzt im Bearbeiten-Modus den Entwurf zurück und geht nach `/pages`. Der Zurück-Pfeil im Filter führt nach `/crop` — dort muss der Entwurf dann noch stehen (nicht in `/filter` zurücksetzen).

## Aus Phase 7

- [x] → Phase 8: `createPage` filtert nicht selbst (reine Funktion, kein Injector) — das Feld `output` ist Pflicht und kommt von `ImageFilters.renderFiltered(warped, filter)`. Heute rechnet das `crop.ts` → `onApplyClick` mit `scanSession.filter()`; beim Verlegen an „Fertig“ wandert dieser Aufruf mit. Kein `maxEdge` beim Übernehmen.
- [x] → Phase 8: Laufzeit voller Auflösung (Node, 4000 × 3000): Auto ~2,1 s, Scan ~0,8 s, S/W ~0,4 s, Grau ~0,2 s, Original ~0,1 s — auf dem Handy länger. Vorschau mit `maxEdge` rechnen und nach jedem Regler-Schritt nur den letzten Auftrag ausführen (laufende Rechnung nicht stapeln); „Speichert …“ ist bei Auto real spürbar.
- [x] → Phase 8: Größter Brocken in „Auto“ ist das Nachschärfen auf drei Farbkanälen (~1,1 s von 2,1 s). Nachschärfen nur auf dem Helligkeitskanal (vor dem Zurückwandeln aus Lab) brauchte ~0,4 s — Option, falls Auto auf dem Handy zu träge ist; ändert eine festgelegte Entscheidung, also nur nach Go. *Phase 8: nicht umgesetzt — wartet auf den Feldtest auf dem Handy.*

## Aus Phase 11

- [x] → Phase 11 (Schritt 0): Modell `docshadow_sd7k.onnx` ist 120 MB (float32), nicht „mittel“ wie im Konzept. Lizenz MIT für Code und Gewichte (DocShadow-SD7K und ONNX-Export), Namensnennung nötig. Eingang `image` `[N, 3, H, W]` mit dynamischer Höhe/Breite, Ausgang `result` gleich geformt, Werte 0..1 mit leichtem Überlauf (−0,3 … 1,03), Opset 12. *User-Entscheidung: auf fp16 halbieren → 62 MB; Abweichung zu float32 höchstens 0,48/255 (ADR-007).*
- [x] → Plan-Ende (Smoke): Schritt 0, Punkte 2 und 3 brauchen den echten Server — nach dem Deploy in der Konsole `crossOriginIsolated` prüfen (Header stehen in `.htaccess`) und `curl -I https://<adresse>/models/docshadow.onnx` auf `Content-Length: 62046107` und `Content-Type: application/octet-stream`. *Deploy 2026-10-08 nach `https://quantum-canvas.de/scanner/` (nicht auf der Subdomain, siehe unten). `curl -I`: `http://…/scanner/` → 301 auf https · `/scanner/pages` → 200 · `/scanner/models/docshadow.onnx` → 200, `Content-Length: 62046107`, `Content-Type: application/octet-stream`, dazu `Cross-Origin-Opener-Policy: same-origin` und `Cross-Origin-Embedder-Policy: require-corp`. Noch offen: `crossOriginIsolated` in der Browser-Konsole und die Smoke-Checkliste aus der Plan-README am Handy.*
- [x] → Deploy: Die App läuft unter `https://quantum-canvas.de/scanner/` (`BASE_HREF=/scanner/`, Zugang auf `/www/` beschränkt), nicht auf `scanner.quantum-canvas.de` — für die Subdomain stellt Strato kein SSL-Zertifikat aus, ohne HTTPS gibt es weder Kamera noch Service Worker. Webroot der Domain ist der Ordner `www`, darin `scanner/` und `card/` (CardMaker).
- [ ] → Vault: onnxruntime-web (≥ 1.2x) mit Angular/esbuild — Symptom: Service Worker lädt den ORT-Chunk für alle vor, obwohl er nur per `import()` kommt · Ursache: der Prefetch-Glob `/*.js` erfasst jeden Lazy-Chunk, Namen sind gehasht · Fix: `namedChunks: true`, dann `!/ort.bundle.min-*.js` im Prefetch und das Muster in eine lazy-Gruppe. Dazu: Standard-Import nutzt `ort-wasm-simd-threaded.jsep.{wasm,mjs}` — nur diese zwei Dateien kopieren statt aller vier Varianten (86 MB).

## Aus Phase 5

- [x] → Phase 9: Seit Phase 5 lädt schon der Sucher den OpenCV-Chunk (Live-Rahmen), nicht erst das Zuschneiden. „Lazy beim ersten Zuschneiden“ ist damit keine Option mehr — der Chunk wird beim ersten App-Start gebraucht und gehört in den Install-Cache.
