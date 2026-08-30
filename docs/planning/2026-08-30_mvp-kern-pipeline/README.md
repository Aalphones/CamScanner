# Meilenstein 1 — MVP Kern-Pipeline

Ein Dokument mit der Kamera aufnehmen, die Blattkanten finden, das Bild
begradigen und als einseitiges PDF sichern. Alles im Browser, nichts verlässt
das Gerät.

**Nicht in diesem Meilenstein:** mehrere Seiten sammeln (M2), Scan-Look-Filter
(M3), PWA-Härtung (M4), Teilen über das Share-Sheet (M5), ML-Modelle (M6).
Der PDF-Service wird trotzdem schon auf eine Seiten-Liste ausgelegt, damit M2
ihn unverändert weiterverwenden kann.

## Phasen

| # | Phase | Rating | Status |
|---|---|---|---|
| 1 | [OpenCV-Fundament & Gerüst](phase-1-opencv-fundament.md) | heikel | pending |
| 2 | [Kamera & Aufnahme](phase-2-kamera-aufnahme.md) | standard | pending |
| 3 | [Kantenerkennung & Geometrie](phase-3-erkennung-geometrie.md) | heikel | pending |
| 4 | [Ecken-Korrektur & Begradigung](phase-4-ecken-begradigung.md) | standard | pending |
| 5 | [PDF-Export & Abschluss](phase-5-pdf-export.md) | standard | pending |

## Architektur-Entscheidungen (fallen in diesem Plan)

- **ADR-002** — OpenCV.js-Einbindung: npm-Paket `@techstark/opencv-js`,
  dynamisch nachgeladen (Phase 1)
- **ADR-003** — Bildschirm-Übergabe über einen Signal-Service statt Router-State,
  Erkennung auf verkleinerter Kopie (Phase 3)

Beide Nummern sind hier reserviert; `docs/decisions/` enthält bisher nur 001.

## Kontrakt: Kernbegriffe und Signaturen

Diese Typen und Signaturen stehen **vor** der Umsetzung fest. Sie sind der
Drift-Anker zwischen den Phasen — wer eine Phase baut, hält sich daran.

```ts
// src/app/core/geometry.ts
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Vier Eckpunkte, IMMER in dieser Reihenfolge: oben-links, oben-rechts,
 *  unten-rechts, unten-links. Koordinaten in Pixeln des Quell-Standbilds. */
export type Quad = readonly [Point, Point, Point, Point];
```

```ts
// src/app/core/scan-session.service.ts  (providedIn: 'root')
sourceFrame:  Signal<ImageBitmap | null>   // Standbild in voller Auflösung
corners:      Signal<Quad | null>          // in sourceFrame-Koordinaten
warpedPage:   Signal<Blob | null>          // begradigte Seite, image/jpeg
setSourceFrame(frame: ImageBitmap): void
setCorners(corners: Quad): void
setWarpedPage(page: Blob): void
reset(): void                              // gibt ImageBitmap frei (close())
```

```ts
// src/app/core/opencv-loader.service.ts
load(): Promise<OpenCv>                    // idempotent, cached

// src/app/core/document-detection.service.ts
detect(source: ImageBitmap): Promise<Quad | null>   // null = nichts gefunden

// src/app/core/perspective.service.ts
warp(source: ImageBitmap, corners: Quad): Promise<Blob>   // image/jpeg

// src/app/core/pdf.service.ts
buildPdf(pages: readonly Blob[]): Promise<Blob>     // Liste! (M2 nutzt sie)

// src/app/core/file-save.ts
downloadBlob(blob: Blob, fileName: string): void
```

**Bildschirm-Fluss:** `/capture` → `/crop` → `/result`. Jede Route außer
`/capture` prüft über einen Guard, ob der nötige Zustand da ist, und schickt
sonst zurück auf `/capture` — damit ein neu geladener Tab nie auf einem leeren
Bildschirm landet.

## Offene Punkte

- **Taschenlampen-Schalter im Sucher** (`torch`-Constraint auf dem Video-Track):
  beim Planen aufgefallen, rettet Aufnahmen bei schlechtem Licht, kostet wenige
  Zeilen in `camera.service.ts` und einen Knopf in `features/capture`. Noch
  nicht entschieden — entweder in Phase 2 mitnehmen oder als eigener kleiner
  Plan nach Meilenstein 1.

## Abnahme-Kriterien für den ganzen Meilenstein

1. `npm run build` und `npm run lint` laufen sauber durch, `npm test` ist grün.
2. Auf einem Android-Handy über HTTPS (oder Desktop-Chrome auf `localhost`)
   erscheint das Kamerabild, ein Druck auf den Auslöser friert es ein.
3. Bei einem Beleg auf kontrastreichem Untergrund liegt der vorgeschlagene
   Rahmen erkennbar auf den Blattkanten.
4. Die vier Ecken lassen sich mit dem Finger verschieben; das Ergebnis ist ein
   rechteckiges, entzerrtes Blatt ohne schiefe Ränder.
5. „Als PDF sichern" legt eine PDF-Datei im Download-Ordner ab, die sich in
   einem beliebigen PDF-Betrachter öffnen lässt und genau eine Seite hat.
6. Kein Netzwerk-Zugriff außer dem Laden der App selbst (im Netzwerk-Tab
   nachprüfbar).

## Smoke-Checkliste (der User prüft, Reihenfolge bewusst)

Oben stehen die Stellen, an denen ich selbst am unsichersten bin.

1. **Baut das überhaupt?** `npm run build` nach Phase 1 — Bundle-Größe und
   etwaige CommonJS-Warnungen ansehen.
2. **Erkennung in freier Wildbahn:** drei Fotos durchschicken — Beleg auf
   dunklem Holz, weißes Blatt auf weißem Tisch, Beleg bei schlechtem Licht.
   Erwartung: Fall 1 sitzt, Fall 2 und 3 dürfen scheitern (dann greift die
   Ecken-Korrektur von Hand).
3. **Große Fotos:** ein 12-Megapixel-Bild aufnehmen und begradigen — dauert das
   spürbar länger als zwei Sekunden oder stürzt der Tab ab?
4. Auslöser bei verweigerter Kamera-Erlaubnis: kommt eine verständliche
   Meldung statt einer weißen Fläche?
5. Seite neu laden während man auf dem Zuschneiden-Bildschirm steht: landet man
   sauber wieder im Sucher?
6. PDF öffnen: ist das Blatt aufrecht, vollständig und nicht verzerrt?

## Summary

_(beim Archivieren füllen)_

## Files touched

_(beim Archivieren füllen)_

## Commits

_(beim Archivieren füllen)_

## Deviations from plan

_(beim Archivieren füllen)_

## Follow-ups

_(beim Archivieren füllen)_
