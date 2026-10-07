# Phase 6 — Page Buffer & Seitenübersicht

**Rating:** heikel — Datenmodell mehrerer Seiten im Arbeitsspeicher (ADR), Lebenszyklus von Object-URLs, Umsortieren per Ziehen, Bearbeiten einer vorhandenen Seite.

Ergebnis: Mehrere Seiten lassen sich nacheinander scannen. Im Sucher zeigen ein Vorschaubild mit Zähler und „Fertig“ den Stapel; `/pages` sieht aus wie Mockup-Figur 4 (sortieren, löschen mit Rückgängig, drehen, nachbearbeiten); der Export baut ein mehrseitiges PDF.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`ScannedPage`, `PageBuffer`, `createPage`, `ScanSession.startEdit`, `hasPagesGuard`), Bildschirm-Fluss
- `artifacts/camscanner-mockup.html` — Figur 4 „Seitenübersicht“ (Klassen `.grid`, `.tile`, `.frame`, `.num`, `.del`, `.tile.drag`, `.tile.ghost`, `.tile.add`) und Figur 1 (`.last-wrap`, `.last`, `.badge`, `.done`)
- `src/app/core/scan-session.ts`, `scan-flow.guards.ts`, `perspective.ts`, `pdf.ts`, `toast.ts`; `src/app/features/crop/`, `features/export/`, `features/capture/`
- `docs/concept.md` Kapitel 4.5 und 9 (Page Buffer, Speicherstrategie Variante 1)
- Vault-Fehlerklassen: `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **ADR-005 Page-Buffer-Modell:** Jede Seite hält `source` (Original als JPEG 0.9, statt 48 MB `ImageBitmap` pro 12-MP-Seite), `corners`, `warped`, `filter`, `output`, `rotation`, `thumbnailUrl`. Alles im Arbeitsspeicher, kein Speichern über Neuladen (Backlog). Entwurf (`ScanSession`) und Buffer sind getrennt: Bearbeiten kopiert eine Seite in den Entwurf und schreibt sie per `replace` zurück.
- **Thumbnail:** 320 px lange Kante aus `output`, Drehung eingerechnet (auf das Canvas gedreht gezeichnet), als Object-URL. Eigentümer der URL ist der `PageBuffer`: `replace` und `clear` geben frei; `remove` gibt **nicht** frei (Rückgängig), erst `discard`.
- **Übernehmen in den Buffer** passiert in dieser Phase direkt in `/crop` („Übernehmen“): `warp()` → `createPage({ …, filter: DEFAULT_FILTER_SETTINGS })` mit `output = warped` (Filter folgen in Phase 7/8) → `add` bzw. bei `editingPageId` `replace` (Drehung der alten Seite bleibt) → `scanSession.reset()` → `/capture` (neu) bzw. `/pages` (bearbeitet). Phase 8 verlegt das an „Fertig“ im Filter.
- **Kachel antippen** → `scanSession.startEdit(page)` (dekodiert `page.source` per `createImageBitmap`, setzt `corners`, `detectedCorners = null`, `filter`, `editingPageId`) → `/crop`. Im Bearbeiten-Modus zeigt `/crop` links „Abbrechen“ statt „Neu aufnehmen“, Zurück-Pfeil und „Abbrechen“ führen ohne Änderung nach `/pages`; „Auto“ ruft dort zuerst `detect()` nach.
- **Umsortieren:** Finger/Maus 300 ms auf einer Kachel halten, ohne sich mehr als 8 px zu bewegen → Zieh-Modus. Gezogene Kachel folgt dem Zeiger (`translate`, `rotate(3deg) scale(1.06)`, Rand Akzent, Schatten `0 16px 30px #000b`), ihr Platz zeigt eine gestrichelte Lücke. Ziel-Index = Kachel unter dem Zeiger (`document.elementFromPoint`, `data-index`). Loslassen → `move(from, to)`. Kurzes Antippen ohne Halten = Bearbeiten. Während des Ziehens `touch-action: none` auf der Kachel; sonst scrollt das Raster normal.
- **Löschen:** „x“ auf jeder Kachel (außer im Auswahl-Modus) → `remove` → Toast „Seite gelöscht“ mit Aktion „Rückgängig“ (5 s; Aktion → `restore`, Ablauf → `discard`).
- **Auswählen & Drehen:** „Auswählen“ (Topbar rechts) schaltet den Auswahl-Modus; Knopf heißt dann „Abbrechen“. Im Auswahl-Modus schaltet Antippen die Markierung (Rand Akzent), Ziehen ist aus, unter der Topbar steht „Seiten antippen zum Auswählen“. „Drehen“ dreht im Auswahl-Modus die markierten Seiten (deaktiviert ohne Markierung), sonst **alle** Seiten um 90° im Uhrzeigersinn. `title`/`aria-label` sagt das jeweils: „Alle Seiten drehen“ bzw. „Markierte Seiten drehen“.
- **Leerer Stapel** auf `/pages` (nach dem Löschen der letzten Seite): nur die Kachel „Seite hinzufügen“, „PDF erstellen“ deaktiviert.
- **Export** nimmt ab jetzt `pageBuffer.pages()` (`output`, `rotation`); Guard `hasPagesGuard`; Zurück → `/pages`; „Neues Dokument“ → `pageBuffer.clear()`, `scanSession.reset()`, `/capture`.

## Struktur & Maße (Abnahme-Punkte)

Sucher (Mockup-Figur 1, untere Leiste), nur bei mindestens einer Seite:

