# Plan — Speichern mit Schattenentfernung robust machen

**Anlass:** Auf einem POCO X6 Pro (Chrome) bleibt „Speichert …“ mit eingeschalteter Schattenentfernung für immer stehen. Die Vorschau zeigte den Schatten vorher noch — der KI-Lauf ist also nie fertig geworden. Vorschau und Speichern warten auf dieselbe zwischengespeicherte Verstärkungskarte (`DocShadow.gainMap`), beide ohne Zeitgrenze. Der WebGPU-Pfad von ORT wurde nie im echten Browser geprüft (Report-Back Phase 11 des archivierten Plans `2026-10-07_app-nach-mockup`); WASM ist auf dem Entwicklungsrechner gemessen (0,7 s, ein Thread).

**Hypothese (nicht belegt):** Der WebGPU-Lauf hängt auf dem Mali-Grafikchip des POCO. Belegbar nur am Gerät (Smoke-Punkt 1).

| Phase | Inhalt | Rating | Status |
|---|---|---|---|
| 1 | KI-Lauf: nur WASM, Zeitgrenze für den Modelllauf, hängende Karte verwerfen; ADR-008 | standard | complete |
| 2 | Filter-Bildschirm: Größengrenze beim Speichern, Gesamt-Zeitgrenze, Schritt-Anzeige, Fehlerblock mit zwei Knöpfen | standard | pending |

## Entscheidungen (fallen hier, nicht beim Umsetzen)

- **Ausführung nur noch WASM**, WebGPU entfällt. `executionProviders()` wird entfernt, die Sitzung bekommt fest `executionProviders: ['wasm']`.
- **Zeitgrenze Modelllauf:** `GAIN_MAP_RUN_TIMEOUT_MS = 30_000` in `core/ml/doc-shadow.ts`. Gilt nur für Vorbereitung + `session.run` (nicht für den Modell-Download). Bei Ablauf wirft `computeGainMap` einen `ShadowTimeoutError`; der vorhandene `catch` im `gainMap()` entfernt die Karte aus der `WeakMap`, der nächste Aufruf rechnet neu.
- **Gesamt-Zeitgrenze Speichern:** `SAVE_TIMEOUT_MS = 60_000` in `features/filter/filter.ts`. Startet erst, wenn das Modell geladen ist (der Download hat seine eigene %-Anzeige und zählt nicht).
- **Größengrenze Speichern:** `SAVE_MAX_EDGE = 3000` in `features/filter/filter.ts`, übergeben als `maxEdge` an `renderFiltered`. 3000 px an der langen Kante sind auf A4 rund 250 dpi. `readPixels` verkleinert nur, vergrößert nie.
- **Schritt-Anzeige:** Balken springt pro Schritt, keine erfundenen Prozente. Mit Schattenentfernung drei Schritte (`Schatten berechnen`, `Filter anwenden`, `Seite sichern`), ohne zwei (`Filter anwenden`, `Seite sichern`). Lädt das Modell beim Speichern noch, steht davor der Text `KI-Modell lädt … NN %` (aus `docShadow.loadProgress()`), Balken auf diesem Wert.
- **Fehlerfall Speichern:** Fehlerblock im Panel statt des alten Einzeilers, mit Text je Ursache und den Knöpfen `Ohne Schattenentfernung speichern` (nur wenn der Schalter an ist) und `Nochmal versuchen`.
- **Fehlerfall Vorschau mit Schatten:** schlägt die Karte in der Vorschau fehl, geht der Schalter aus, Toast `Schattenentfernung hat auf diesem Gerät nicht geklappt — ausgeschaltet`, Vorschau rechnet ohne Schatten neu.

## Finale AK

1. Mit Schattenentfernung endet „Fertig“ auf dem POCO X6 Pro entweder mit gespeicherter Seite oder spätestens nach 60 s (ab geladenem Modell) mit dem Fehlerblock — nie mit Dauer-„Speichert …“.
2. Während des Speicherns zeigt das Panel „Schritt N von M · <Schritt>“ und einen Balken, der pro Schritt weiterspringt.
3. Der Fehlerblock nennt die Ursache in Klartext und bietet die beiden Knöpfe; „Ohne Schattenentfernung speichern“ schaltet den Schalter aus und speichert sofort.
4. Gespeicherte Seiten haben an der langen Kante höchstens 3000 px.
5. Vorschau mit Schattenentfernung zeigt auf dem POCO den Schatten entfernt, oder schaltet mit Toast ab — kein stilles Hängen.

