# CamScanner — Kontext

## Ziel & Vision

Eine vollständig clientseitige Progressive Web App (PWA), die Dokumente über die
Gerätekamera scannt, automatisch zuschneidet und begradigt, den Scan-Look
optimiert und mehrseitige PDFs erzeugt — ohne Backend, ohne Login, ohne Upload.
Zielgruppe: private Nutzung (Rechnungen, Belege, Notizen unterwegs abfotografieren
statt eine App aus dem Store zu brauchen).

## Scope

- Dokumente per Kamera erfassen (`getUserMedia`)
- Automatische Kantenerkennung + 4-Punkt-Perspektivkorrektur (OpenCV.js)
- Bildoptimierung / Scan-Look (Kontrast, adaptive Threshold, Graustufen)
- Mehrseitige Dokumente sammeln (Page Buffer) und als PDF exportieren (`pdf-lib`)
- Teilen über die Web Share API (Android Share Sheet), Download als Fallback
- Installierbar als PWA, offlinefähig bis auf das Teilen selbst
- Optional (spätere Phase): ML-gestützte Bildverbesserung im Browser
  (DocAligner, DocShadow via `onnxruntime-web`) für schwierige Aufnahmen
  (Schatten, schlechter Kontrast, gewölbte Seiten)

## Nicht-Ziele

- Kein Backend, keine Server-Verarbeitung, kein Upload der Bilder irgendwohin
- Keine Authentifizierung / kein Multi-User-Betrieb
- Keine Cloud-Synchronisation (Google Drive/etc. laufen ausschließlich über die
  Share-API des Betriebssystems, nicht über eigene Integration)
- Kein Pflicht-OCR — wenn überhaupt, rein optional und explizit angestoßen
  (Tesseract.js ist im Konzept nur als Option genannt, nicht im MVP-Scope)
- Kein Support für sehr große Dokumente (>100 Seiten) als Designziel — RAM-Limit
  akzeptiert, kein Streaming-PDF-Aufbau geplant

## Stack

| Layer | Choice |
|---|---|
| Framework | Angular 22 (standalone, zoneless, signals-first) |
| Sprache | TypeScript ~6.0 (strict) |
| Styling | SCSS |
| Bildverarbeitung | OpenCV.js (Kanten/Kontur/Warp), Canvas API (Filter) |
| PDF | pdf-lib |
| Sharing | Web Share API + Download-Fallback |
| Optional ML | onnxruntime-web (DocAligner, DocShadow) — Opt-in, nicht im MVP |
| PWA | `@angular/service-worker` (Angular-PWA-Schematic) |
| Tests | Vitest (Angular-Default) |
| Build | Angular CLI / `@angular/build` (esbuild-basiert) |

Begründung Angular: User-Wunsch (explizit im Bootstrap-Interview), zoneless +
Signals passen gut zu einer canvas-/state-lastigen App ohne dass Change
Detection bei jedem Kamera-Frame durchrattert.

## Constraints

- Deployment: GitHub Pages (HTTPS automatisch — `getUserMedia` verlangt
  Secure Context; Ausnahme nur `localhost` in Dev)
- Solo-Projekt, kein Team, kein Zeitdruck — Freizeitprojekt ohne Deadline
- WASM-Multithreading (für `onnxruntime-web`, falls die ML-Phase kommt)
  braucht Cross-Origin-Isolation-Header (`COOP: same-origin`,
  `COEP: require-corp`) — GitHub Pages kann keine Custom-Header setzen, das ist
  ein bekannter Konflikt, falls Phase „ML-Erweiterung" umgesetzt wird
  (→ dann Hosting-Alternative prüfen oder auf Single-Thread-WASM-Fallback
  bauen, siehe Konzept Kapitel 12.2)

## Meilensteine

1. **MVP Kern-Pipeline** — Kamera-Stream, Frame-Capture, OpenCV-Kantenerkennung,
   Perspektivkorrektur, ein Dokument als Einzelseiten-PDF exportieren
2. **Multi-Page-Flow** — Page Buffer (mehrere Seiten sammeln, Reihenfolge
   ändern/löschen), Multi-Page-PDF
3. **Bildoptimierung (klassisch)** — Scan-Look-Filter: CLAHE, Sauvola/Otsu,
   Unsharp Mask, Graustufen-Modus, Background-Division gegen Schatten
4. **PWA-Hardening** — Manifest/Icons/Service-Worker verifizieren, Offline-Test,
   „Installierbar"-Kriterien (Lighthouse PWA-Checks)
5. **Sharing** — Web Share API (Android Share Sheet) mit Download-Fallback für
   Browser ohne Support
6. **Optional: ML-Erweiterung** — DocAligner als Fallback für die
   Kantenerkennung, DocShadow für Schattenentfernung via `onnxruntime-web`,
   nur wenn die klassische Pipeline in der Praxis nicht reicht

Reihenfolge ist grobe Orientierung, kein Fixplan — Detailphasen entstehen beim
`/plan`-Lauf pro Meilenstein.

## Offene Fragen

- Welche konkreten ML-Modelle (Kapitel 12 im Konzept) tatsächlich Mehrwert
  bringen, klärt sich erst nach Meilenstein 3 in der Praxis — bewusst nicht
  vorab entschieden.
- Hosting-Alternative für Meilenstein 6 (Cross-Origin-Isolation-Header),
  falls GitHub Pages das nicht hergibt — offen bis die Phase ansteht.
