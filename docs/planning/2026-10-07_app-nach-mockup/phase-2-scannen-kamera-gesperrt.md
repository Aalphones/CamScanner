# Phase 2 — Scannen & Kamera-gesperrt

**Rating:** standard — Umbau eines bestehenden Bildschirms nach Mockup plus zwei kleine Kamera-Funktionen.

Ergebnis: Der Sucher sieht aus wie Mockup-Bildschirm 1 (ohne Live-Rahmen und ohne Seitenzähler — die kommen in Phase 5 und 6), hat Taschenlampe und Raster, und jeder Kamera-Fehler zeigt den Bildschirm „Kamera ist gesperrt“ aus Mockup-Bildschirm 6 bzw. seine Geschwister-Varianten.

## Kontext — vorher lesen

- `README.md` dieses Plans — Token-Tabelle
- `artifacts/camscanner-mockup.html` — Figuren 1 „Scannen“ und 6 „Fehlerzustand“; Klassen `.cam-top`, `.hint`, `.cam-bottom`, `.shutter`, `.empty`, `.steps`
- `src/app/features/capture/` (alle Dateien), `src/app/core/camera.ts`
- `src/styles/` aus Phase 1, `src/app/shared/icon/`
- `docs/conventions/angular.md` — Critical Rules 1, 3, 4, 6
- Vault-Fehlerklassen: `frameworks/css-architecture.md`, `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Taschenlampe** nur zeigen, wenn der Video-Track sie kann: `track.getCapabilities()` enthält `torch: true`. Schalten über `track.applyConstraints({ advanced: [{ torch: true | false }] })`. Der TypeScript-Typ kennt `torch` nicht — eine lokale Schnittstelle `TorchCapabilities extends MediaTrackCapabilities { torch?: boolean }` in `camera.ts`, kein `any`.
- **Raster**: 3 × 3-Hilfslinien über dem Bild. Zustand bleibt pro Gerät erhalten (`localStorage`-Schlüssel `cam.grid`, Zugriff in `try/catch`, Fehler = Raster aus).
- **Fehlerbildschirm als eigene Komponente** `features/capture/camera-blocked/`, weil drei Varianten dieselbe Struktur teilen. Varianten:
  - `denied` — Titel „Kamera ist gesperrt“, Text „Ohne Kamera kann nichts gescannt werden.“, Schritte „1 · Schloss neben der Adresszeile antippen“, „2 · „Kamera“ auf **Zulassen** stellen“, „3 · Seite neu laden“, Knopf „Nochmal versuchen“ (ruft `camera.start` erneut).
  - `insecure` — Titel „Keine sichere Verbindung“, Text „Die Kamera funktioniert nur über eine verschlüsselte Verbindung.“, Schritte „1 · Adresse mit **https://** statt http:// öffnen“, Knopf „Mit https öffnen“ (`location.replace` auf dieselbe Adresse mit `https:`).
  - `unavailable` — Titel „Keine Kamera gefunden“, Text „Dieses Gerät hat keine Kamera, oder eine andere App benutzt sie gerade.“, Schritte „1 · Andere Apps mit Kamera schließen“, „2 · Nochmal versuchen“, Knopf „Nochmal versuchen“.

## Struktur & Maße (Abnahme-Punkte, Mockup-Figur 1 und 6)

- Video vollflächig, `object-fit: cover`, Hintergrund schwarz.
- Obere Reihe (`.capture__top`): absolut oben, Innenabstand `6px 14px`, `top: max(6px, env(safe-area-inset-top))`, links Ghost-Icon-Button `flash` („Taschenlampe“, nur wenn verfügbar; eingeschaltet `.icon-btn--on`), rechts Ghost-Icon-Button `grid` („Raster“, eingeschaltet `.icon-btn--on`).
- Hinweis-Pille (`.capture__hint`): mittig, 56 px unter der oberen Kante der sicheren Fläche, Innenabstand `8px 14px`, Hintergrund `#000a`, `backdrop-filter: blur(6px)`, `.78rem`, Pillenform. Text in dieser Phase: „Dokument formatfüllend ins Bild halten“ (Punkt-Markierung erst in Phase 5).
- Untere Leiste (`.capture__bottom`): absolut unten, `display: grid; grid-template-columns: 1fr auto 1fr; align-items: center`, Innenabstand `14px 20px max(22px, env(safe-area-inset-bottom))`, Verlauf `linear-gradient(transparent, #000c)`. Mitte: Auslöser. Linke und rechte Zelle bleiben in dieser Phase leer (Phase 6 füllt sie).
- Auslöser: 72 × 72 px, Rand `4px solid #fff`, Hintergrund `#fff3`, Innenabstand 5 px, innen eine weiße Vollscheibe (`::after`). `:disabled` → `opacity: .5`. `aria-label="Foto aufnehmen"`.
- Raster: zwei senkrechte und zwei waagerechte Linien bei 33,3 % und 66,6 %, `1px solid rgba(255,255,255,.25)`, `pointer-events: none`.
- Fehlerbildschirm: Fläche `--cam-bg`, Inhalt senkrecht und waagerecht zentriert, Innenabstand `0 30px`, Lücke 14 px. Kreis 84 px, Hintergrund `--cam-surface-2`, Icon `camera-off` 38 px in `--cam-danger`, Strichstärke 1.8. Titel `1.1rem`, Text `.85rem` in `--cam-muted`. Schritt-Box: volle Breite, linksbündig, Hintergrund `--cam-surface`, Radius 12 px, Innenabstand `12px 14px`, `.78rem` `--cam-muted`, „So geht’s:“ fett in `--cam-text`. Knopf `.btn.btn--primary.btn--block`.