## Smoke-Checkliste (User, am POCO X6 Pro, Chrome)

Wackelstellen zuerst:

1. **Läuft das Modell auf WASM am Handy, und wie lange?** Seite scannen, Schatten an, Vorschau abwarten. Prüfen per Remote-Debugging (PC-Chrome `chrome://inspect`, Handy per USB): Konsole zeigt `DocShadow: Modelllauf NNNN ms`. Erwartung: Schatten in der Vorschau weg, Lauf unter 30 s. Über 30 s → Zeitgrenze zu knapp, melden.
2. **Malt die Schritt-Anzeige vor der blockierenden Rechnung?** „Fertig“ mit Schatten an: Text „Schritt 1 von 3 · Schatten berechnen“ muss sichtbar sein, bevor die Oberfläche kurz einfriert.
3. **Fehlerblock:** Flugmodus an, App frisch laden (Modell nicht im Cache, falls vorher nie geladen) — oder in den DevTools `models/docshadow.onnx` per „Block request URL“ sperren —, Schatten an: Toast „KI-Modell konnte nicht geladen werden …“. Den Speichern-Fehlerblock selbst kann man am Gerät nicht gezielt auslösen; er wird per Code-Blick abgenommen (`Nochmal versuchen` → `onDoneClick`, `Ohne Schattenentfernung speichern` → `onSaveWithoutShadow`).
4. Seite ohne Schatten speichern: zwei Schritte, Seite landet im Page Buffer.
5. Gespeicherte Seite exportieren, PDF ansehen: Schrift scharf, keine sichtbare Verschlechterung gegenüber vorher.
6. Konsole: `crossOriginIsolated` (aus `STATE.md`, ohnehin offen).

## Phase 1 — KI-Lauf: nur WASM, Zeitgrenze, Verwerfen

### Kontext

- `src/app/core/ml/doc-shadow.ts` (ganz)
- `docs/decisions/007-ki-schattenentfernung.md`
- `docs/conventions/typescript.md`, `docs/conventions/angular.md`
- Fehlerklassen geprüft: Vault-Entities `frameworks/angular*.md` haben keinen Abschnitt „Fehlerklassen“; für onnxruntime-web existiert keine Entity — keine einschlägig.

### Chesterton

- `executionProviders()` wählt WebGPU, wenn `navigator.gpu` existiert, sonst WASM. Zweck: Geschwindigkeit. Fällt weg, weil der Pfad ungeprüft ist und auf dem Zielgerät mutmaßlich hängt; WASM ist gemessen.

### Checkliste

- [x] `executionProviders()` löschen; in `createModel` `InferenceSession.create(modelBytes, { executionProviders: ['wasm'] })`. Kommentar über dem Aufruf: `// Nur WASM: WebGPU ist im echten Browser ungeprüft und hing auf einem Mali-Handy (ADR-008).`
- [x] Konstante `GAIN_MAP_RUN_TIMEOUT_MS = 30_000` mit Doc-Kommentar (`/** Obergrenze für einen Modelllauf ohne Download — ein hängender Lauf darf Vorschau und Speichern nicht ewig blockieren. */`).
- [x] Exportierte Klasse `ShadowTimeoutError extends Error` im selben File, Meldung `KI-Modell hat nicht rechtzeitig geantwortet.`, `name = 'ShadowTimeoutError'`.
- [x] `computeGainMap`: nach `await this.model()` den Rest (Eingabe lesen, `session.run`, Karte bilden) in eine private Methode `runModel(ort, session, warped): Promise<GainMap>` auslagern und so aufrufen: `return this.withTimeout(this.runModel(ort, session, warped), GAIN_MAP_RUN_TIMEOUT_MS);`
- [x] Private Methode `withTimeout<T>(work: Promise<T>, ms: number): Promise<T>` — `Promise.race` gegen ein `setTimeout`, das `new ShadowTimeoutError()` wirft; den Timer im `finally` per `clearTimeout` lösen.
- [x] In `runModel` die Dauer von `session.run` messen und loggen: `console.info('DocShadow: Modelllauf', Math.round(performance.now() - start), 'ms');` (Smoke-Punkt 1 braucht das).
- [x] Öffentliche Methode `discardGainMap(warped: Blob): void` → `this.gainMaps.delete(warped)`. Doc-Kommentar: `/** Nach Zeitüberschreitung im Aufrufer: der nächste Aufruf rechnet die Karte neu. */`
- [x] ADR `docs/decisions/008-speichern-robust.md` anlegen (Kontext: Hänger auf POCO X6 Pro, WebGPU ungeprüft · Optionen: WebGPU mit WASM-Rückfall / nur WASM / alles lassen + nur Zeitgrenze · Entscheidung: nur WASM, Zeitgrenzen 30 s Lauf / 60 s Speichern, Größengrenze 3000 px · Konsequenzen: langsamer auf Geräten mit funktionierendem WebGPU; synchroner WASM-Lauf blockiert den Hauptthread, die 30-s-Grenze fängt daher nur asynchrones Hängen — ein endlos rechnender WASM-Lauf würde sie nicht auslösen).
- [x] ADR-007 letzte Zeile ändern auf: `- Ausführung: nur WASM (geändert durch ADR-008).`
- [x] `docs/code-map.md`, Zeile `core/ml/doc-shadow.ts`: „…rechnet je begradigter Seite eine Verstärkungskarte (nur WASM, Zeitgrenze pro Lauf)…“.

