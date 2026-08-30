# Phase 1 — OpenCV-Fundament & Gerüst

**Rating:** heikel — hier fällt die Entscheidung, wie OpenCV.js überhaupt in
den Build kommt. Geht das schief, hängt der ganze Meilenstein.

## Kontext — vorher lesen

- `docs/conventions/angular.md` (Critical Rules, Projekt-Layout)
- `docs/conventions/typescript.md`
- `docs/code-map.md` (Namensschema)
- `angular.json` (Budgets, `allowedCommonJsDependencies`)
- `src/app/app.config.ts`, `src/app/app.routes.ts`

## Entscheidung: OpenCV.js kommt als npm-Paket

`@techstark/opencv-js` — bringt TypeScript-Typen mit (unter `strict` sonst ein
Meer aus `any`) und wird über einen dynamischen `import()` erst geladen, wenn
die Erkennung das erste Mal gebraucht wird. Damit landet es in einem eigenen
Lazy-Chunk und nicht im Start-Bundle.

**Fallback, falls der Build daran scheitert** (siehe Abnahme unten): offizielles
`opencv.js` von `docs.opencv.org` nach `public/opencv/opencv.js` kopieren, per
`<script>`-Tag zur Laufzeit nachladen, Typen von Hand als schmales Interface
deklarieren. Der Loader-Service unten kapselt genau diesen Unterschied — der
Rest des Codes merkt davon nichts. Welcher Weg genommen wurde, gehört in ADR-002.

## Abnahme-Kriterien

- `npm run build` läuft ohne Fehler; das Start-Bundle (`main-*.js`) wächst
  gegenüber heute um weniger als 200 KB — OpenCV liegt in einem separaten Chunk.
- Ein Aufruf von `opencvLoader.load()` liefert ein Objekt, dessen
  `cv.getBuildInformation()` einen nicht-leeren String zurückgibt.
- Zweimaliger Aufruf von `load()` lädt nur einmal (dieselbe Promise).
- `npm run lint` ist sauber.

## Checkliste

- [ ] `npm install @techstark/opencv-js pdf-lib`
- [ ] `npm run build` — Ergebnis prüfen. Meckert der Build über CommonJS,
      das Paket in `angular.json` unter
      `projects.cam-scanner.architect.build.options.allowedCommonJsDependencies`
      eintragen. Sprengt es ein Budget, die `budgets`-Einträge anheben statt
      das Lazy-Laden aufzugeben.
- [ ] `ng generate service core/opencv-loader` → `src/app/core/opencv-loader.service.ts`
      - Feld `private loadPromise: Promise<OpenCv> | null = null`
      - `load(): Promise<OpenCv>` — beim ersten Aufruf
        `import('@techstark/opencv-js')`, auf das `onRuntimeInitialized`-Signal
        des Moduls warten, Ergebnis in `loadPromise` merken und wiederverwenden
      - Typ-Alias `export type OpenCv = typeof import('@techstark/opencv-js')`
        in derselben Datei — alle anderen Services typisieren gegen `OpenCv`,
        nie gegen `any`
- [ ] `ng generate service core/scan-session` → Signale und Methoden exakt nach
      Kontrakt-Sektion der [README](README.md). `reset()` ruft
      `sourceFrame()?.close()` auf, bevor es die Signale leert — sonst hält ein
      12-Megapixel-Bitmap den Speicher fest.
- [ ] `src/app/core/geometry.ts` anlegen: `Point`, `Quad` (nur die Typen, die
      Funktionen kommen in Phase 3).
- [ ] `src/app/app.routes.ts`: drei Lazy-Routen `capture`, `crop`, `result`,
      dazu `{ path: '', redirectTo: 'capture', pathMatch: 'full' }` und eine
      Wildcard zurück auf `capture`. Die Komponenten entstehen in den Phasen
      2/4/5 — bis dahin bleibt die Datei mit den drei Einträgen vorbereitet und
      wird pro Phase scharf geschaltet.
- [ ] `src/app/app.html` enthält nur `<router-outlet />`.
- [ ] `src/styles.scss`: dunkler App-Hintergrund (`#111`), `html, body` auf
      volle Höhe, `overscroll-behavior: none`, `touch-action: manipulation` —
      die App ist eine Vollbild-Kamera-Oberfläche, kein scrollendes Dokument.

## Doc-Updates

- [ ] `docs/decisions/002-opencv-einbindung.md` anlegen (Kontext / betrachtete
      Optionen / Entscheidung / Konsequenzen — inklusive dem, was der Build
      tatsächlich gesagt hat)
- [ ] `docs/conventions/testing.md` kürzen: automatisierte Tests gibt es in
      diesem Projekt **nur** für reine Rechen-Funktionen ohne Kamera, Canvas
      oder OpenCV (konkret `core/geometry.ts`). Alles andere wird über die
      Smoke-Checkliste des jeweiligen Plans manuell abgenommen. Die bisherige
      Regel „OpenCV-Aufrufe mocken" ersatzlos streichen — ein Test, der nur
      prüft, ob ein Mock aufgerufen wurde, sichert nichts ab.
- [ ] `docs/code-map.md`: Zeilen für `core/opencv-loader.service.ts`,
      `core/scan-session.service.ts`, `core/geometry.ts` ergänzen

## Report-Back