- Linke Zelle: Vorschaubild 48 × 48 px, Rand `2px solid #fff`, Radius 10, `object-fit: cover`; Zähler-Plakette oben rechts (−8 px/−8 px), Mindestbreite 22, Höhe 22, Pillenform, `--cam-accent`/`--cam-accent-ink`, `.72rem` fett. Ganzes Element ist ein Button „Seitenübersicht öffnen, N Seiten“ → `/pages`.
- Rechte Zelle: `.btn.btn--small.btn--primary` „Fertig“ → `/pages`, rechtsbündig.

Seitenübersicht (Mockup-Figur 4):

- Topbar: `back` → `/capture`; Titel „1 Seite“ / „N Seiten“; rechts `.btn.btn--small` „Auswählen“/„Abbrechen“.
- Raster: zwei Spalten, Lücke `14px 12px`, Innenabstand `6px 14px`, scrollt senkrecht.
- Kachel: Rahmen `aspect-ratio: 3/4`, Hintergrund `--cam-surface`, Radius 10, Innenabstand 8, Rand 2 px transparent; Bild `object-fit: contain`, Schatten `0 2px 8px #0008`; Beschriftung „Seite N“ darunter `.72rem` `--cam-muted`, Abstand unten 14 px.
- „x“: 24 px Kreis oben rechts (−7 px/−7 px), `--cam-danger`, weißes `close`-Icon 12 px, Strich 3; Trefferfläche 44 px; `aria-label="Seite N löschen"`.
- Kachel „Seite hinzufügen“: Rahmen gestrichelt `2px dashed --cam-line`, transparent, `plus`-Icon 28 px in `--cam-accent`, Beschriftung in `--cam-accent`.
- Bottombar: Hintergrund `--cam-bg`, obere Linie `1px solid --cam-line`; links `.btn` mit `rotate`-Icon „Drehen“, rechts `.btn.btn--primary` „PDF erstellen“ mit `flex: 1`.

## Abnahme-Kriterien

- Drei Seiten nacheinander scannen: nach jeder Übernahme zurück im Sucher, Zähler 1 → 2 → 3, Vorschaubild zeigt die letzte Seite.
- Umsortieren per Halten-und-Ziehen mit Finger und Maus; Reihenfolge im PDF entspricht der Übersicht.
- Löschen + „Rückgängig“ stellt die Seite an derselben Stelle wieder her; ohne Rückgängig ist sie nach 5 s endgültig weg.
- „Drehen“ ohne Auswahl dreht alle, mit Auswahl nur die markierten; im PDF erscheinen gedrehte Seiten gedreht.
- Antippen einer Seite → Zuschneiden mit den gespeicherten Ecken; geänderte Ecken ersetzen die Seite an ihrer Stelle; „Abbrechen“ lässt sie unverändert.
- PDF mit 5 Seiten öffnet sich vollständig in einem PDF-Betrachter.
- 15 Seiten in voller Auflösung: kein Absturz, Übersicht scrollt flüssig (Smoke-Punkt 3).

## Checkliste

- [ ] `docs/decisions/005-page-buffer-modell.md` nach den Entscheidungen oben (Kontext / Optionen: ImageBitmap halten · JPEG-Blobs · IndexedDB / Entscheidung / Konsequenzen: Neuladen verliert Stapel; Re-Crop braucht Dekodieren).
- [ ] `ng generate service core/page-buffer` laut Kontrakt; `Rotation` von `pdf.ts` hierher verschieben, `pdf.ts` importiert sie.
- [ ] `core/page-factory.ts`: `createPage(input)` — `source` aus `sourceFrame` per `OffscreenCanvas` + `convertToBlob({ type: 'image/jpeg', quality: 0.9 })`; `output = warped` (bis Phase 7); `thumbnailUrl` über Hilfsfunktion `renderThumbnail(blob, rotation): Promise<string>` (exportiert, wird von `PageBuffer.rotate` mitbenutzt).
- [ ] `ScanSession.startEdit(page)` laut Entscheidungen.
- [ ] `scan-flow.guards.ts`: `hasPagesGuard` (`pageBuffer.count() > 0`).
- [ ] `features/crop`: Übernehmen-Ablauf auf den Buffer umstellen; Bearbeiten-Modus (Beschriftung, Ziele, „Auto“ mit Nach-Erkennen).
- [ ] `features/capture`: linke und rechte Zelle der unteren Leiste nach „Struktur & Maße“.
- [ ] `ng generate component features/pages` nach „Struktur & Maße“ und Entscheidungen; Ziehen in `features/pages/page-drag.ts` (Klasse mit Zustand `pressTimer`, `dragIndex`, `overIndex`, `pointer`), damit `pages.ts` lesbar bleibt.
- [ ] `features/export`: Quelle auf `pageBuffer.pages()`, Guard, Zurück-Ziel, „Neues Dokument“.
- [ ] `app.routes.ts`: Route `pages` mit `hasPagesGuard`; `export` auf `hasPagesGuard` umstellen.

## Doc-Updates

- [ ] `docs/code-map.md`: Feature-Zeile `pages`; Core-Zeilen `page-buffer.ts`, `page-factory.ts`; `capture` um die untere Leiste ergänzen.
- [ ] `docs/glossary.md`: „Page“ und „Page Buffer“ auf das Modell aus ADR-005 bringen (Felder, nur Arbeitsspeicher, Neuladen verliert den Stapel); „Auswahl-Modus“.

## Report-Back