## Phase 2 — Filter-Bildschirm: Grenzen, Schritt-Anzeige, Fehlerblock

### Kontext

- `src/app/features/filter/filter.ts`, `filter.html`, `filter.scss`
- `src/app/core/ml/doc-shadow.ts` (nach Phase 1: `ShadowTimeoutError`, `discardGainMap`, `loadState`, `loadProgress`)
- `src/app/core/image-filters.ts` (`renderFiltered(warped, settings, maxEdge?)`)
- `src/styles/_buttons.scss` (`.btn`, `.btn--small`, `.btn--primary`, `.btn--block`)
- `docs/conventions/angular.md`, `docs/conventions/typescript.md`

### Chesterton

- `hasFailed` (Signal) zeigt nach fehlgeschlagener Vorschau ODER fehlgeschlagenem Speichern den Einzeiler „Das hat nicht geklappt — bitte nochmal versuchen“. Bleibt für die Vorschau erhalten; Speichern bekommt das neue `saveError`.
- `onDoneClick` rechnet in voller Auflösung (ADR-006: volle Auflösung für Seite und PDF). Wird auf 3000 px gedeckelt — ADR-008 hält das fest.

### Kontrakt im Component

```ts
type SaveStep = 'model' | 'shadow' | 'filter' | 'store';
type SaveError = 'timeout' | 'shadow' | 'failed';

protected readonly saveStep = signal<SaveStep | null>(null);
protected readonly saveError = signal<SaveError | null>(null);
protected readonly saveProgress = computed(...);   // { label: string; fraction: number } | null
```

### Checkliste

