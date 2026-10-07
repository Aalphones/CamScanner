# App nach Mockup — Meilensteine 1 (Rest) bis 6

Die App wird Bildschirm für Bildschirm nach dem abgenommenen Design-Mockup gebaut und auf das Strato-Paket hochgeladen: Scannen, Zuschneiden, Filter, Seitenübersicht, Export und der Fehlerbildschirm „Kamera ist gesperrt“. Dunkles Design, Akzent Mintgrün `#3DDC97`. Ausgeliefert wird ein statischer Build per `deploy.cmd` (WinSCP), nach dem Vorbild von `C:\Users\sasch\develop\CardMaker\deploy.cmd`.

Dieser Plan **ersetzt** die offenen Phasen 4 und 5 des Meilenstein-1-Plans (archiviert unter `docs/archive/2026-10/2026-08-30_mvp-kern-pipeline/`). Dessen Phasen 1–3 (OpenCV-Fundament, Kamera, Kantenerkennung) sind fertig und bleiben die Grundlage. Die freihändig geplanten Bildschirme `/crop` und `/result` von dort entfallen; es gilt das Mockup.

**Nicht in diesem Plan:** helles Design · Auto-Auslösen, sobald das Dokument ruhig erkannt ist · DocAligner (KI-Eckenerkennung) · Speichern des Page Buffers über ein Neuladen hinweg (IndexedDB, siehe „Offene Punkte“) · OCR · Konto, Cloud, Ordner.

## Phasen

| # | Phase | Meilenstein | Rating | Status |
|---|---|---|---|---|
| 1 | [Fundament: Design-Bausteine & Strato-Deploy](phase-1-fundament-deploy.md) | Basis | standard | complete |
| 2 | [Scannen & Kamera-gesperrt](phase-2-scannen-kamera-gesperrt.md) | M1 | standard | complete |
| 3 | [Zuschneiden & Begradigen](phase-3-zuschneiden.md) | M1 | heikel | complete |
| 4 | [Export: PDF & Herunterladen](phase-4-export.md) | M1 | standard | complete |
| 5 | [Live-Rahmen im Sucher](phase-5-live-erkennung.md) | M1 | heikel | pending |
| 6 | [Page Buffer & Seitenübersicht](phase-6-seitenuebersicht.md) | M2 | heikel | pending |
| 7 | [Filter-Rechenwerk](phase-7-filter-rechenwerk.md) | M3 | heikel | pending |
| 8 | [Filter-Bildschirm „Scan-Look“](phase-8-filter-bildschirm.md) | M3 | standard | pending |
| 9 | [PWA-Härtung](phase-9-pwa.md) | M4 | standard | pending |
| 10 | [Teilen](phase-10-teilen.md) | M5 | standard | pending |
| 11 | [KI-Schattenentfernung](phase-11-ki-schatten.md) | M6 | heikel | pending |

Profil `private`: keine neuen automatisierten Tests. `npm test` muss mit den bestehenden Tests (`core/geometry.spec.ts`, `app.spec.ts`) grün bleiben, `npm run lint` und `npm run build` sauber.

## Design — verbindlich

Quelle: [artifacts/camscanner-mockup.html](artifacts/camscanner-mockup.html), Erläuterung in [artifacts/README.md](artifacts/README.md). Das Mockup ist Kontrakt: Maße, Farben, Abstände und Texte gelten wörtlich, soweit eine Phase nichts anderes festlegt. Die Papier-Attrappen (`.paper`, `.stamp`) sind Platzhalter für echte Bilder und werden nicht nachgebaut. Die Statusleiste (`.status`, „9:41“) und der Telefonrahmen (`.phone`) gehören nicht zur App.

Design-Tokens (Phase 1 legt sie als CSS-Variablen an, alle späteren Phasen verwenden nur diese Namen):

