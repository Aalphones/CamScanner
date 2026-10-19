# Phase 4 — Ecken auf voller Auflösung nachziehen

## Kontext

- `src/app/core/document-detection.ts` (ganz; `DETECTION_MAX_EDGE = 1024`, `cv.dilate` nach Canny, `RETR_EXTERNAL`)
- `src/app/core/geometry.ts` (`Point`, `Quad`, `Size`, `isConvexQuad`, `clampPoint`)
- `src/app/features/crop/crop.ts` (`runDetection`)
- `src/app/features/capture/live-detection.ts` ruft `detect` auf 480-px-Vorschaubildern — **dort nichts ändern**, die Verfeinerung gilt nur fürs Standbild.
- Fehlerklassen geprüft: keine einschlägig.

## Warum

Die Erkennung arbeitet auf einer Kopie mit 1024 px langer Kante. Die Ecken liegen auf ganzen Pixeln dieser Kopie, und die Dilatation nach Canny verschiebt die äußere Kontur um etwa einen Pixel nach außen. Bei 4000 px Original sind das mehrere Pixel Tisch am Seitenrand.

## Entscheidungen

- **Eigene Linienanpassung** (reine TS-Funktion, kein OpenCV): je Seite Kantenpunkte entlang der Normalen suchen, Gerade per Hauptachse durch die Punkte legen, Ecken als Schnittpunkte benachbarter Geraden. `cv.cornerSubPix` fehlt in OpenCV.js; `cv.fitLine` existiert zur Laufzeit, aber nicht in den Typen — die eigene Anpassung braucht ohnehin die eigenen Punkte und ist rund 20 Zeilen.
- **Nur automatisch erkannte Ecken** werden verfeinert, nie vom User gezogene.
- **Sicherheitsnetz:** jede neue Ecke höchstens `2 × searchRadius` von der alten entfernt, Viereck konvex — sonst bleibt das alte Viereck unverändert (ganz oder gar nicht).

## AK

1. `refineQuad` liefert für ein sauber erkanntes Blatt Ecken mit Nachkommastellen, die auf den Blattkanten liegen.
2. Scheitert eine Prüfung (zu wenige Punkte, parallele Geraden, Ecke zu weit gewandert, nicht konvex), kommt das Eingangs-Viereck unverändert zurück, Konsole `Kanten: verworfen (<Grund>)`.
3. `crop.ts` verfeinert nur das Ergebnis von `detect`, Fehler der Verfeinerung lassen das unverfeinerte Ergebnis stehen.

## Checkliste

- [ ] Neue Datei `src/app/core/edge-refinement.ts`, nur Funktionen. Konstanten mit Doc-Kommentar:
  - `EDGE_SAMPLES = 32` — `/** Stützpunkte je Blattkante. */`
  - `EDGE_SAMPLE_START = 0.1`, `EDGE_SAMPLE_END = 0.9` — `/** Nur das mittlere Stück jeder Kante: Ecken sind oft abgerundet oder geknickt. */`
  - `PROFILE_STEP = 0.5` — `/** Schrittweite entlang der Normalen in Pixeln. */`
  - `TANGENT_OFFSETS = [-2, 0, 2]` — `/** Je Profilpunkt drei Proben quer gemittelt — glättet Papierfaser und Rauschen. */`
  - `MIN_STRENGTH_RATIO = 0.5` — `/** Stützpunkte mit weniger als der Hälfte des mittleren Kantensprungs der Seite sind Rauschen. */`
  - `OUTLIER_MAD_FACTOR = 3`, `OUTLIER_MIN_PX = 1` — `/** Punkte weiter als 3 × Median-Abweichung (mindestens 1 px) von der ersten Geraden fliegen raus. */`
  - `MIN_FIT_POINTS = 8`, `MIN_SIDE_LENGTH = 40`.