- [ ] Konstanten in `filter.ts`: `SAVE_MAX_EDGE = 3000` (`/** Lange Kante der gespeicherten Seite — rund 250 dpi auf A4, spart dem Handy Speicher und Zeit (ADR-008). */`), `SAVE_TIMEOUT_MS = 60_000` (`/** Obergrenze fürs Speichern ab geladenem Modell (ADR-008). */`).
- [ ] Texte als Konstante `SAVE_STEP_LABELS: Record<Exclude<SaveStep, 'model'>, string>` = `{ shadow: 'Schatten berechnen', filter: 'Filter anwenden', store: 'Seite sichern' }` und `SAVE_ERROR_MESSAGES: Record<SaveError, string>` = `{ timeout: 'Speichern hat zu lange gedauert.', shadow: 'Schattenentfernung hat auf diesem Gerät nicht geklappt.', failed: 'Seite konnte nicht gespeichert werden.' }`; dazu `SHADOW_RUN_FAILED_MESSAGE = 'Schattenentfernung hat auf diesem Gerät nicht geklappt — ausgeschaltet'`.
- [ ] Klasse `SaveTimeoutError extends Error` (nicht exportiert) in `filter.ts`.
- [ ] `saveProgress = computed(...)`: `null`, wenn `saveStep()` null. Bei `'model'`: `{ label: 'KI-Modell lädt … NN %', fraction: loadProgress() }`. Sonst Schrittliste = `removeShadow ? ['shadow','filter','store'] : ['filter','store']`, Index `i` des aktuellen Schritts → `{ label: 'Schritt ${i+1} von ${n} · ${SAVE_STEP_LABELS[step]}', fraction: (i + 1) / n }`.
- [ ] Hilfsfunktion (Modul-Ebene) `nextPaint(): Promise<void>` = `new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve)))` mit Kommentar `// OpenCV und WASM blockieren den Hauptthread — erst malen lassen, dann rechnen.`
- [ ] Private Methode `setStep(step: SaveStep): Promise<void>` → `this.saveStep.set(step); return nextPaint();`
- [ ] Private Methode `withDeadline<T>(work: Promise<T>, deadline: number): Promise<T>` — `Promise.race` gegen Timer mit `Math.max(0, deadline - Date.now())`, wirft `SaveTimeoutError`, Timer im `finally` lösen.
- [ ] `onDoneClick` neu (Vorbedingungen wie bisher; `hasFailed` hier nicht mehr anfassen, stattdessen `saveError.set(null)`):
  1. `isSaving.set(true)`.
  2. Wenn `filter.removeShadow`: `await this.setStep('model'); await this.docShadow.load();`
  3. `const deadline = Date.now() + SAVE_TIMEOUT_MS;`
  4. Wenn `removeShadow`: `await this.setStep('shadow'); await this.withDeadline(this.docShadow.gainMap(warped), deadline);` — Fehler hier (auch `ShadowTimeoutError` und `SaveTimeoutError`) → `this.docShadow.discardGainMap(warped)`, `saveError.set(error instanceof SaveTimeoutError ? 'timeout' : 'shadow')`, return (über `finally`).
  5. `await this.setStep('filter'); const output = await this.withDeadline(this.imageFilters.renderFiltered(warped, filter, SAVE_MAX_EDGE), deadline);` (die Karte kommt aus dem Cache).
  6. `await this.setStep('store');` dann `createPage`, Page Buffer, `scanSession.reset()`, Navigation wie bisher.
  7. `catch`: `console.error('Seite speichern fehlgeschlagen', error)`; `saveError.set(error instanceof SaveTimeoutError ? 'timeout' : 'failed')`; bei `'timeout'` und `removeShadow` zusätzlich `discardGainMap(warped)`.
  8. `finally`: `isSaving.set(false); saveStep.set(null);`
  - Ein Fehler beim Modell-Laden in Schritt 2 ergibt `saveError = 'shadow'`.
- [ ] `protected async onSaveWithoutShadow(): Promise<void>` → `this.scanSession.setFilter({ ...this.settings(), removeShadow: false }); this.schedulePreview(0); await this.onDoneClick();`
- [ ] `renderPreview` `catch`: wenn `this.settings().removeShadow` → `setFilter({...removeShadow: false})`, `toast.show(SHADOW_RUN_FAILED_MESSAGE)`, `this.isPreviewStale = true` (die Schleife in `refreshPreview` rechnet dann ohne Schatten neu), return. Sonst wie bisher `hasFailed.set(true)`.
- [ ] `filter.html`, im Panel ganz oben:
  - `@if (saveProgress(); as progress)` → `<div class="filter__progress" role="status" aria-live="polite">` mit `<span class="filter__progress-label">{{ progress.label }}</span>` und `<div class="filter__progress-track"><div class="filter__progress-bar" [style.width.%]="progress.fraction * 100"></div></div>`.
  - `@if (saveError(); as error)` → `<div class="filter__error" role="alert">` mit `<p class="filter__hint filter__hint--danger">{{ saveErrorMessages[error] }}</p>`, darunter `<div class="filter__error-actions">`: wenn `settings().removeShadow` Knopf `class="btn btn--small btn--primary"` „Ohne Schattenentfernung speichern“ → `onSaveWithoutShadow()`; immer Knopf `class="btn btn--small"` „Nochmal versuchen“ → `onDoneClick()`. (`saveErrorMessages = SAVE_ERROR_MESSAGES` als `protected readonly`.)
  - Bestehender `@if (hasFailed())`-Einzeiler bleibt, aber nur `@if (hasFailed() && saveError() === null)`.
- [ ] `filter.scss`, Elemente in `.filter`: `&__progress` (grid, gap 6px, font-size 0.75rem); `&__progress-track` (height 4px, border-radius 4px, background `var(--cam-line)`, overflow hidden); `&__progress-bar` (height 100%, background `var(--cam-accent)`, `transition: width 0.3s ease`); `&__error` (grid, gap 8px); `&__error-actions` (flex, gap 8px, justify-content center, flex-wrap wrap).
- [ ] `docs/code-map.md`, Zeile `filter`: „…„Fertig“ rechnet auf höchstens 3000 px, zeigt die Schritte mit Balken, bricht nach 60 s mit Fehlerblock ab (Ohne Schattenentfernung speichern / Nochmal versuchen)…“.
- [ ] `npm run lint` und `npm run build` grün.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
