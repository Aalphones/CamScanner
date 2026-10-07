# Phase 3 — Kantenerkennung & Geometrie

**Rating:** heikel — Bildverarbeitungs-Parameter, Speicher-Disziplin bei
OpenCV.js und der Maßstabs-Wechsel zwischen verkleinerter Erkennung und vollem
Bild.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt-Sektion (`Quad`, `detect`)
- `docs/concept.md` Kapitel 4.2
- `src/app/core/opencv-loader.ts`, `src/app/core/geometry.ts`
- `docs/conventions/testing.md` (in Phase 1 gekürzt — getestet wird nur
  `geometry.ts`)

## Entscheidung: Erkennung auf verkleinerter Kopie

Die Erkennung läuft **nicht** auf dem 12-Megapixel-Original, sondern auf einer
Kopie mit maximal 1024 px langer Kante. Zwei Gründe: es ist um Größenordnungen
schneller, und die Kantenerkennung findet auf verkleinerten Bildern die
Blattkante zuverlässiger, weil Papierfasern und Druckraster wegfallen. Die
gefundenen Ecken werden anschließend mit dem Kehrwert des
Verkleinerungsfaktors auf Original-Koordinaten hochgerechnet. Das Begradigen
(Phase 4) arbeitet dann auf dem Original — Auflösung geht also nicht verloren.

**Speicher-Regel, ausnahmslos:** Jede `cv.Mat` und jeder `cv.MatVector` wird in
einem `try`/`finally` angelegt und im `finally` mit `.delete()` freigegeben.
OpenCV.js läuft in WebAssembly ohne automatische Speicherbereinigung —
vergessene Mats sind ein Leck, das nach ein paar Scans den Tab abschießt.

## Abnahme-Kriterien

- `detect()` liefert bei einem Beleg auf kontrastreichem Untergrund vier Punkte,
  die erkennbar auf den Blattecken liegen (Sichtprüfung in Phase 4).
- Findet sich kein plausibles Viereck, kommt `null` zurück — kein Absturz, keine
  Notlösung mit erfundenen Punkten.
- Die Punkte liegen in Koordinaten des Original-Bitmaps und in der Reihenfolge
  oben-links, oben-rechts, unten-rechts, unten-links.
- `npm test` grün: `geometry.spec.ts` deckt Ecken-Sortierung, Skalierung und
  Zielgröße ab.
- Zehn Aufrufe von `detect()` hintereinander lassen den Speicherverbrauch des
  Tabs nicht monoton wachsen (Browser-Task-Manager).

## Checkliste

- [x] `src/app/core/geometry.ts` ausbauen — reine Funktionen, keine Abhängigkeiten:
      - `sortQuadCorners(points: readonly Point[]): Quad` — oben-links hat die
        kleinste Summe `x + y`, unten-rechts die größte; oben-rechts die
        kleinste Differenz `y - x`, unten-links die größte
      - `scaleQuad(quad: Quad, factor: number): Quad`
      - `quadOutputSize(quad: Quad): { width: number; height: number }` —
        Breite = längere der beiden waagerechten Kanten, Höhe = längere der
        beiden senkrechten, beide auf ganze Pixel gerundet
      - `quadArea(quad: Quad): number` (Trapezformel)
      - `isConvexQuad(quad: Quad): boolean` — Vorzeichen der Kreuzprodukte an
        allen vier Ecken gleich
- [x] `src/app/core/geometry.spec.ts` — Vitest, ohne Angular-TestBed:
      - unsortierte Punkte eines gedrehten Rechtecks werden korrekt sortiert
      - `scaleQuad` mit Faktor 2 verdoppelt alle Koordinaten
      - `quadOutputSize` eines 100x200-Rechtecks liefert exakt 100x200
      - `isConvexQuad` erkennt ein über Kreuz gefaltetes Viereck als nicht konvex
- [x] `ng generate service core/document-detection` — `detect()` in dieser
      Reihenfolge:
      1. Verkleinerungsfaktor `Math.min(1, 1024 / Math.max(breite, hoehe))`;
         Bitmap über ein `OffscreenCanvas` in dieser Größe zeichnen und als
         `ImageData` holen
      2. `cv.matFromImageData` → `cvtColor(COLOR_RGBA2GRAY)` →
         `GaussianBlur(5x5, 0)` → `Canny(75, 200)` → `dilate` mit 3x3-Kernel,
         eine Iteration (schließt Lücken in der Kantenlinie)
      3. `findContours(RETR_EXTERNAL, CHAIN_APPROX_SIMPLE)`, Konturen nach
         `contourArea` absteigend sortieren, die ersten fünf betrachten
      4. Je Kontur `approxPolyDP` mit `epsilon = 0.02 * arcLength`. Die erste
         Kontur nehmen, die vier Punkte hat, konvex ist und deren Fläche
         mindestens 20 % der verkleinerten Bildfläche beträgt
      5. Punkte über `sortQuadCorners` ordnen, mit `1 / faktor` über `scaleQuad`
         auf Original-Koordinaten bringen, zurückgeben
      - Alle Zwischen-Mats im `finally` freigeben (Regel oben)
      - Die Werte 75/200, `0.02` und `0.20` als benannte Konstanten am
        Dateikopf, je mit einem Kommentar, warum dieser Wert — sie werden beim
        Feldtest angefasst und dürfen nicht als nackte Zahlen im Code stehen

## Doc-Updates

- [x] `docs/decisions/003-erkennung-und-bildschirm-uebergabe.md` — Erkennung auf
      verkleinerter Kopie, Ecken-Reihenfolge als projektweite Konvention,
      Zustands-Übergabe zwischen Bildschirmen über `ScanSessionService` statt
      Router-State (Router-State überlebt kein Neuladen und ist nicht typisiert)
- [x] `docs/code-map.md`: `core/document-detection.ts`, `core/geometry.ts`
- [x] `docs/glossary.md`: Einträge „Quad" und „Kantenerkennungs-Schwellwerte"

## Report-Back

**Status:** complete (2026-08-30)

- `geometry.ts` trägt jetzt fünf reine Funktionen (`sortQuadCorners`,
  `scaleQuad`, `quadOutputSize`, `quadArea`, `isConvexQuad`) plus einen
  `Size`-Typ für die Zielgröße. Kein `!`, keine Fremdabhängigkeit.
- `document-detection.ts` läuft wie geplant: verkleinern → Graustufen →
  Weichzeichner → Canny → Dilatation → Konturen → `approxPolyDP`, erster
  Kandidat mit vier Ecken, konvex, ≥ 20 % Fläche gewinnt.
- **Abweichung (bewusst):** Statt einer Kaskade verschachtelter
  `try`/`finally`-Blöcke sammelt ein kleiner Ablagekorb `MatScope` alle Mats
  ein, ein einziges `finally` gibt sie frei. Gleiche Garantie, ein Bruchteil
  der Verschachtelung — inklusive der Mats aus `contours.get(i)`, die eine
  Block-Kaskade leicht übersieht.
- **Abweichung:** Die Mindestfläche wird über `quadArea()` des sortierten
  Quads geprüft, nicht über `cv.contourArea()` der Rohkontur — das ist die
  Fläche, die am Ende tatsächlich begradigt wird.
- Erkennung noch ohne Aufrufer; die Sichtprüfung der AK 1 verschiebt sich auf
  Phase 4 (Eintrag in FINDINGS.md).

**Gates:** `npx tsc --noEmit` sauber, `npm test` 9/9 grün, `npm run lint`
sauber, `npm run build` durch (207,81 kB initial).
