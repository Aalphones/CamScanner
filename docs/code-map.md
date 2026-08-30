# Code-Map — CamScanner

Ordner-grobe Feature → Datei-Zuordnung. Erst hier nachsehen, dann erst greppen.
Bleibt bewusst grob (keine Zeilennummern) — muss Refactorings überleben.

## Namensschema (Parallel-Namen-Trick)

Ein Feature `<x>` zieht sich über die Layer immer gleich durch:

```
src/app/features/<x>/<x>.ts            Standalone-Komponente (Angular 2025 Style: kein ".component."-Infix)
src/app/features/<x>/<x>.html
src/app/features/<x>/<x>.scss
src/app/features/<x>/<x>.spec.ts
src/app/features/<x>/<x>.service.ts    Feature-eigene Logik/State (Signals), falls nötig
```

Geteiltes über Features hinweg liegt in `src/app/core/` (Services ohne UI, z. B.
OpenCV-Loader, PDF-Service, Share-Service) bzw. `src/app/shared/` (wiederverwendete
Komponenten/Pipes).

## Faustregeln

- Neue Kamera-/Bildverarbeitungs-Logik ohne eigenes UI? → `core/<name>.service.ts`
- Neue eigenständige Ansicht/Screen? → `features/<name>/` + Eintrag in
  `src/app/app.routes.ts`
- Wiederverwendbare UI-Bausteine (Button, Crop-Handle, Page-Thumbnail)? →
  `shared/`
- ONNX-Modell-Inferenz (DocAligner/DocShadow)? → eigener Service unter
  `core/ml/<modell>.service.ts`, Modell-Assets unter `public/models/`

## Feature-Tabelle

Noch leer — wird beim ersten `/plan`-Durchlauf pro Meilenstein befüllt, sobald
die ersten Features (`capture`, `pages`, `export`, …) tatsächlich existieren.

| Feature | Zweck | Pfad |
|---|---|---|
| _(noch keins)_ | | |

## Core-Services (Meilenstein 1, Phase 1)

| Datei | Zweck |
|---|---|
| `core/opencv-loader.ts` | Lädt `@techstark/opencv-js` per Lazy-Chunk, cached die Ladung |
| `core/scan-session.ts` | Signal-State für den Scan-Fluss: Standbild, Ecken, begradigte Seite |
| `core/geometry.ts` | `Point`/`Quad`-Typen (Funktionen folgen in Phase 3) |
