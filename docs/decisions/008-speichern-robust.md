# 008 — Speichern mit Schattenentfernung robust machen

**Status:** Akzeptiert
**Datum:** 2026-10-19

## Kontext

Auf einem POCO X6 Pro (Chrome, Mali-Grafikchip) bleibt „Speichert …“ mit eingeschalteter Schattenentfernung für immer stehen; schon die Vorschau wurde den Schatten nicht los. Vorschau und Speichern warten auf dieselbe zwischengespeicherte Verstärkungskarte aus `core/ml/doc-shadow.ts`, beide ohne Zeitgrenze. ORT lief bisher mit WebGPU, sobald der Browser `navigator.gpu` anbietet — dieser Pfad wurde nie im echten Browser geprüft. WASM ist gemessen (Entwicklungsrechner, ein Thread, 0,7 s pro Lauf, ADR-007). Mutmaßung, nur am Gerät belegbar: der WebGPU-Lauf hängt auf dem Mali-Chip. Zusätzlich rechnete „Fertig“ in voller Auflösung (bis 12 MP, ADR-006), was dem Handy Speicher und Zeit kostet.

## Optionen

- **WebGPU mit WASM-Rückfall beibehalten** — ORT fällt nur zurück, wenn das Anlegen der Sitzung scheitert, nicht wenn ein Lauf hängt. Behebt den Fehler nicht.
- **Nur WASM** — gemessener Pfad, auf allen Geräten gleich; langsamer, wo WebGPU funktionieren würde.
- **Alles lassen, nur Zeitgrenzen** — der Nutzer sieht einen Fehler statt eines Hängers, aber die Schattenentfernung geht auf dem Gerät weiterhin nie.

## Entscheidung

Nur WASM (`executionProviders: ['wasm']`). Dazu Zeitgrenzen: 30 s für einen Modelllauf (Vorbereitung + `session.run`, ohne Download), 60 s fürs ganze Speichern ab geladenem Modell. Eine Karte, deren Lauf die Zeitgrenze reißt, wird aus dem Zwischenspeicher verworfen; der nächste Aufruf rechnet neu. Gespeicherte Seiten werden auf 3000 px an der langen Kante gedeckelt (A4 rund 250 dpi) — das schränkt ADR-006 („volle Auflösung für Seite und PDF“) ein.

## Konsequenzen

- Langsamer auf Geräten, auf denen WebGPU funktioniert hätte.
- Der synchrone WASM-Lauf blockiert den Hauptthread. Die 30-s-Grenze fängt daher nur asynchrones Hängen (Lauf kommt nie zurück); ein endlos rechnender WASM-Lauf würde den Timer nicht auslösen.
- Ein Lauf, der die Zeitgrenze reißt, wird nicht abgebrochen — er läuft im Hintergrund weiter, sein Ergebnis wird verworfen.
- Seiten über 3000 px lange Kante werden beim Speichern verkleinert; kleinere bleiben unverändert (`readPixels` vergrößert nie).