| Variable | Wert | Verwendung |
|---|---|---|
| `--cam-bg` | `#0b0d10` | Seitenhintergrund |
| `--cam-surface` | `#14181d` | Panels, Felder, Kacheln |
| `--cam-surface-2` | `#1d232a` | Sekundär-Buttons, Icon-Buttons |
| `--cam-line` | `#2a323b` | Linien, Slider-Spur, gestrichelte Kacheln |
| `--cam-text` | `#eef2f5` | Text |
| `--cam-muted` | `#8b97a3` | Nebentext |
| `--cam-accent` | `#3ddc97` | Primär-Aktion, Erkanntes, Auswahl |
| `--cam-accent-ink` | `#04210f` | Text/Kontur auf Akzent |
| `--cam-danger` | `#ff6b6b` | Löschen, Fehler |
| `--cam-radius` | `14px` | Karten |
| `--cam-font` | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | überall |

Elemente ohne Mockup, die dieser Plan aus den Bausteinen oben baut (Abnahme im Smoke-Test): App-Icon (Phase 9), Toast-Hinweis mit optionaler Aktion (Phase 4, genutzt für „Rückgängig“, „Neues Dokument“, „Neu laden“), Beschreibungszeile unter den Filter-Chips (Phase 8).

## Bildschirm-Fluss (fest)

| Route | Bildschirm | Guard | Weiter |
|---|---|---|---|
| `/capture` | Scannen | — | Auslöser → `/crop` · „Fertig“ oder Vorschaubild → `/pages` |
| `/crop` | Zuschneiden | `draftSourceGuard` | „Übernehmen“ → `/filter` · „Neu aufnehmen“ → `/capture` (Bearbeiten: „Abbrechen“ → `/pages`) |
| `/filter` | Scan-Look | `draftWarpedGuard` | „Fertig“ → Seite in den Page Buffer, dann `/capture` (neue Seite) bzw. `/pages` (bearbeitete Seite) · Zurück → `/crop` |
| `/pages` | Seitenübersicht | `hasPagesGuard` | Kachel antippen → `/crop` mit dieser Seite · „Seite hinzufügen“ → `/capture` · „PDF erstellen“ → `/export` |
| `/export` | Exportieren | `hasPagesGuard` | Zurück → `/pages` · nach Teilen/Herunterladen Toast „Neues Dokument“ → Buffer leeren, `/capture` |

Zwischenstände während der Umsetzung sind in den Phasen benannt (bis Phase 6 geht `/crop` direkt nach `/export`, bis Phase 8 schreibt `/crop` direkt in den Page Buffer). Ein Guard, der nicht erfüllt ist, leitet nach `/capture` um.

## Architektur-Entscheidungen (fallen in diesem Plan)

Auf Platte liegen 001–003; keine weiteren Nummern sind in geparkten Plänen reserviert. Reserviert hier:

- **ADR-004** — Hosting auf Strato als statischer Build, Upload per `deploy.cmd` (Phase 1)
- **ADR-005** — Page-Buffer-Modell: Seiten als JPEG-Blobs im Arbeitsspeicher, Entwurf getrennt vom Buffer (Phase 6)
- **ADR-006** — Filter-Pipeline: OpenCV.js auf dem Haupt-Thread, Vorschau verkleinert, volle Auflösung erst beim Übernehmen (Phase 7)
- **ADR-007** — KI-Schattenentfernung über eine Verstärkungskarte statt Hochskalieren des Modell-Ausgangs (Phase 11)

## Kontrakt: Typen und Signaturen

Bestehend und unverändert: `Point`, `Quad`, `Size`, `sortQuadCorners`, `scaleQuad`, `quadOutputSize`, `quadArea`, `isConvexQuad` in `core/geometry.ts`; `OpencvLoader.load()`; `DocumentDetection.detect(source: ImageBitmap): Promise<Quad | null>`; `Camera` mit `state`, `start`, `captureFrame`, `stop`. Dateinamen ohne `.service.`-Infix (siehe `docs/conventions/angular.md`), Services mit `@Service()` wie im Bestand.

