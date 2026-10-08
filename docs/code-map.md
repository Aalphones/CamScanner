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
| `capture` | Sucher mit Live-Kamerabild, Taschenlampe, Raster, Auslöser nimmt Standbild auf; Live-Rahmen über dem erkannten Dokument (`live-detection.ts`: Erkennungs-Schleife und Stabilitäts-Zähler); untere Leiste mit Vorschaubild + Seitenzähler und „Fertig“ zur Seitenübersicht | `features/capture/` |
| `capture` → `camera-blocked` | Fehlerbildschirm „Kamera ist gesperrt“ in drei Varianten (gesperrt, unsichere Verbindung, keine Kamera) | `features/capture/camera-blocked/` |
| `crop` | Zuschneiden: Standbild mit erkanntem Rahmen, Eck- und Mittelgriffe zum Nachziehen, Lupe, „Auto“, Begradigen per „Übernehmen“ und weiter zu `/filter`; Bearbeiten-Modus für eine vorhandene Seite | `features/crop/` |
| `filter` | Scan-Look: große Vorschau, fünf Filter-Chips mit Bild der eigenen Seite, Regler für Kontrast und Helligkeit; „Fertig“ rechnet in voller Auflösung und legt die Seite in den Page Buffer (neu oder ersetzend) | `features/filter/` |
| `pages` | Seitenübersicht: Raster aller Seiten, Umsortieren per Halten und Ziehen (`page-drag.ts`), Löschen mit Rückgängig, Auswahl-Modus, Drehen, Kachel antippen = Bearbeiten | `features/pages/` |
| `export` | Exportieren: Seitenstapel-Vorschau, Dateiname, Qualitätsstufe, PDF vorab gebaut, Herunterladen | `features/export/` |

## Globale Bausteine & Deploy

| Pfad | Zweck |
|---|---|
| `src/styles/` | Globale Styles: Design-Tokens (`--cam-*`), Basis, Buttons, Top-/Bottombar, Toast |
| `shared/icon/` | `cam-icon` — SVG-Icons mit festem Namens-Satz |
| `shared/toast/` | `cam-toast` — zeigt den aktuellen Toast aus `core/toast.ts`, einmal in `app.html` eingebunden |
| `public/.htaccess` | HTTPS-Umleitung, SPA-Fallback, Kompression, Cache-Header; wird in den Build kopiert |
| `public/icons/` | App-Icon: Quelle `icon.svg`/`icon-maskable.svg`, PNGs daraus (Erzeugung siehe README dort) |
| `public/manifest.webmanifest`, `ngsw-config.json` | PWA-Manifest und Service-Worker-Cache (Prefetch von `/*.js` hält den OpenCV-Chunk offline bereit) |
| `deploy.cmd` | Build + Upload auf das Strato-Paket (Zugangsdaten aus `deploy.env`) |

## Core-Services (Meilenstein 1)

| Datei | Zweck |
|---|---|
| `core/opencv-loader.ts` | Lädt `@techstark/opencv-js` per Lazy-Chunk, cached die Ladung |
| `core/scan-session.ts` | Entwurf der Seite in Arbeit: Standbild, erkannte und gesetzte Ecken, begradigte Seite, Filter-Einstellung; `startEdit` lädt eine Seite aus dem Page Buffer zum Nachbearbeiten |
| `core/scan-flow.guards.ts` | Route-Guards des Scan-Flusses — ohne Entwurf bzw. ohne Seiten zurück in den Sucher |
| `core/page-buffer.ts` | Page Buffer: alle Seiten des Dokuments im Arbeitsspeicher, Typen `ScannedPage`/`Rotation`, Hinzufügen, Ersetzen, Löschen/Wiederherstellen, Verschieben, Drehen; Eigentümer der Vorschau-URLs (ADR-005) |
| `core/page-factory.ts` | `createPage` baut eine Seite aus Entwurf, begradigtem und bereits gefiltertem Bild (`output` rechnet der Aufrufer, `filter` in `features/filter/`); `renderThumbnail` zeichnet die gedrehte Vorschau |
| `core/geometry.ts` | `Point`/`Quad`-Typen plus reine Rechen-Funktionen: Ecken sortieren, skalieren, Zielgröße, Fläche, Konvexitätsprüfung, Startviereck, Einpassen (contain/cover), Quad auf den Bildschirm umrechnen, Ruhe-Vergleich zweier Quads, Punkt begrenzen, Kantenmitten |
| `core/mat-scope.ts` | Sammelt OpenCV-Objekte ein und gibt sie in einem `finally` frei |
| `core/document-detection.ts` | Findet die Blattkanten im Standbild (OpenCV: Graustufen → Canny → Konturen) und liefert vier Ecken oder `null` |
| `core/perspective.ts` | Begradigt das Viereck aus dem Original zum Rechteck (OpenCV-Perspektivtransformation), liefert JPEG |
| `core/filter-settings.ts` | Typen und Standardwert der Filter-Einstellung einer Seite |
| `core/image-filters.ts` | `renderFiltered` rechnet die fünf Scan-Looks plus Kontrast/Helligkeit auf das begradigte Bild (OpenCV: Background Division, CLAHE, Otsu, Unsharp Mask), optional verkleinert für Vorschauen, liefert JPEG (ADR-006) |
| `core/pdf.ts` | Baut aus JPEG-Seiten ein A4-PDF (pdf-lib, lazy geladen), Qualitätsstufen verkleinern per OffscreenCanvas |
| `core/file-save.ts` | `downloadBlob` (temporärer `<a download>`) und `sanitizePdfFileName` |
| `core/toast.ts` | Ein Toast zur Zeit mit optionaler Aktion, Signal `current` |
| `core/share.ts` | `Share` — `canShareFiles()` und `sharePdf()` (Web Share API mit Datei); einzige Stelle, die `navigator.share` anfasst |
| `core/app-update.ts` | Hört auf den Service Worker und zeigt bei fertig geladener neuer Version den Toast „Neue Version verfügbar · Neu laden“ |
| `core/camera.ts` | Kapselt `getUserMedia`/Track-Handling, Zustand als Signal |
