# Findings — App nach Mockup

Erkenntnisse, die während der Umsetzung auffallen und eine spätere Phase betreffen. Format:

```
- [ ] → Phase N: <Erkenntnis in einem Satz>
```

Erledigte Einträge abhaken, nicht löschen — sie erklären am Plan-Ende die Abweichungen.

## Übernommen aus dem Meilenstein-1-Plan (dort für dessen Phase 4 notiert)

- [ ] → Phase 3: `detect()` hat noch keinen Aufrufer, deshalb entsteht auch der OpenCV-Lazy-Chunk noch nicht. Die Sichtprüfung der Erkennung fällt in Phase 3, sobald der Zuschneiden-Bildschirm `DocumentDetection` injiziert.
- [ ] → Phase 3: Das Freigabe-Muster für OpenCV-Speicher steht als `MatScope` in `core/document-detection.ts`. Phase 3 zieht es nach `core/mat-scope.ts` hoch, `warp()` und später die Filter nutzen es.
- [ ] → Phase 3: Zielgröße des begradigten Bildes nicht neu rechnen — `quadOutputSize()` aus `core/geometry.ts` liefert sie.
