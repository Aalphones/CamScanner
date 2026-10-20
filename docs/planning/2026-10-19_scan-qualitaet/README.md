# Plan — Scan-Qualität: Aufnahme, Begradigen, Kanten, S/W

Die Filter sind ausgereizt; die Reserven liegen davor. Die Aufnahme ist bisher ein Standbild aus dem Videostream (Wunsch 3840 × 2160, `core/camera.ts`) statt eines echten Fotos. Das begradigte Zwischenbild wird linear interpoliert und als JPEG 0,92 gespeichert, bevor der Filter es ein zweites Mal komprimiert. Die Ecken stammen aus einer Arbeitskopie mit 1024 px langer Kante, liegen auf ganzen Pixeln dieser Kopie und durch die Dilatation der Kantenerkennung leicht außerhalb des Blatts — auf voller Auflösung sind das mehrere Pixel Tischkante am Seitenrand. S/W trennt mit einem einzigen Schwellwert (Otsu) fürs ganze Blatt; blasse Schrift fällt dabei weg.

**Nicht in diesem Plan:** gewölbte Buchseiten glätten (eigener Plan nach Recherche eines Modells) · Auto-Auslösen · DocAligner · IndexedDB.

**Verhältnis zum Plan `2026-10-19_speichern-robust.md`:** Der deckelt gespeicherte Seiten auf 3000 px lange Kante und belegt ADR-008. Beide Pläne fassen verschiedene Dateien an (dort `doc-shadow.ts`, `filter.ts`; hier `camera.ts`, `perspective.ts`, `document-detection.ts`, `crop.ts`, `image-filters.ts`). Reihenfolge egal; dieser Plan nimmt ADR-009 und ADR-010.

## Phasen

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | [Aufnahme als echtes Foto](phase-1-fotoaufnahme.md) | heikel | complete |
| 2 | [Schärfstes Videobild als Rückfall](phase-2-schaerfe-rueckfall.md) | standard | complete |
| 3 | [Begradigen verlustärmer](phase-3-begradigen.md) | mechanisch | pending |
| 4 | [Ecken auf voller Auflösung nachziehen](phase-4-kanten-verfeinern.md) | heikel | pending |
| 5 | [S/W mit lokalem Schwellwert (Sauvola)](phase-5-sauvola.md) | standard | pending |

Profil `private`: keine neuen automatisierten Tests. Nach jeder Phase `npm run lint`, `npm run build` und `npm test` (bestehende Tests) grün.

## Architektur-Entscheidungen

Auf Platte 001–007, ADR-008 ist im geparkten Plan `2026-10-19_speichern-robust.md` reserviert. Hier:

- **ADR-009** — Aufnahme per `ImageCapture.takePhoto()` mit Rückfall auf das schärfste Videobild (Phase 1, ergänzt in Phase 2)
- **ADR-010** — Ecken auf voller Auflösung per Linienanpassung an die Blattkanten nachziehen (Phase 4)
- Sauvola statt Otsu wird als Nachtrag in ADR-006 vermerkt (Phase 5), kein eigenes ADR — die Pipeline-Entscheidung bleibt dieselbe.

## Kontrakt (neu oder geändert)

```ts
// core/camera.ts — Signatur unverändert, Verhalten neu
captureFrame(video: HTMLVideoElement): Promise<ImageBitmap>
// Phase 1: Foto per ImageCapture, höchstens 12 MP; sonst Videobild
// Phase 2: Videobild = schärfstes von 5

// core/sharpness.ts  (Phase 2, Service Sharpness)
score(frame: ImageBitmap): Promise<number>   // Varianz des Laplace-Bilds der Bildmitte; größer = schärfer, nur relativ vergleichbar

// core/edge-refinement.ts  (Phase 4, reine Funktion ohne OpenCV)
export function refineQuad(image: ImageData, quad: Quad, searchRadius: number): Quad

// core/document-detection.ts  (Phase 4, neue öffentliche Methode)
refine(source: ImageBitmap, quad: Quad): Quad

// core/perspective.ts  (Phase 3)
warp(source: ImageBitmap, corners: Quad): Promise<Blob>   // image/jpeg 0.97 statt 0.92
```

## Finale AK

1. Auf Android-Chrome hat das Standbild auf dem Zuschneiden-Bildschirm die Foto-Auflösung der Kamera (höchstens 12 MP), nicht die Video-Auflösung; auf Geräten ohne `ImageCapture` (iPhone) und bei eingeschalteter Taschenlampe läuft die Aufnahme wie bisher über das Videobild — nur das schärfste von fünf.
2. Ein Fehlschlag oder Hänger der Fotoaufnahme endet nach höchstens 5 s im Videobild, nie in einem stehenden Sucher.
3. Eine automatisch erkannte Seite zeigt nach dem Begradigen keinen dunklen Tischrand an den Seitenkanten mehr.
4. S/W behält blasse Schrift (Bleistift, Durchschlag), ohne dass weißes Papier sprenkelig wird.
5. `npm run lint`, `npm run build`, `npm test` grün.

## Smoke-Checkliste (User, Handy)

Wackelstellen zuerst:

1. **Fotoaufnahme am Gerät (Phase 1):** Seite scannen, auf dem Zuschneiden-Bildschirm per Remote-Debugging (PC-Chrome `chrome://inspect`) die Konsole lesen: `Camera: Foto W × H` muss erscheinen, nicht `Fotoaufnahme nicht möglich`. Dauer Auslöser → Zuschneiden notieren; über 2 s fühlbar → melden. Bildausschnitt: das Foto zeigt oft mehr als der Sucher (4:3 statt 16:9) — stört das beim Zuschneiden?
2. **Ecken nachgezogen (Phase 4):** weißes Blatt auf dunklem Tisch, schräg. Nach „Übernehmen“: Seitenränder ohne dunklen Saum? Gegenprobe: Blatt auf hellem, gemustertem Untergrund — Ecken dürfen nicht ins Muster springen (sonst Konsole `Kanten: verworfen` erwartet, Ecken wie vorher).
3. **S/W (Phase 5):** Bleistiftnotiz und Kassenbon im Look S/W — Schrift vollständig, Papier sauber weiß? Vergleich mit einem Foto des alten Stands.
4. **Taschenlampe an:** Aufnahme klappt, Bild hell (Videobild-Pfad).
5. **iPhone/Safari, falls zur Hand:** Aufnahme klappt, Bild scharf.
6. 10 Seiten hintereinander scannen — Tab bleibt stabil.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
