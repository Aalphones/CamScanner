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

- [ ] → Phase 9: Der OpenCV-Lazy-Chunk ist 17,55 MB roh, ~2,9 MB komprimiert. Für den Offline-Start muss der Service Worker ihn cachen — Prefetch beim Installieren oder lazy beim ersten Zuschneiden entscheiden; außerdem prüfen, dass Strato ihn komprimiert ausliefert (`.htaccess`), sonst lädt das Handy beim ersten Scan 17 MB.
- [ ] → Phase 6: `/crop` überspringt die Erkennung, wenn der Entwurf schon Ecken hat (Rückweg aus dem nächsten Schritt behält die Ecken des Users). `startEdit()` muss deshalb `corners` **und** `detectedCorners` setzen — sonst ist „Auto“ beim Bearbeiten ausgegraut.
- [x] → Phase 4: `/crop` navigiert nach „Übernehmen“ bereits auf `/export`; die Route muss dort nur noch entstehen.
- [ ] → Vault: Angular-Build (esbuild) mit `@techstark/opencv-js` — Symptom: `Could not resolve "fs"` / `"crypto"` erst, sobald der Chunk wirklich importiert wird · Ursache: die Emscripten-Datei enthält `require("fs")` in einem Node-Zweig · Fix: `"externalDependencies": ["fs", "crypto", "path"]` in `angular.json` (der Zweig läuft im Browser nie), dazu `allowedCommonJsDependencies` gegen die CommonJS-Warnung.

## Aus Phase 5

- [ ] → Phase 9: Seit Phase 5 lädt schon der Sucher den OpenCV-Chunk (Live-Rahmen), nicht erst das Zuschneiden. „Lazy beim ersten Zuschneiden“ ist damit keine Option mehr — der Chunk wird beim ersten App-Start gebraucht und gehört in den Install-Cache.
