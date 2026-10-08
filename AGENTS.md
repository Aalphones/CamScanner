# AGENTS.md — CamScanner

🚧 Aktive Arbeit → [STATE.md](STATE.md)

Clientseitiger PWA-Dokumentenscanner: Kamera → Kantenerkennung → Perspektiv-
korrektur → Bildoptimierung → Multi-Page-PDF → Teilen. Kein Backend, kein
Login. Voller Kontext: [docs/PROJECT.md](docs/PROJECT.md). Technisches
Konzept-Dokument (Detail-Pipeline, ONNX-Modelle, Pre-/Post-Processing-Code):
[docs/concept.md](docs/concept.md).

## Code finden — erst hier, dann greppen

[docs/code-map.md](docs/code-map.md) — Feature → Ordner-Zuordnung + das
Namensschema, mit dem sich neue Dateien erraten statt suchen lassen. Noch
leer (Greenfield), wird beim ersten Feature befüllt.

## Stack

| Layer | Choice |
|---|---|
| Framework | Angular 22 (standalone, zoneless) |
| Sprache | TypeScript ~6.0 (strict) |
| Styling | SCSS, BEM |
| Bildverarbeitung | OpenCV.js, Canvas API |
| PDF | pdf-lib |
| Optional ML | onnxruntime-web (DocAligner, DocShadow) |
| PWA | `@angular/service-worker` |
| Tests | Vitest |
| Lint | angular-eslint |

## Conventions

- [docs/conventions/angular.md](docs/conventions/angular.md)
- [docs/conventions/typescript.md](docs/conventions/typescript.md)
- [docs/conventions/commits.md](docs/conventions/commits.md)
- [docs/conventions/linting.md](docs/conventions/linting.md)
- [docs/conventions/testing.md](docs/conventions/testing.md)

## Weitere Docs

- [docs/glossary.md](docs/glossary.md) — Begriffe, die im Projekt eine feste
  Bedeutung haben (Page Buffer, CLAHE, ONNX, …)
- [docs/decisions/](docs/decisions/) — ADRs
- [docs/planning/](docs/planning/) — aktive/geparkte Pläne
- Pläne entstehen und laufen über `/plan` und `/implement`

## Quickstart

```bash
npm install
npm run fetch-models   # KI-Modell holen (vor dem ersten Deploy, braucht uv)
npm start           # ng serve — Kamera braucht HTTPS oder localhost
npm run build       # Production-Build
npm test            # Vitest
npm run lint        # angular-eslint
deploy.cmd          # Build + Upload nach Strato (braucht deploy.env)
```

## Critical Rules

1. **`getUserMedia` braucht einen Secure Context** — lokal ist `localhost`
   okay, alles andere HTTPS. Kein Workaround, keine Ausnahme.
2. **Kein Backend, kein Upload** — jede Idee, Bilder irgendwohin zu senden
   (auch „nur für Debugging"), ist außerhalb des Scopes (siehe
   `docs/PROJECT.md` → Nicht-Ziele).
3. **OpenCV.js/onnxruntime-web nie direkt in Komponenten** — immer über einen
   `core/`-Service kapseln (Typisierung, Testbarkeit, siehe
   `docs/conventions/angular.md`).
4. **`deploy.env` enthält Zugangsdaten und wird nie committet.**
5. **Offline-Fähigkeit hängt am Prefetch von `/*.js` in `ngsw-config.json`** —
   den OpenCV-Chunk nie in eine Lazy-Gruppe verschieben.
