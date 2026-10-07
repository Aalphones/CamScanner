# Phase 3 — Zuschneiden & Begradigen

**Rating:** heikel — Koordinaten-Umrechnung zwischen Anzeige und Original, Zieh-Interaktion mit Eck- und Mittelgriffen, Lupe, plus der erste OpenCV-Aufruf mit Bildausgabe.

Ergebnis: `/crop` sieht aus wie Mockup-Figur 2. Das Standbild wird automatisch erkannt, die Ecken lassen sich mit Finger oder Maus nachziehen, „Übernehmen“ erzeugt das begradigte Blatt.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`ScanSession`, `FilterSettings`, `warp`, Guards), Bildschirm-Fluss
- `FINDINGS.md` — die drei übernommenen Einträge betreffen diese Phase
- `artifacts/camscanner-mockup.html` — Figur 2 „Zuschneiden“; Klassen `.stage`, `svg.ov`, `.loupe`, `.hintline`, `.bottombar`
- `src/app/core/geometry.ts`, `src/app/core/document-detection.ts`, `src/app/core/scan-session.ts`, `src/app/features/capture/capture.ts`, `src/app/app.routes.ts`
- `docs/decisions/003-*.md` — Ecken-Reihenfolge, Speicher-Regel `MatScope`
- `docs/conventions/angular.md`, `docs/conventions/commits.md` (Tidy First)
- Vault-Fehlerklassen: `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Zwei Commits:** zuerst `refactor(core): MatScope nach core/mat-scope.ts` (nur verschieben + exportieren, `document-detection.ts` importiert es; Verhalten unverändert), dann das Feature.
- **Anzeige:** Das Standbild wird auf ein `<canvas>` gezeichnet (es liegt als `ImageBitmap` vor), eingepasst wie `object-fit: contain` in die Bühne. Darüber liegt ein SVG in Bühnengröße für Abdunklung, Rahmen und Griffe. Eine einzige berechnete Größe `view = { scale, offsetX, offsetY }` (computed aus Bühnengröße und Bildgröße) rechnet in beide Richtungen; keine zweite Umrechnung irgendwo anders.
- **Bühnengröße** per `ResizeObserver` als Signal; Canvas-Pixel mit `devicePixelRatio` multipliziert, damit es auf dem Handy scharf ist.
- **Ziehen** über Pointer-Events auf dem SVG (`pointerdown` auf einem Griff, `setPointerCapture`, `pointermove`, `pointerup`/`pointercancel`). Ein Weg für Maus und Finger. `touch-action: none` auf dem SVG.
- **Mittelgriff** verschiebt beide Ecken seiner Kante um dieselbe Strecke (Kante parallel verschieben). Jede Ecke wird einzeln auf die Bildgrenzen begrenzt.
- **Überkreuzte Ecken** werden nicht verhindert, sondern gemeldet: ist `isConvexQuad(corners)` falsch, zeigt die Hinweiszeile in `--cam-danger` „Ecken überkreuzen sich — bitte entwirren“ und „Übernehmen“ ist deaktiviert.
- **Lupe** nur während des Ziehens sichtbar. 84 px Kreis, 2-fach vergrößert gegenüber der Anzeige, Fadenkreuz in Akzentfarbe. Sitzt oben links (14 px Abstand); liegt der gezogene Punkt in der Anzeige innerhalb von 130 × 130 px oben links, springt sie nach oben rechts.
- **Nichts erkannt:** Startviereck mit 10 % Randabstand, Hinweiszeile „Keine Blattkanten erkannt — Ecken bitte von Hand setzen“, „Auto“ deaktiviert (`title="Keine Blattkanten erkannt"`).
- **Weiter nach „Übernehmen“:** in dieser Phase `router.navigate(['/export'])`. Die Route entsteht in Phase 4; bis dahin landet man über die `**`-Umleitung im Sucher — erwarteter Zwischenstand. Phase 8 ändert das Ziel auf `/filter`.
- **Zurück-Pfeil und „Neu aufnehmen“** tun dasselbe: `scanSession.reset()`, `/capture`.

## Struktur & Maße (Abnahme-Punkte, Mockup-Figur 2)

- Spalte über die volle Höhe (`100dvh`): Topbar, Bühne (`flex: 1`, Hintergrund `#0f1215`), Hinweiszeile, Bottombar ohne Verlauf.
- Topbar: links `.icon-btn` mit Icon `back` (`aria-label="Zurück"`), Mitte Titel „Zuschneiden“, rechts `.btn.btn--small` „Auto“.
- Abdunklung außerhalb des Vierecks: ein `<path fill-rule="evenodd" fill="#000" fill-opacity=".55">` aus Bühnen-Rechteck plus Viereck.
- Rahmen: `<polygon>` ohne Füllung, Kontur `--cam-accent`, 2 px.
- Eckgriffe: Kreise r = 11, Füllung `--cam-accent`, Kontur `--cam-accent-ink` 3 px. Unsichtbarer Trefferkreis r = 22 (44 px) darüber, `fill="transparent"`.
- Mittelgriffe: auf den vier Kantenmitten, r = 5, Kontur 2 px, Trefferkreis r = 18.
- Lupe: 84 px, Rand `3px solid --cam-accent`, Schatten `0 6px 18px #000a`, Fadenkreuz zwei 2-px-Linien, Deckkraft .8.
- Hinweiszeile: zentriert, `.75rem`, `--cam-muted`, Innenabstand oben 8 px. Standardtext „Ecken ziehen · Lupe zeigt den Rand genau“; während der Erkennung „Suche Blattkanten …“.
- Bottombar: links `.btn` „Neu aufnehmen“, rechts `.btn.btn--primary` „Übernehmen“; während des Begradigens „Wird begradigt …“ und deaktiviert.

