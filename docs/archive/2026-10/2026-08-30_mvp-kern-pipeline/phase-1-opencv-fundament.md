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

- [x] `npm install @techstark/opencv-js pdf-lib`
- [x] `npm run build` — sauber durchgelaufen, kein CommonJS-Fehler, kein
      Budget gesprengt (Start-Bundle unverändert bei 194 kB — OpenCV wird von
      noch niemandem injiziert, der Lazy-Chunk entsteht erst mit dem ersten
      Consumer in Phase 3).
- [x] `ng generate service core/opencv-loader` → `src/app/core/opencv-loader.ts`
      (**Kontrakt-Korrektur:** `ng generate` in Angular 22 legt keinen
      `.service.ts`-Infix mehr an, siehe ADR-002)
      - Feld `private loadPromise: Promise<OpenCv> | null = null`
      - `load(): Promise<OpenCv>` — beim ersten Aufruf
        `import('@techstark/opencv-js')`, auf das `onRuntimeInitialized`-Signal
        des Moduls warten, Ergebnis in `loadPromise` merken und wiederverwenden
      - Typ-Alias `export type OpenCv = CV` (aus dem Paket-Re-Export, `typeof
        import(...)` war unnötig — das Paket exportiert den Typ `CV` direkt)
        in derselben Datei — alle anderen Services typisieren gegen `OpenCv`,
        nie gegen `any`
- [x] `ng generate service core/scan-session` → `src/app/core/scan-session.ts`.
      Signale und Methoden exakt nach Kontrakt-Sektion der [README](README.md).
      `reset()` ruft `sourceFrame()?.close()` auf, bevor es die Signale leert —
      sonst hält ein 12-Megapixel-Bitmap den Speicher fest.
- [x] `src/app/core/geometry.ts` anlegen: `Point`, `Quad` (nur die Typen, die
      Funktionen kommen in Phase 3).
- [x] `src/app/app.routes.ts`: `{ path: '', redirectTo: 'capture', pathMatch:
      'full' }` und eine Wildcard zurück auf `capture` stehen; die drei
      Screen-Einträge selbst kommen erst mit den `loadComponent`-Imports in den
      Phasen 2/4/5 dazu — vorher gäbe es keine Datei, auf die sie zeigen
      könnten, und der Build würde brechen.
- [x] `src/app/app.html` enthält nur `<router-outlet />`.
- [x] `src/styles.scss`: dunkler App-Hintergrund (`#111`), `html, body` auf
      volle Höhe, `overscroll-behavior: none`, `touch-action: manipulation` —
      die App ist eine Vollbild-Kamera-Oberfläche, kein scrollendes Dokument.

## Doc-Updates

- [x] `docs/decisions/002-opencv-einbindung.md` angelegt.
- [x] `docs/conventions/testing.md` gekürzt wie vorgegeben.
- [x] `docs/code-map.md`: Zeilen für `core/opencv-loader.ts`,
      `core/scan-session.ts`, `core/geometry.ts` ergänzt.

## Report-Back

**Status:** complete. Weg genommen: npm-Paket (kein Fallback nötig, Build lief
sauber durch). Einzige Abweichung vom Kontrakt: `ng generate` legt Dateien
ohne `.service.ts`-Infix an (Angular 22) — README, code-map.md und die
Phasen 2–5 wurden entsprechend korrigiert, siehe ADR-002.
