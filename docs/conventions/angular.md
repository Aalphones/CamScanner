# Angular Conventions — CamScanner

> **Source-of-truth references:**
> - [angular.dev style guide](https://angular.dev/style-guide)
>
> This file is the single source of truth for Angular conventions in this project.

## Stack

| Layer | Choice |
|---|---|
| Framework | Angular 22 (standalone, zoneless) |
| Sprache | TypeScript ~6.0 (strict — siehe `typescript.md`) |
| Styling | SCSS, BEM-Klassennamen, kein Utility-Framework |
| State | Lokale Signals + Services mit Signals (kein NgRx, solange kein geteilter Cross-Feature-State entsteht) |
| Tests | Vitest (Angular-Default seit CLI 22) |
| Build | `@angular/build` (esbuild), `ng build` |
| Lint | `angular-eslint` (`ng lint`) |
| Selector-Prefix | `cam` (in `angular.json` gepinnt) |
| File-Naming | 2025-Style: kein Typ-Infix — weder `.component.` noch `.service.` (`capture.ts`, `opencv-loader.ts`, nicht `capture.component.ts`/`opencv-loader.service.ts`). Bestätigt durch `ng generate service` in Angular 22, das den Suffix von selbst weglässt. |

## Project Layout

```
src/app/
├── app.ts / app.html / app.scss     Root-Shell (nur <router-outlet />)
├── app.routes.ts                    Lazy-loaded Feature-Routes
├── app.config.ts                    Providers (Router, Zoneless, Service Worker)
├── core/                            Services ohne UI (OpenCV-Loader, PDF-Service, Share-Service, ML)
├── shared/                          Wiederverwendete UI-Bausteine (über >1 Feature genutzt)
└── features/<feature>/              Ein Screen/Flow — siehe docs/code-map.md
```

## Projekt-Entscheidungen (nicht User-Level gepinnt)

- **Zoneless** — kein `zone.js`, Change Detection läuft über Signals. Wichtig
  bei einer kamera-/canvas-lastigen App: kein Change-Detection-Rattern bei
  jedem Frame.
- **Kein NgRx** — Page Buffer und Kamera-State sind lokal genug für
  Signals+Services. Erst NgRx Signal Store einführen, wenn tatsächlich
  Cross-Feature-State entsteht, der das rechtfertigt.
- **Reactive Forms** nur falls überhaupt Formulare entstehen (aktuell keine
  im Scope — Kamera/Canvas-App, kein klassisches CRUD-Formular).
- **`ng generate` ist Pflicht** für neue Komponenten/Services/Pipes — nie
  Dateien von Hand anlegen (siehe User-Baseline, Abschnitt „Generation").

## Critical Rules

1. **`ChangeDetectionStrategy.OnPush` auf jeder Komponente** — bei einer
   canvas-/frame-lastigen App der wichtigste Performance-Hebel überhaupt.
2. **Kein `.subscribe()` in Komponenten** — `async`-Pipe oder `toSignal()`.
   Ausnahme (mit `takeUntilDestroyed()`) nur für echte One-Shot-Side-Effects.
3. **Kein Wrapper-`<div>`** um den Komponenten-Root — `:host` direkt stylen.
4. **`inject()` statt Constructor-Injection**, überall.
5. **Lazy-Loaded Feature-Routes** (`loadComponent`) — `component:` (eager) nur
   für die Root-Shell.
6. **Kamera-/`navigator`-Zugriff nie direkt im Component** — immer über einen
   `core/`-Service kapseln (Testbarkeit, ein Seam für Permission-Handling).