- [ ] `gray(image: ImageData, x: number, y: number): number` — bilinear, Koordinaten auf `[0, width-1] × [0, height-1]` begrenzt, Helligkeit `0.299 r + 0.587 g + 0.114 b`.
- [ ] `edgePoint(image, base: Point, tangent: Point, normal: Point, radius: number): { point: Point; strength: number }` — Profil `v(s)` für `s = -radius … +radius` in `PROFILE_STEP`, je `s` Mittel aus `gray(base + normal·s + tangent·τ)` über `TANGENT_OFFSETS`. Ableitung `g_i = v_{i+1} − v_{i−1}` (innere Indizes). `i*` = Index mit größtem `|g|`; Feinlage per Parabel über `m = |g|` an `i*−1, i*, i*+1`: `δ = (m₋ − m₊) / (2 (m₋ − 2 m₀ + m₊))`, bei Nenner 0 → `δ = 0`, auf `[-0.5, 0.5]` begrenzt. `s* = s(i*) + δ · PROFILE_STEP`. Rückgabe `point = base + normal·s*`, `strength = m₀`.
- [ ] `fitLine(points: readonly Point[]): { point: Point; direction: Point }` — Schwerpunkt `c`, `Sxx, Syy, Sxy` (zentriert), Winkel `θ = 0.5 · atan2(2 Sxy, Sxx − Syy)`, Richtung `(cos θ, sin θ)`.
- [ ] `refineSide(image, a: Point, b: Point, radius): { point; direction } | string` — String = Verwerfungsgrund. Länge `< MIN_SIDE_LENGTH` → `'Kante zu kurz'`. `tangent = (b − a)/|b − a|`, `normal = (−tangent.y, tangent.x)`. Stützpunkte bei `u = EDGE_SAMPLE_START + (EDGE_SAMPLE_END − EDGE_SAMPLE_START) · k / (EDGE_SAMPLES − 1)`. Punkte mit `strength < MIN_STRENGTH_RATIO · median(strength)` streichen. `< MIN_FIT_POINTS` → `'zu wenige Kantenpunkte'`. Erste Gerade, Abstände `r_j`, `limit = max(OUTLIER_MIN_PX, OUTLIER_MAD_FACTOR · median(|r|))`, Punkte mit `|r| > limit` streichen, erneut prüfen auf `MIN_FIT_POINTS`, zweite Gerade zurück.
- [ ] `intersect(l1, l2): Point | null` — `null`, wenn `|cross(d1, d2)| < 1e-6`.
- [ ] Exportiert `refineQuad(image: ImageData, quad: Quad, searchRadius: number): Quad` mit Doc-Kommentar (`/** Zieht erkannte Ecken auf die echten Blattkanten der vollen Auflösung: je Kante eine angepasste Gerade, Ecken als Schnittpunkte. Im Zweifel bleibt das Eingangs-Viereck (ADR-010). */`). Seite `i` läuft von `quad[i]` nach `quad[(i + 1) % 4]`; Ecke `i` = Schnitt der Seiten `(i + 3) % 4` und `i`. Danach `clampPoint` auf die Bildgröße, Prüfungen: Abstand je Ecke `≤ 2 · searchRadius`, `isConvexQuad`. Jeder Fehlschlag: `console.info('Kanten: verworfen (' + grund + ')')`, Eingangs-Viereck zurück.
- [ ] `document-detection.ts`: Konstanten `REFINE_RADIUS_WORKING_PX = 3` (`/** Suchbreite beim Nachziehen, in Pixeln der Arbeitskopie: deckt Rundung und die Dilatation ab. */`), `REFINE_MIN_RADIUS = 6`. Öffentliche Methode `refine(source: ImageBitmap, quad: Quad): Quad` — volle Auflösung per `OffscreenCanvas` (Muster `drawScaled` mit Faktor 1) lesen, `radius = Math.max(REFINE_MIN_RADIUS, Math.ceil(REFINE_RADIUS_WORKING_PX * Math.max(source.width, source.height) / DETECTION_MAX_EDGE))`, `return refineQuad(image, quad, radius)`. Kein 2D-Kontext → `quad` unverändert.
- [ ] `crop.ts`, `runDetection`: nach `detected = await this.documentDetection.detect(frame);` → `if (detected !== null) { detected = this.refineSafely(frame, detected); }`. Private `refineSafely(frame, quad): Quad` mit `try { return this.documentDetection.refine(frame, quad); } catch (error: unknown) { console.error('Kanten nachziehen fehlgeschlagen', error); return quad; }`.
- [ ] ADR `docs/decisions/010-kanten-verfeinern.md`: Kontext (Arbeitskopie 1024 px, Dilatation, Saum) · Optionen: nichts tun / `cornerSubPix` (fehlt in OpenCV.js, und Eckpunkte sind an abgerundeten Ecken unzuverlässig) / Linienanpassung an die Kanten · Entscheidung: Linienanpassung, nur für automatisch erkannte Ecken, Sicherheitsnetz · Konsequenzen: ein Lesen der vollen Auflösung mehr beim Zuschneiden (~50 MB kurzzeitig bei 12 MP); Muster oder Linien direkt am Blattrand können eine Kante verziehen — das Sicherheitsnetz begrenzt das auf `2 × Suchbreite`.
- [ ] `docs/code-map.md`: Zeile `core/edge-refinement.ts` — „Zieht erkannte Ecken auf voller Auflösung auf die Blattkanten (Linienanpassung je Kante, ADR-010)“; Zeile `core/document-detection.ts` um „, `refine` zieht die Ecken auf voller Auflösung nach“ ergänzen.
- [ ] `npm run lint`, `npm run build`, `npm test`.

## Report-Back
