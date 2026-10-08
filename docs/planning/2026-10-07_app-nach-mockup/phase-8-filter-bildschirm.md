# Phase 8 — Filter-Bildschirm „Scan-Look“

**Rating:** standard — Bildschirm nach Mockup über ein fertiges Rechenwerk; Ablauf-Umstellung ist im Kontrakt festgelegt.

Ergebnis: Zwischen Zuschneiden und Page Buffer liegt `/filter` nach Mockup-Figur 3: große Vorschau, fünf Filter-Chips mit echtem Effekt, Regler für Kontrast und Helligkeit. „Fertig“ legt die Seite in den Buffer.

## Kontext — vorher lesen

- `README.md` dieses Plans — Bildschirm-Fluss, Kontrakt
- `artifacts/camscanner-mockup.html` — Figur 3 „Filter“; Klassen `.preview`, `.panel`, `.chips`, `.chip`, `.th`, `.row`, `.slider`
- `src/app/core/image-filters.ts`, `page-factory.ts`, `scan-session.ts`, `page-buffer.ts`, `filter-settings.ts`; `src/app/features/crop/`
- Vault-Fehlerklassen: `frameworks/css-architecture.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Ablauf:** `/crop` „Übernehmen“ → `warp()` → `setWarpedPage()` → `/filter` (statt direkt in den Buffer). `/filter` „Fertig“ → volle Auflösung `renderFiltered(warped, filter)` → `createPage` (mit `editingPageId` als `id` und der alten Drehung beim Bearbeiten) → `add`/`replace` → `reset()` → `/capture` bzw. `/pages`. Zurück-Pfeil → `/crop` (Entwurf bleibt erhalten). Der Zwischenschritt aus Phase 7 in `createPage` entfällt: `output` kommt jetzt als Parameter herein.
- **Startwert:** neue Seite `DEFAULT_FILTER_SETTINGS` (`auto`); bearbeitete Seite ihre gespeicherten Einstellungen.
- **Vorschau:** `renderFiltered(warped, settings, 1200)`; neu bei jeder Änderung, Regler entprellt mit 150 ms; ein veraltetes Ergebnis (Token-Zähler wie in `export`) wird verworfen. Während des Rechnens bleibt die alte Vorschau stehen.
- **Chip-Bilder:** beim Betreten einmal je Filter `renderFiltered(warped, { …settings, filter }, 160)`, nacheinander (nicht parallel, OpenCV ist einfädig).
- **Regler** behalten ihren Wert beim Filterwechsel. Native `<input type="range" min="0" max="100" step="1">`, gestaltet nach Mockup.
- **Beschreibungszeile** (Element ohne Mockup, als Erklärung für Erstnutzer): unter den Chips in `--cam-muted` `.72rem` der Text zum gewählten Filter — Original „Unverändert, nur begradigt“ · Auto „Farben bleiben, Schatten und Kontrast werden ausgeglichen“ · Scan „Graustufen mit kräftigem Kontrast, wie ein Scanner“ · S/W „Reines Schwarz-Weiß, kleinste Datei“ · Grau „Graustufen, sonst unverändert“.
- **Schalter „Schatten entfernen“** gibt es in dieser Phase nicht (kommt in Phase 11).

## Struktur & Maße (Abnahme-Punkte, Mockup-Figur 3)

- Topbar: `back`; Titel „Scan-Look“; rechts `.btn.btn--small.btn--primary` „Fertig“ (beim Speichern „Speichert …“, deaktiviert).
- Vorschau: `flex: 1`, Hintergrund `#0f1215`, Bild zentriert `object-fit: contain`, Schatten `0 8px 24px #0009`.
- Panel: Hintergrund `--cam-surface`, Radius `22px 22px 0 0`, Innenabstand `14px 14px max(18px, env(safe-area-inset-bottom))`, Lücke 14 px.
- Chips: waagerecht scrollend ohne Scrollbalken, Lücke 8; je Chip ein Button mit Bild 56 × 72, Radius 10, Hintergrund `--cam-surface-2`, Rand 2 px transparent (gewählt: `--cam-accent`), darunter Name `.72rem` (`--cam-muted`, gewählt `--cam-text`); `aria-pressed` für den gewählten.
- Regler-Zeilen: Beschriftung „Kontrast“ / „Helligkeit“ 68 px breit `--cam-muted` `.8rem`; Spur 4 px `--cam-line`, gefüllter Teil `--cam-accent` (über `background: linear-gradient(...)` mit CSS-Variable `--fill`), Griff 18 px weiß mit Schatten `0 2px 6px #0008`. Doppeltippen auf die Beschriftung setzt auf 50 zurück.

## Abnahme-Kriterien

- Chip antippen wechselt die Vorschau sichtbar; die Chip-Bilder zeigen den echten Effekt der eigenen Seite.
- Regler ändern die Vorschau flüssig, ohne dass der Bildschirm einfriert.
- „Fertig“ legt die Seite mit genau dem gewählten Look in den Buffer (Übersicht und PDF stimmen mit der Vorschau überein).
- Bearbeiten einer Seite aus der Übersicht: Zuschneiden → Filter zeigt die gespeicherten Einstellungen → „Fertig“ ersetzt die Seite an ihrer Stelle.
- Neuladen auf `/filter` landet im Sucher.

## Checkliste

- [x] `ng generate component features/filter` nach „Struktur & Maße“ und Entscheidungen; Texte als `const FILTER_LABELS: Record<FilterId, { name: string; description: string }>` (Reihenfolge der Chips: Original, Auto, Scan, S/W, Grau).
- [x] `features/crop`: „Übernehmen“ auf `/filter` umstellen; Übernahme-in-den-Buffer-Code von dort entfernen.
- [x] `core/page-factory.ts`: `createPage` erhält `output` als Parameter; der Phase-7-Zwischenschritt entfällt.
- [x] `app.routes.ts`: Route `filter` mit `draftWarpedGuard`.

## Doc-Updates

- [x] `docs/code-map.md`: Feature-Zeile `filter`; `crop` und `page-factory.ts` an den neuen Ablauf anpassen.
- [x] `docs/glossary.md`: „Scan-Look“ um die Bildschirm-Bezeichnung und die Regler ergänzen.

## Report-Back

Umgesetzt wie festgelegt. Abweichungen und Hinweise:

- `createPage` nahm `output` schon seit Phase 7 als Parameter — der Checklisten-Punkt war erledigt, es blieb nichts zu ändern.
- Rechen-Aufträge der Vorschau stapeln sich nicht: läuft eine Rechnung, wird nach ihr nur der letzte Stand noch einmal gerechnet, das veraltete Ergebnis wird verworfen (statt Token-Zähler).
- Fehlerzeile im Panel („Das hat nicht geklappt — bitte nochmal versuchen“) bei fehlgeschlagener Vorschau oder fehlgeschlagenem Speichern — im Mockup nicht vorgesehen.
- Nicht auf dem Gerät geprüft: Reglergefühl, Laufzeit von „Fertig“ bei Auto, Chip-Bilder. Build, Lint und Tests sind grün.
