# Findings — Meilenstein 1

Erkenntnisse, die während der Umsetzung auffallen und eine spätere Phase
betreffen. Format:

```
- [ ] → Phase N: <Erkenntnis in einem Satz>
```

Erledigte Einträge abhaken, nicht löschen — sie erklären am Plan-Ende die
Abweichungen.

- [ ] -> Phase 4: `detect()` hat noch keinen Aufrufer, deshalb entsteht auch der
      OpenCV-Lazy-Chunk noch nicht (Build zeigt nur den `capture`-Chunk). Die
      Sichtpruefung der Erkennung (AK Phase 3) faellt damit in Phase 4, sobald
      der Zuschneiden-Bildschirm `DocumentDetection` injiziert.
- [ ] -> Phase 4: Das Freigabe-Muster fuer OpenCV-Speicher steht als `MatScope`
      in `core/document-detection.ts` (Ablagekorb + ein `finally`). `warp()` in
      `core/perspective.ts` uebernimmt es, statt eigene try/finally-Kaskaden zu
      bauen — die Klasse bei Bedarf nach `core/` hochziehen.
- [ ] -> Phase 4: Zielgroesse des begradigten Bildes nicht neu rechnen —
      `quadOutputSize()` aus `core/geometry.ts` liefert sie (laengere der beiden
      gegenueberliegenden Kanten, auf ganze Pixel gerundet).
