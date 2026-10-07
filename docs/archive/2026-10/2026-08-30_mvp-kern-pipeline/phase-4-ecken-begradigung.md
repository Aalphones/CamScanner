# Phase 4 — Ecken-Korrektur & Begradigung

**Rating:** standard — Zieh-Interaktion auf einem Canvas plus ein
OpenCV-Aufruf, beides mit klarem Weg.

Ergebnis: Der Bildschirm `/crop` zeigt das Standbild mit vier Ziehpunkten, der
Nutzer justiert nach, und „Übernehmen" erzeugt das begradigte Blatt.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`Quad`, `warp`, `ScanSessionService`)
- `src/app/core/geometry.ts`, `src/app/core/document-detection.ts`
- `docs/conventions/angular.md` — Critical Rules 1, 3, 4

## Bildschirm-Struktur (freihändig, verbindlich als Abnahme-Punkt)

Kein Mockup vorhanden — diese Struktur ist die Festlegung, gegen die geprüft
wird:

- Vollflächiger dunkler Hintergrund, das Standbild mittig eingepasst
  (`object-fit: contain`), darüber ein Canvas gleicher Größe für Rahmen und
  Ziehpunkte.
- Vier Ziehpunkte als weiße Kreise, 20 px sichtbar, aber mit 44 px großer
  Trefferfläche — sonst trifft niemand mit dem Daumen.
- Zwischen den Punkten ein durchgehender heller Linienzug, halbtransparente
  Abdunklung außerhalb des Vierecks.
- Unten eine Leiste mit zwei Knöpfen: links „Ganzes Bild" (setzt die Ecken auf
  die vier Bildecken zurück), rechts „Übernehmen" (Primär-Aktion, farbig).
- Oben rechts ein dezentes Info-Zeichen; angetippt erscheint einzeilig: „Die
  vier Punkte auf die Ecken des Blattes ziehen."
- Hat die Erkennung nichts gefunden, startet der Bildschirm mit einem Viereck
  bei 10 % Randabstand und blendet einmalig ein: „Keine Blattkanten erkannt —
  Ecken bitte von Hand setzen."

## Abnahme-Kriterien

- Jeder der vier Punkte lässt sich mit Maus und Finger verschieben; der Rahmen
  folgt live.
- Punkte lassen sich nicht aus dem Bild schieben (auf die Bildgrenzen begrenzt).
- Die Anzeige rechnet korrekt zwischen Anzeige-Koordinaten und
  Original-Bild-Koordinaten um: ein Punkt, den man auf eine Blattecke zieht,
  landet im begradigten Ergebnis auch dort.
- „Übernehmen" erzeugt ein rechteckiges Bild ohne schräge Ränder und wechselt
  auf `/result`.
- Neuladen der Seite auf `/crop` landet ohne Fehlermeldung wieder im Sucher.
- Ein 12-Megapixel-Bild ist in unter 2 Sekunden begradigt; währenddessen ist
  „Übernehmen" deaktiviert und zeigt „Wird begradigt …".

## Checkliste

- [ ] `ng generate service core/perspective` → `warp(source, corners)`:
      `cv.matFromImageData` des Originals, `getPerspectiveTransform` von den
      vier Ecken auf `[0,0], [w,0], [w,h], [0,h]` mit `w`/`h` aus
      `quadOutputSize`, `warpPerspective` mit `INTER_LINEAR`, Ergebnis in ein
      `OffscreenCanvas` und über `convertToBlob({ type: 'image/jpeg', quality: 0.92 })`
      zurückgeben. Alle Mats im `finally` freigeben.
- [ ] `src/app/core/scan-session.guard.ts` — `CanActivateFn`, das auf
      `sourceFrame()` prüft und sonst `router.parseUrl('/capture')` liefert.
      Auf den Routen `crop` und `result` eintragen (`result` prüft zusätzlich
      `warpedPage()`).
- [ ] `ng generate component features/crop` → `crop.ts/.html/.scss`
      - beim Start: `detect()` aufrufen, Ergebnis nach `setCorners()`; bei
        `null` das 10-%-Viereck setzen und den Hinweis zeigen
      - Ziehen über Pointer-Events (`pointerdown`/`pointermove`/`pointerup`,
        `setPointerCapture`) — ein Ereignis-Typ für Maus und Finger, kein
        getrennter Touch-Zweig
      - Ecken als Signal, Zeichnen in einem `effect()` auf das Canvas
      - Umrechnung Anzeige ↔ Original über einen einzigen abgeleiteten
        Skalierungsfaktor, nicht an mehreren Stellen einzeln
      - „Übernehmen": `warp()` → `setWarpedPage()` → `/result`
- [ ] BEM-Klassen `.crop`, `.crop__canvas`, `.crop__actions`, `.crop__hint`
- [ ] Route `crop` scharf schalten.

## Doc-Updates

- [ ] `docs/code-map.md`: Feature-Zeile `crop`, `core/perspective.ts`,
      `core/scan-session.guard.ts`

## Report-Back