```ts
// core/mat-scope.ts  (Phase 3, aus document-detection.ts herausgezogen)
export class MatScope { track<T extends { delete(): void }>(value: T): T; releaseAll(): void }

// core/filter-settings.ts  (Phase 3 legt die Typen an, Phase 7 füllt die Logik)
export type FilterId = 'original' | 'auto' | 'scan' | 'bw' | 'gray';
export interface FilterSettings {
  readonly filter: FilterId;
  readonly contrast: number;     // 0..100, 50 = neutral
  readonly brightness: number;   // 0..100, 50 = neutral
  readonly removeShadow: boolean; // erst ab Phase 11 schaltbar, sonst immer false
}
export const DEFAULT_FILTER_SETTINGS: FilterSettings; // { filter: 'auto', contrast: 50, brightness: 50, removeShadow: false }

// core/scan-session.ts  (Entwurf = die Seite in Arbeit; Phase 3 erweitert, Phase 6 ergänzt Bearbeiten)
sourceFrame:   Signal<ImageBitmap | null>
detectedCorners: Signal<Quad | null>   // Ergebnis von detect(), für den „Auto“-Knopf
corners:       Signal<Quad | null>
warpedPage:    Signal<Blob | null>     // begradigt, ungefiltert, image/jpeg 0.92
filter:        Signal<FilterSettings>
editingPageId: Signal<string | null>   // null = neue Seite
startNew(frame: ImageBitmap): void
startEdit(page: ScannedPage): Promise<void>  // dekodiert page.source
setDetectedCorners(corners: Quad | null): void
setCorners(corners: Quad): void
setWarpedPage(page: Blob): void
setFilter(settings: FilterSettings): void
reset(): void                          // schließt das ImageBitmap

// core/page-buffer.ts  (Phase 6)
export type Rotation = 0 | 90 | 180 | 270;
export interface ScannedPage {
  readonly id: string;            // crypto.randomUUID()
  readonly source: Blob;          // Original-Standbild, image/jpeg 0.9 — für erneutes Zuschneiden
  readonly corners: Quad;         // in source-Koordinaten
  readonly warped: Blob;          // begradigt, ungefiltert
  readonly filter: FilterSettings;
  readonly output: Blob;          // begradigt + gefiltert, image/jpeg 0.92 — geht ins PDF
  readonly rotation: Rotation;
  readonly thumbnailUrl: string;  // Object-URL, 320 px lange Kante, Drehung eingerechnet
}
pages: Signal<readonly ScannedPage[]>
count: Signal<number>
add(page: ScannedPage): void
replace(id: string, page: ScannedPage): void    // gibt die alte thumbnailUrl frei
remove(id: string): { page: ScannedPage; index: number } | null  // URL bleibt gültig (Rückgängig)
restore(page: ScannedPage, index: number): void
discard(page: ScannedPage): void                // gibt die thumbnailUrl endgültig frei
move(fromIndex: number, toIndex: number): void
rotate(ids: readonly string[]): Promise<void>   // +90°, Thumbnail neu
clear(): void

// core/page-factory.ts  (Phase 6)
createPage(input: { sourceFrame: ImageBitmap; corners: Quad; warped: Blob; filter: FilterSettings; id?: string; rotation?: Rotation }): Promise<ScannedPage>

// core/perspective.ts  (Phase 3)
warp(source: ImageBitmap, corners: Quad): Promise<Blob>   // image/jpeg 0.92

// core/image-filters.ts  (Phase 7)
renderFiltered(warped: Blob, settings: FilterSettings, maxEdge?: number): Promise<Blob>  // image/jpeg 0.92

// core/pdf.ts  (Phase 4)
export type ExportQuality = 'small' | 'medium' | 'original';
export interface PdfPageInput { readonly image: Blob; readonly rotation: Rotation }
buildPdf(pages: readonly PdfPageInput[], quality: ExportQuality): Promise<Blob>

// core/file-save.ts  (Phase 4)
downloadBlob(blob: Blob, fileName: string): void
sanitizePdfFileName(input: string, fallback: string): string

// core/toast.ts  (Phase 4)
show(message: string, options?: { actionLabel?: string; action?: () => void; durationMs?: number; onExpire?: () => void }): void
current: Signal<ToastState | null>

// core/share.ts  (Phase 10)
canShareFiles(): boolean
sharePdf(blob: Blob, fileName: string): Promise<'shared' | 'cancelled' | 'failed'>

// core/ml/doc-shadow.ts  (Phase 11)
removeShadow(image: Blob, onProgress?: (fraction: number) => void): Promise<Blob>

// core/scan-flow.guards.ts  (Phase 3, erweitert in 6)
draftSourceGuard, draftWarpedGuard, hasPagesGuard: CanActivateFn
```

