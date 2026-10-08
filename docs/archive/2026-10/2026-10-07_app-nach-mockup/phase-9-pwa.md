# Phase 9 — PWA-Härtung

**Rating:** standard — Manifest, Icons, Service-Worker-Konfiguration und ein Update-Hinweis; Prüfung auf dem echten Server.

Ergebnis: Die App lässt sich von Strato aus auf dem Handy installieren, hat ein eigenes Icon in den Mockup-Farben, startet offline und meldet eine neue Version mit „Neu laden“.

## Kontext — vorher lesen

- `public/manifest.webmanifest`, `public/icons/`, `public/favicon.ico`, `ngsw-config.json`, `src/index.html`, `src/app/app.config.ts`, `src/app/app.ts`, `src/app/core/toast.ts`
- `public/.htaccess` (Cache-Regeln aus Phase 1)
- `~/.claude/knowledge/werkzeuge/edge-headless.md` — Screenshots per Edge ohne Fenster (für die PNG-Icons)
- `README.md` dieses Plans — Token-Tabelle
- Vault-Fehlerklassen: `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Manifest:** `name` „CamScanner“, `short_name` „Scanner“, `lang` „de“, `description` „Dokumente scannen, zuschneiden und als PDF teilen — alles auf dem Gerät.“, `display` „standalone“, `orientation` „portrait“, `theme_color` und `background_color` `#0b0d10`, `start_url` und `scope` `./`.
- **Icon (Element ohne Mockup):** `public/icons/icon.svg`, 512 × 512: Hintergrund `#0b0d10`; mittig ein Blatt in `#f6f3ec` (Papier-Farbe aus dem Mockup), 240 × 310, Radius 10; darum vier L-förmige Eckwinkel in `#3ddc97`, Strichstärke 28, runde Enden, Abstand 24 zum Blatt (das Motiv „erkanntes Dokument“ aus Mockup-Figur 1). `icon-maskable.svg` gleiches Motiv auf 60 % verkleinert (sichere Zone). PNG-Ausgabe: `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180), `favicon-32.png`. Erzeugen mit Edge headless aus einer Hilfs-HTML im Scratch-Ordner der Session (nicht im Repo), Befehl nach `edge-headless.md`; das Vorgehen in einer Zeile in `public/icons/README.md` festhalten.
- **Alte Icons** `icon-72x72.png` … `icon-512x512.png` und `favicon.ico` stammen aus der Angular-PWA-Vorlage (Angular-Logo) und werden nur vom Manifest bzw. `index.html`/`ngsw-config.json` referenziert — vor dem Löschen mit Grep nach `icon-` und `favicon` bestätigen, dann entfernen.
- **Manifest-Icons:** `purpose: "any"` und `purpose: "maskable"` getrennt (nicht `"maskable any"` in einem Eintrag).
- **Service Worker:** Gruppe `app` (prefetch) behält `/*.js` und `/*.css` (enthält den OpenCV-Chunk — ohne ihn kein Offline-Scannen), `/favicon.ico` → `/icons/favicon-32.png`; Gruppe `assets` unverändert. `registrationStrategy` bleibt `registerWhenStable:30000`.
- **Update-Hinweis:** `core/app-update.ts` hört auf `SwUpdate.versionUpdates`; bei `VERSION_READY` Toast „Neue Version verfügbar“ mit Aktion „Neu laden“ (`document.location.reload()`), Dauer 10 s. Nur aktiv, wenn `swUpdate.isEnabled`. Wird in `App` per `inject` einmal angestoßen.
- **Prüfung der Installierbarkeit:** Chrome DevTools → Application → Manifest (Abschnitt „Installability“) ohne Fehler. Die Lighthouse-Kategorie „PWA“ gibt es in aktuellen Chrome-Versionen nicht mehr; `docs/PROJECT.md` wird entsprechend angepasst.

## Abnahme-Kriterien

- Chrome auf Android bietet „App installieren“ an; das Icon auf dem Homescreen zeigt das neue Motiv, ohne weißen Rand.
- DevTools → Manifest: keine Fehler, beide Icon-Arten erkannt.
- Installierte App im Flugmodus: startet, Kamera läuft, eine Seite lässt sich bis zum heruntergeladenen PDF bringen.
- Nach einem weiteren `deploy.cmd` erscheint in der offenen App der Hinweis „Neue Version verfügbar“; „Neu laden“ zeigt die neue Version.
- Statusleiste/Adresszeile auf Android in `#0b0d10`.

## Checkliste

- [x] Icons laut Entscheidungen erzeugen; alte Icons nach Grep-Bestätigung löschen.
- [x] `public/manifest.webmanifest` neu laut Entscheidungen.
- [x] `src/index.html`: `<link rel="icon" type="image/png" href="icons/favicon-32.png">`, `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`.
- [x] `ngsw-config.json` laut Entscheidungen.
- [x] `ng generate service core/app-update` + Aufruf in `app.ts`.
- [ ] Deploy (User) und Prüfung auf dem Handy laut AK.

## Doc-Updates

- [x] `docs/PROJECT.md` Meilenstein 4: „Lighthouse PWA-Checks“ ersetzen durch „Installierbarkeit laut Chrome DevTools (Application → Manifest)“.
- [x] `docs/code-map.md`: Core-Zeile `app-update.ts`; Zeile `public/icons/` (Quelle `icon.svg`, Erzeugung siehe README dort).
- [x] `AGENTS.md` Critical Rules: „Offline-Fähigkeit hängt am Prefetch von `/*.js` in `ngsw-config.json` — den OpenCV-Chunk nie in eine Lazy-Gruppe verschieben.“

## Report-Back

Status: complete (Code), Geräteprüfung steht beim User aus.

- Icons per Chrome headless statt Edge (Edge ist auf dieser Maschine nicht installiert); README in `public/icons/` nennt das Vorgehen.
- `AppUpdate` injiziert `SwUpdate` optional — ohne `provideServiceWorker` (Test) gibt es keinen Provider, `app.spec.ts` blieb unverändert.
- Zusatz aus FINDINGS: `mod_deflate`-Block in `public/.htaccess`, damit der 17-MB-OpenCV-Chunk komprimiert ausgeliefert wird. Wirkung auf Strato ungeprüft (`curl -I -H "Accept-Encoding: gzip"` auf den Chunk → `Content-Encoding: gzip`).
- Build-Beleg: der größte Chunk (16,7 MB) steht in der `app`-Prefetch-Gruppe von `ngsw.json`.
- Lint, `npm test` (9 grün) und Build sauber.
