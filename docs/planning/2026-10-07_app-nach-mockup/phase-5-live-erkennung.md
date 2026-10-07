# Phase 5 — Live-Rahmen im Sucher

**Rating:** heikel — Erkennungs-Schleife neben einem laufenden Kamerabild (Takt, keine Überlappung, Akku), Umrechnung für `object-fit: cover`, Stabilitäts-Kriterium.

Ergebnis: Im Sucher liegt ein Akzent-Rahmen mit Eckpunkten auf dem erkannten Dokument (Mockup-Figur 1). Hält man ruhig, pulsiert der Rahmen und die Hinweis-Pille sagt „Dokument erkannt — halten …“.

## Kontext — vorher lesen

- `artifacts/camscanner-mockup.html` — Figur 1; Klassen `.tilt .outline`, `.outline i`, `@keyframes pulse`, `.hint .dot`
- `src/app/features/capture/` (Stand nach Phase 2), `src/app/core/camera.ts`, `src/app/core/document-detection.ts`, `src/app/core/geometry.ts`
- `docs/decisions/003-*.md` — Erkennung auf verkleinerter Kopie
- Vault-Fehlerklassen: `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Takt:** höchstens ein Erkennungslauf alle 250 ms (`LIVE_DETECTION_INTERVAL_MS`), nie zwei gleichzeitig (der nächste startet erst nach Ende des vorigen + Wartezeit). Gestartet nur im Zustand `running`, angehalten bei `document.visibilityState === 'hidden'`, beim Auslösen und in `ngOnDestroy`.
- **Vorschau-Bild:** `Camera.grabPreviewFrame(video, maxEdge = 480)` → `createImageBitmap(video, { resizeWidth, resizeHeight, resizeQuality: 'low' })` (Seitenverhältnis aus `videoWidth`/`videoHeight`). Nach `detect()` sofort `bitmap.close()`.
- **Wiederverwendung:** `DocumentDetection.detect()` unverändert (das Vorschau-Bild ist kleiner als die 1024-px-Arbeitskante, es wird nicht weiter verkleinert).
- **Umrechnung auf den Bildschirm:** neue reine Funktion `fitCover(source: Size, box: Size)` in `core/geometry.ts` (wie `fitContain`, aber `Math.max`), dazu `mapQuad(quad, view)`. Quelle ist die Vorschau-Größe, Box die Größe des Video-Elements.
- **Stabil** = drei aufeinanderfolgende Treffer, bei denen jede Ecke weniger als 3 % der Vorschau-Diagonale vom vorigen Treffer abweicht (`STABLE_FRAMES = 3`, `STABLE_TOLERANCE = 0.03`). Ein Fehltreffer setzt den Zähler zurück.
- **Anzeige:** Rahmen sichtbar, sobald der letzte Lauf ein Viereck lieferte; Puls und Text „Dokument erkannt — halten …“ nur, wenn stabil. Ohne Treffer bleibt der Text aus Phase 2.
- **Kein Mitnehmen der Live-Ecken nach `/crop`:** Zuschneiden erkennt auf dem vollen Standbild ohnehin neu.

## Struktur & Maße (Abnahme-Punkte, Mockup-Figur 1)

- SVG über dem Video, volle Fläche, `pointer-events: none`.
- Rahmen: `<polygon>` Kontur `--cam-accent` 2 px, Füllung `#3ddc9722`; stabil: Animation `pulse` 1,8 s `ease-in-out` unendlich, bei 50 % Füllung `#3ddc9738`. `prefers-reduced-motion: reduce` → keine Animation.
- Eckpunkte: Kreise r = 6, Füllung `--cam-accent`, Kontur `--cam-accent-ink` 2 px.
- Hinweis-Pille stabil: Punkt 8 px `--cam-accent` vor dem Text, Abstand 8 px.

## Abnahme-Kriterien

- Auf dem Handy folgt der Rahmen einem Blatt sichtbar (Verzögerung höchstens ~0,5 s) und liegt auf den Blattkanten, auch wenn das Video seitlich beschnitten ist (`cover`).
- Das Kamerabild bleibt flüssig; Bedienelemente reagieren ohne Verzögerung.
- Tab in den Hintergrund → keine Erkennungsläufe mehr (Performance-Profil oder `console.count` während der Entwicklung, vor dem Commit entfernen).
- Auslöser funktioniert unverändert; nach Rückkehr in den Sucher läuft der Rahmen wieder.

## Checkliste

- [ ] `core/camera.ts`: `grabPreviewFrame(video, maxEdge)`.
- [ ] `core/geometry.ts`: `fitCover`, `mapQuad`, `quadsClose(a: Quad, b: Quad, tolerance: number): boolean`.
- [ ] `features/capture/live-detection.ts` (Feature-eigene Logik, ohne Decorator-Service: Klasse mit `start(video)`, `stop()`, Signalen `quad: Signal<Quad | null>` in Vorschau-Koordinaten, `previewSize`, `stable: Signal<boolean>`; bekommt `Camera` und `DocumentDetection` im Konstruktor). Schleife mit `setTimeout`, Abbruch-Flag, `visibilitychange`-Listener, der in `stop()` entfernt wird.
- [ ] `capture.ts/.html/.scss`: `LiveDetection` anlegen, im `effect()` auf `state() === 'running'` starten, sonst stoppen; Videogröße per `ResizeObserver`; SVG mit `mapQuad(quad, fitCover(previewSize, videoSize))`.

## Doc-Updates

- [ ] `docs/code-map.md`: Feature `capture` um `live-detection.ts` ergänzen; `geometry.ts` um `fitCover`, `mapQuad`, `quadsClose`.
- [ ] `docs/glossary.md`: „Live-Rahmen“ — Erkennung auf dem laufenden Kamerabild, 4 Läufe/s, „stabil“ nach drei ruhigen Treffern.

## Report-Back
