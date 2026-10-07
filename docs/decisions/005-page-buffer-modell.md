# 005 — Page-Buffer-Modell: Seiten als JPEG-Blobs im Arbeitsspeicher

**Status:** Akzeptiert
**Datum:** 2026-10-07

## Kontext

Ein Dokument besteht aus mehreren Seiten. Jede Seite muss sich später nachbearbeiten lassen (Ecken neu setzen, Filter ändern, drehen) und am Ende ins PDF. Ein Standbild der Kamera hat bis zu 12 MP; als `ImageBitmap` sind das rund 48 MB unkomprimiert pro Seite — bei 15 Seiten mehr, als ein Mittelklasse-Handy einem Tab gibt.

## Optionen

- **`ImageBitmap` halten** — sofort wieder zeichenbar, kein Dekodieren beim Bearbeiten; ~48 MB pro Seite.
- **JPEG-Blobs im Arbeitsspeicher** — Original, begradigtes und gefiltertes Bild als JPEG; ein Bruchteil des Speichers, Bearbeiten muss das Original einmal dekodieren.
- **IndexedDB** — übersteht ein Neuladen; Schreib-/Lese-Aufwand, Speicher-Freigabe und Aufräumen alter Stapel kommen dazu.

## Entscheidung

JPEG-Blobs im Arbeitsspeicher. Jede Seite (`ScannedPage` in `core/page-buffer.ts`) hält `source` (Original, JPEG 0,9), `corners` (in `source`-Koordinaten), `warped` (begradigt, ungefiltert), `filter`, `output` (begradigt und gefiltert, geht ins PDF), `rotation` und `thumbnailUrl` (Object-URL, 320 px lange Kante, Drehung eingerechnet).

Der Entwurf (`ScanSession`) bleibt vom Buffer getrennt: Bearbeiten kopiert eine Seite in den Entwurf (`startEdit` dekodiert `source`) und schreibt sie per `replace` an derselben Stelle zurück. Beim Bearbeiten wird das vorhandene `source`-JPEG weitergereicht statt neu kodiert, damit wiederholtes Bearbeiten keine Qualität kostet.

Eigentümer der Vorschau-URLs ist der `PageBuffer`: `replace`, `discard` und `clear` geben sie frei, `remove` nicht — eine gelöschte Seite kann per „Rückgängig“ zurückkommen, erst `discard` nach Ablauf des Toasts gibt endgültig frei.

## Konsequenzen

- Neuladen verliert den Stapel. Das Retten über IndexedDB liegt im Backlog.
- Nachbearbeiten braucht einmal Dekodieren des Originals (`createImageBitmap`) — spürbar nur als kurze Verzögerung beim Antippen einer Kachel.
- Jede Seite trägt drei JPEGs; bei 12 MP grob 3–6 MB pro Seite statt ~48 MB. Ob 15 Seiten auf dem Handy flüssig bleiben, prüft der Smoke-Test.