## Abnahme-Kriterien

- Auf einem Handy mit Taschenlampe schaltet der Knopf das Licht an und aus; auf einem Gerät ohne (Desktop-Webcam) ist der Knopf nicht sichtbar.
- Raster-Knopf blendet die Linien ein und aus; nach Neuladen ist der letzte Zustand wieder da.
- Kamera im Browser sperren → Variante `denied` erscheint; Erlaubnis freigeben, „Nochmal versuchen“ → Kamerabild läuft ohne Neuladen.
- Aufruf über `http://` einer anderen Adresse als `localhost` → Variante `insecure`; der Knopf öffnet dieselbe Adresse mit `https://`.
- Auslöser friert wie bisher ein Standbild ein und navigiert nach `/crop` (die Route existiert erst nach Phase 3; bis dahin führt die Umleitung `**` zurück in den Sucher — erwartet).
- Komponenten-Styles bleiben unter der 4-kB-Warnschwelle (`npm run build` ohne Budget-Warnung).

## Checkliste

- [ ] `core/camera.ts`: Signal `torchAvailable` (nach erfolgreichem Start aus `getCapabilities()` gesetzt, bei `stop()` auf `false`), Signal `torchOn`, Methode `setTorch(on: boolean): Promise<void>` (ignoriert Aufrufe ohne laufenden Track; bei Fehler `torchOn` auf `false`). `stop()` setzt `torchOn` auf `false`.
- [ ] `ng generate component features/capture/camera-blocked` → Input `reason = input.required<'denied' | 'insecure' | 'unavailable'>()`, Output `retry = output<void>()`. Texte als `const BLOCKED_TEXTS: Record<…, { title; text; steps: readonly string[]; action: string }>`. Für `insecure` löst der Knopf selbst `location.replace(location.href.replace(/^http:/, 'https:'))` aus statt `retry` — den Zugriff auf `location` über `inject(DOCUMENT).location` (kein globales `window` in der Komponente).
- [ ] `features/capture/capture.html` neu nach „Struktur & Maße“: Video, Raster (`@if (gridOn())`), obere Reihe, Hinweis, untere Leiste mit Auslöser; bei `denied`/`insecure`/`unavailable` stattdessen `<cam-camera-blocked [reason]="state()" (retry)="onRetryClick()" />`. Zustand `starting`/`idle`: nur schwarzer Hintergrund.
- [ ] `features/capture/capture.scss`: nur Sucher-eigene Regeln (BEM `.capture__video`, `.capture__top`, `.capture__hint`, `.capture__bottom`, `.capture__shutter`, `.capture__grid`). Button-Optik kommt aus den globalen Klassen.
- [ ] `features/capture/capture.ts`: `gridOn` als Signal mit `localStorage`-Lesen im Feld-Initialisierer (in `try/catch`) und Schreiben in `onGridClick()`; `onTorchClick()` ruft `camera.setTorch(!camera.torchOn())`.

## Doc-Updates

- [ ] `docs/code-map.md`: Feature-Zeile `capture` ergänzen um `camera-blocked/` (Fehlerbildschirm, drei Varianten).
- [ ] `docs/glossary.md`: „Taschenlampe (torch)“ — Dauerlicht der Rückkamera, nur auf Geräten, deren Video-Track es meldet.

## Report-Back