`Rotation` lebt ab Phase 4 in `core/pdf.ts` und wandert in Phase 6 nach `core/page-buffer.ts` (Re-Export aus `pdf.ts` entfällt dann).

## Abnahme-Kriterien für den ganzen Plan

1. `npm run build`, `npm run lint` und `npm test` laufen sauber.
2. `deploy.cmd` lädt den Build auf das Strato-Paket; die App läuft unter der eigenen HTTPS-Adresse, `http://` leitet genau einmal auf `https://` um.
3. Auf einem Android-Handy: mehrere Seiten scannen, zuschneiden, filtern, in der Übersicht umsortieren, drehen, löschen, und als ein PDF teilen oder herunterladen.
4. Jeder der sechs Bildschirme entspricht dem Mockup in den Punkten, die die jeweilige Phase als Struktur festlegt.
5. Die installierte App startet im Flugmodus und kann ohne Netz scannen und ein PDF herunterladen.
6. Kein Netzwerk-Zugriff außer dem Laden der App selbst und (nur nach Einschalten) dem einmaligen Laden des KI-Modells.

## Smoke-Checkliste (der User prüft, Reihenfolge bewusst)

Oben stehen die Stellen, an denen der Planer am unsichersten war.

1. **Deploy & HTTPS auf Strato (Phase 1):** `curl -I http://<adresse>/` liefert genau eine 301 auf `https://`, `curl -I https://<adresse>/pages` liefert 200 mit der `index.html`. Neuladen auf `/pages` im Handy landet im Sucher, nicht auf einer Fehlerseite. Der Upload hat nichts außerhalb des eigenen Zielordners angefasst.
2. **Live-Rahmen auf dem Handy (Phase 5):** Bleibt das Kamerabild flüssig, während der Rahmen mitläuft? Wird das Handy nach zwei Minuten Sucher spürbar warm?
3. **Speicher bei vielen Seiten (Phase 6):** 15 Seiten mit voller Kamera-Auflösung scannen — stürzt der Tab ab oder wird die Übersicht zäh?
4. **Filter auf echten Fotos (Phase 7/8):** Beleg auf dunklem Holz, Seite mit Schlagschatten, farbiger Flyer — je Auto, Scan, S/W. Ist S/W lesbar, bleibt Auto farbig?
5. **Teilen (Phase 10):** Share-Sheet öffnet sich auf Android, Ziel z. B. Google Drive erhält eine gültige PDF-Datei.
6. **Offline (Phase 9):** App installieren, Flugmodus, App öffnen, eine Seite scannen und herunterladen.
7. **KI-Schatten (Phase 11):** Seite mit hartem Handschatten — mit und ohne Schalter vergleichen; Text darf nicht weicher werden.
8. Kamera im Browser sperren: Bildschirm „Kamera ist gesperrt“ mit drei Schritten erscheint, „Nochmal versuchen“ funktioniert nach dem Freigeben ohne Neuladen.
9. Elemente ohne Mockup ansehen: App-Icon auf dem Homescreen, Toast „Seite gelöscht · Rückgängig“, Beschreibungszeile unter den Filter-Chips.

## Offene Punkte

- **Page Buffer über Neuladen retten (IndexedDB):** Beim Planen aufgefallen, vom User ins Backlog gelegt. Eigener kleiner Plan nach diesem.
- **Auto-Auslösen** (stand im Mockup unter „Entscheidungen zum Abnicken“, nicht beauftragt).
- **DocAligner** als KI-Fallback für die Eckenerkennung (Meilenstein 6, kein Design, nicht beauftragt).

## Summary

_(beim Archivieren füllen)_

## Files touched

_(beim Archivieren füllen)_

## Commits

_(beim Archivieren füllen)_

## Deviations from plan

_(beim Archivieren füllen)_

## Follow-ups

_(beim Archivieren füllen)_