## Abnahme-Kriterien

- Jeder Eck- und Mittelgriff lässt sich mit Maus und Finger ziehen; Rahmen und Abdunklung folgen ohne Ruckeln; kein Punkt verlässt das Bild.
- Ein Punkt, den man auf eine Blattecke zieht, liegt im begradigten Ergebnis auch dort (Umrechnung Anzeige ↔ Original stimmt, auch nach Drehen des Handys, weil die Bühnengröße neu gemessen wird).
- „Auto“ setzt den Rahmen auf das Erkennungsergebnis zurück.
- Sichtprüfung der Erkennung (aus dem alten Plan übernommen): Beleg auf kontrastreichem Untergrund → der vorgeschlagene Rahmen liegt auf den Blattkanten.
- Ein 12-Megapixel-Bild ist in unter 2 Sekunden begradigt; das Ergebnis ist rechteckig ohne schräge Ränder.
- Neuladen auf `/crop` landet ohne Fehler im Sucher (Guard).
- Der OpenCV-Chunk erscheint im Build als eigener Lazy-Chunk, nicht im Start-Bundle (`npm run build`-Ausgabe: Initial-Total unverändert unter 500 kB).

## Checkliste

- [ ] Refactor-Commit: `core/mat-scope.ts` mit `export class MatScope` (Code und Kommentar 1:1 aus `document-detection.ts`), dort Import statt Klasse.
- [ ] `core/filter-settings.ts`: `FilterId`, `FilterSettings`, `DEFAULT_FILTER_SETTINGS` laut Kontrakt (nur Typen und Konstante).
- [ ] `core/scan-session.ts` laut Kontrakt erweitern: `detectedCorners`, `filter` (Start `DEFAULT_FILTER_SETTINGS`), `editingPageId` (bleibt in dieser Phase `null`), `startNew(frame)` (schließt ein vorheriges Bitmap, setzt alles andere zurück, setzt `sourceFrame`), `setDetectedCorners`, `setFilter`. `setSourceFrame` entfällt; `capture.ts` ruft `startNew`. `reset()` setzt auch die neuen Felder zurück.
- [ ] `ng generate service core/perspective` → `warp(source, corners)`: `scope = new MatScope()`; Original per `OffscreenCanvas` in `ImageData` → `cv.matFromImageData`; Ziel `w`/`h` aus `quadOutputSize(corners)`; `cv.matFromArray(4, 1, cv.CV_32FC2, [...])` für Quelle (Ecken in Kontrakt-Reihenfolge) und Ziel `[0,0, w,0, w,h, 0,h]`; `cv.getPerspectiveTransform`; `cv.warpPerspective(src, dst, M, new cv.Size(w, h), cv.INTER_LINEAR, cv.BORDER_REPLICATE)`; Ergebnis per `new ImageData(new Uint8ClampedArray(dst.data), w, h)` auf ein `OffscreenCanvas` und `convertToBlob({ type: 'image/jpeg', quality: 0.92 })`. Alles im `finally` über `scope.releaseAll()`.
- [ ] `core/scan-flow.guards.ts`: `draftSourceGuard` (prüft `scanSession.sourceFrame() !== null`, sonst `router.parseUrl('/capture')`) und `draftWarpedGuard` (prüft `warpedPage() !== null`). `hasPagesGuard` folgt in Phase 6.
- [ ] `ng generate component features/crop` → `crop.ts/.html/.scss` nach „Struktur & Maße“:
      - `ngOnInit`: `detect(sourceFrame)`; Ergebnis nach `setDetectedCorners`; `setCorners(ergebnis ?? insetQuad(10 %))`. `insetQuad` als exportierte reine Funktion in `core/geometry.ts` (`insetQuad(size: Size, ratio: number): Quad`).
      - Signale: `stageSize`, `view` (computed), `dragging: { kind: 'corner' | 'edge'; index: number; pointerId: number; last: Point } | null`, `warping`.
      - Bild zeichnen in einem `effect()` auf `view` + `sourceFrame`.
      - Geometrie-Hilfen in `core/geometry.ts` ergänzen (reine Funktionen): `fitContain(source: Size, box: Size): { scale: number; offsetX: number; offsetY: number }`, `clampPoint(point: Point, size: Size): Point`, `edgeMidpoints(quad: Quad): readonly [Point, Point, Point, Point]` (Kante i = Ecke i → Ecke (i+1) % 4).
      - Lupe: eigenes `<canvas>` 84 × 84 (× DPR); `drawImage(sourceFrame, sx, sy, sw, sh, 0, 0, 84·dpr, 84·dpr)` mit `sw = sh = 84 / (2 · view.scale)` um den gezogenen Punkt; Fadenkreuz per CSS (`::before` wie im Mockup).
      - „Übernehmen“: `warping.set(true)` → `warp()` → `setWarpedPage()` → `/export`; Fehler → Hinweiszeile „Begradigen fehlgeschlagen — bitte nochmal versuchen“, `warping` zurück.
- [ ] `app.routes.ts`: Route `crop` mit `canActivate: [draftSourceGuard]` und `loadComponent`. Den veralteten Kommentar über „drei Screens“ durch einen Verweis auf diesen Plan ersetzen.

## Doc-Updates

- [ ] `docs/code-map.md`: Feature-Zeile `crop`; Core-Zeilen `mat-scope.ts`, `perspective.ts`, `filter-settings.ts`, `scan-flow.guards.ts`; `geometry.ts` um die neuen Hilfen ergänzen; `scan-session.ts`-Zweck auf „Entwurf der Seite in Arbeit“ ändern.
- [ ] `docs/glossary.md`: „Entwurf (Draft)“ — die Seite in Arbeit zwischen Auslöser und Übernahme in den Page Buffer, gehalten von `ScanSession`.
- [ ] `FINDINGS.md`: die drei übernommenen Einträge abhaken.

## Report-Back
