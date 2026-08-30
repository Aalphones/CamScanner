# 002 — OpenCV.js-Einbindung

**Status:** Akzeptiert
**Datum:** 2026-08-30

## Kontext

OpenCV.js muss im Browser verfügbar sein, ohne das Start-Bundle einer
kamera-lastigen PWA aufzublähen. Zwei Wege standen zur Wahl: das npm-Paket
`@techstark/opencv-js` (bringt TS-Typen mit) oder das offizielle `opencv.js`
von `docs.opencv.org` als `<script>`-Tag zur Laufzeit nachgeladen.

## Entscheidung

`@techstark/opencv-js`, per dynamischem `import()` in einem eigenen
`OpencvLoader`-Service (`src/app/core/opencv-loader.ts`) gekapselt. Der Service
cached die Lade-Promise (`loadPromise`), sodass mehrfache Aufrufe von `load()`
nur einmal tatsächlich laden.

Typ-Alias `export type OpenCv = CV` (aus dem Paket-Re-Export) — alle
Aufrufer typisieren gegen `OpenCv`, nie gegen `any`.

## Begründung

Der Build lief beim ersten Versuch sauber durch — kein CommonJS-Fehler, kein
gesprengtes Bundle-Budget nötig. Der Fallback (offizielles `opencv.js` als
`<script>`-Tag) war damit nicht nötig.

## Konsequenzen

- **Kontrakt-Abweichung von der Plan-README:** Die dort genannten Dateipfade
  trugen noch den `.service.ts`-Infix (`opencv-loader.service.ts`,
  `scan-session.service.ts`, …). `ng generate service` (Angular 22) legt
  Dateien inzwischen **ohne** Typ-Infix an — konsistent mit dem bereits für
  Komponenten geltenden 2025-Namensstil. README und `angular.md` wurden
  entsprechend korrigiert; betrifft auch die in Phase 3–5 noch zu
  generierenden Services (`document-detection.ts`, `perspective.ts`,
  `pdf.ts`, `file-save.ts`).
- Da `@Injectable()` durch `ng generate` inzwischen als `@Service()` erzeugt
  wird (funktional äquivalenter Decorator, offizieller CLI-Output), wird
  dieser Decorator durchgängig verwendet statt `@Injectable()` von Hand zu
  schreiben.
- Bundle bleibt unverändert, solange kein Feature `OpencvLoader` tatsächlich
  injiziert — der Lazy-Chunk entsteht erst mit dem ersten echten Consumer
  (Phase 3, Kantenerkennung).
