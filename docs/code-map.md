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

| Feature | Zweck | Pfad |
|---|---|---|
| `capture` | Sucher mit Live-Kamerabild, Taschenlampe, Raster, Auslöser nimmt Standbild auf | `features/capture/` |
| `capture` → `camera-blocked` | Fehlerbildschirm „Kamera ist gesperrt“ in drei Varianten (gesperrt, unsichere Verbindung, keine Kamera) | `features/capture/camera-blocked/` |
| `crop` | Zuschneiden: Standbild mit erkanntem Rahmen, Eck- und Mittelgriffe zum Nachziehen, Lupe, „Auto“, Begradigen per „Übernehmen“ | `features/crop/` |

## Globale Bausteine & Deploy

| Pfad | Zweck |
|---|---|
| `src/styles/` | Globale Styles: Design-Tokens (`--cam-*`), Basis, Buttons, Top-/Bottombar, Toast |
| `shared/icon/` | `cam-icon` — SVG-Icons mit festem Namens-Satz |
| `public/.htaccess` | HTTPS-Umleitung, SPA-Fallback, Cache-Header; wird in den Build kopiert |
| `deploy.cmd` | Build + Upload auf das Strato-Paket (Zugangsdaten aus `deploy.env`) |

## Core-Services (Meilenstein 1)

| Datei | Zweck |
|---|---|
| `core/opencv-loader.ts` | Lädt `@techstark/opencv-js` per Lazy-Chunk, cached die Ladung |
| `core/scan-session.ts` | Entwurf der Seite in Arbeit: Standbild, erkannte und gesetzte Ecken, begradigte Seite, Filter-Einstellung |
| `core/scan-flow.guards.ts` | Route-Guards des Scan-Flusses — ohne Entwurf zurück in den Sucher |
| `core/geometry.ts` | `Point`/`Quad`-Typen plus reine Rechen-Funktionen: Ecken sortieren, skalieren, Zielgröße, Fläche, Konvexitätsprüfung, Startviereck, Einpassen (contain), Punkt begrenzen, Kantenmitten |
| `core/mat-scope.ts` | Sammelt OpenCV-Objekte ein und gibt sie in einem `finally` frei |
| `core/document-detection.ts` | Findet die Blattkanten im Standbild (OpenCV: Graustufen → Canny → Konturen) und liefert vier Ecken oder `null` |
| `core/perspective.ts` | Begradigt das Viereck aus dem Original zum Rechteck (OpenCV-Perspektivtransformation), liefert JPEG |
| `core/filter-settings.ts` | Typen und Standardwert der Filter-Einstellung einer Seite |
| `core/camera.ts` | Kapselt `getUserMedia`/Track-Handling, Zustand als Signal |
