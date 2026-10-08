# Phase 1 — Fundament: Design-Bausteine & Strato-Deploy

**Rating:** standard — Stylesheets und ein Deploy-Skript nach vorhandenem Vorbild; keine offene Entscheidung.

Ergebnis: Die App hat die Farben, Schrift und Grundbausteine aus dem Mockup als globale Styles, ein `deploy.cmd` lädt den Build per Doppelklick auf das Strato-Paket, und die GitHub-Pipeline prüft nur noch, statt nach GitHub Pages hochzuladen.

## Kontext — vorher lesen

- `README.md` dieses Plans — Token-Tabelle, Bildschirm-Fluss
- `artifacts/camscanner-mockup.html` — `:root`-Variablen und die Klassen `.btn`, `.iconbtn`, `.topbar`, `.bottombar`
- `C:\Users\sasch\develop\CardMaker\deploy.cmd`, `deploy.env.example`, `.gitattributes` — Vorbild, wird für ein reines Frontend verkleinert (kein Backend, kein Composer, keine Brücke, kein `backend\.env`)
- `~/.claude/knowledge/topics/strato-shared-hosting.md` — Fallen-Tabelle (WinSCP-Schalterreihenfolge, `mkdir`-Vorlauf, Zugangsdaten als eigene Schalter, kein `-hostkey=*`)
- `~/.claude/knowledge/topics/windows.md` — Zeilen zu `.cmd`: Einlesen ohne delayed expansion, `*.cmd text eol=crlf`
- `.github/workflows/ci.yml`, `src/styles.scss`, `src/index.html`, `angular.json`
- `docs/conventions/angular.md`
- Vault-Fehlerklassen: `frameworks/css-architecture.md`, `sprachen/typescript.md` — geprüft, für diese Phase nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Globale Bausteine statt Komponenten für Buttons:** Buttons, Icon-Buttons, Topbar, Bottombar und Toast sind globale BEM-Klassen in `src/styles/`. Grund: jede Ansicht nutzt sie, und das Komponenten-Style-Budget (`anyComponentStyle` 4 kB Warnung) bliebe sonst nicht zu halten. Komponenten-SCSS enthält nur das, was nur dieser Bildschirm hat.
- **Icons als eine Komponente** `shared/icon` mit festem Namens-Satz, SVG-Pfade aus dem Mockup. Kein Icon-Font, keine Bibliothek.
- **Trefferfläche ≥ 44 px:** Das Mockup zeichnet Icon-Buttons mit 38 px. Sichtbar bleiben 38 px, die Trefferfläche wird über ein `::before` mit `inset: -3px` auf 44 px erweitert.
- **Deploy nur Frontend:** `deploy.cmd` baut, prüft und synchronisiert genau einen Ordner. `-delete` ist nötig, damit alte Bundles mit Hash-Namen verschwinden — deshalb verweigert das Skript ein Ziel `/` und verlangt einen eigenen Ordner (Subdomain).
- **`.htaccess` im Build:** liegt in `public/.htaccess` und wird von Angular mitkopiert (Asset-Glob mit `dot: true` in `@angular/build`, geprüft beim Planen).

## Struktur & Maße (Abnahme-Punkte)

- `body`: Hintergrund `--cam-bg`, Text `--cam-text`, Schrift `--cam-font`, `line-height: 1.45`, `color-scheme: dark`.
- `.btn`: Höhe 46 px, Innenabstand `0 18px`, Pillenform (`border-radius: 999px`), `font-weight: 600`, `font-size: .9rem`, Hintergrund `--cam-surface-2`, Lücke Icon/Text 8 px. `.btn--primary`: Hintergrund `--cam-accent`, Text `--cam-accent-ink`. `.btn--small`: Höhe 34 px, Innenabstand `0 14px`, `.8rem`. `.btn--block`: volle Breite. `:disabled`: `opacity: .5`.
- `.icon-btn`: 38 × 38 px, rund, Hintergrund `--cam-surface-2`; `.icon-btn--ghost`: Hintergrund `#0007` mit `backdrop-filter: blur(6px)`; aktiv-Zustand `.icon-btn--on`: Hintergrund `--cam-accent`, Icon `--cam-accent-ink`.
- `.topbar`: Flex, `space-between`, Innenabstand `8px 14px`; `.topbar__title`: `.95rem`, `font-weight: 600`. Oben zusätzlich `padding-top: max(8px, env(safe-area-inset-top))`.
- `.bottombar`: Flex, Lücke 10 px, Innenabstand `12px 14px max(18px, env(safe-area-inset-bottom))`.
- `.toast`: unten mittig, 16 px über der Bottombar (`bottom: calc(90px + env(safe-area-inset-bottom))`), Pille, Hintergrund `--cam-surface-2`, Rand `1px solid --cam-line`, Innenabstand `10px 16px`, `.85rem`; optionaler Aktions-Knopf als Text in `--cam-accent`, `font-weight: 600`. (Element ohne Mockup, aus den Bausteinen abgeleitet.)
- `cam-icon`: SVG 20 × 20, `viewBox 0 0 24 24`, `fill: none`, `stroke: currentColor`, `stroke-width: 2`, runde Enden/Ecken.

## Abnahme-Kriterien

- `npm run build`, `npm run lint`, `npm test` sauber; `dist/cam-scanner/browser/.htaccess` existiert nach dem Build.
- `deploy.cmd` ohne `deploy.env` bricht mit verständlicher Meldung ab; mit `REMOTE_WEB_PATH=/` bricht es ab, bevor es sich verbindet.
- Nach `deploy.cmd` (vom User mit echten Zugangsdaten): die App lädt unter `PUBLIC_URL`, `curl -I http://…` liefert genau eine 301 auf `https://`, `curl -I https://…/pages` liefert 200, `curl -I https://…/ngsw.json` zeigt `Cache-Control: no-cache`.
- Die GitHub-Pipeline läuft bei Push auf `main` nur noch Lint, Build, Test; kein Pages-Upload mehr.
- Im Browser: Hintergrund ist `#0b0d10`, die bestehende Sucher-Ansicht funktioniert unverändert.

## Checkliste

- [x] `src/styles/_tokens.scss`: `:root` mit allen Variablen der Token-Tabelle (Namen exakt wie dort).
- [x] `src/styles/_base.scss`: Regeln für `html, body` aus dem bisherigen `styles.scss` übernehmen (`height: 100%`, `margin: 0`, `overscroll-behavior: none`, `touch-action: manipulation`), Hintergrund auf `var(--cam-bg)`, dazu Farbe, Schrift, `color-scheme: dark`, `* { box-sizing: border-box; }`, `button { font: inherit; color: inherit; }`.
- [x] `src/styles/_buttons.scss`, `_bars.scss` (`.topbar`, `.bottombar`), `_toast.scss` nach „Struktur & Maße“.
- [x] `src/styles.scss`: nur noch `@use 'styles/tokens'; @use 'styles/base'; @use 'styles/buttons'; @use 'styles/bars'; @use 'styles/toast';`.
- [x] `ng generate component shared/icon` → `icon.ts/.html/.scss`. Input `name = input.required<IconName>()`. `IconName` und die Pfade als `const ICON_PATHS: Record<IconName, string>`:
      - `back`: `m15 18-6-6 6-6`
      - `flash`: `M13 2 4 14h7l-1 8 9-12h-7z`
      - `grid`: `M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18`
      - `rotate`: `M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5`
      - `share`: `M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14`
      - `lock`: `M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3`
      - `plus`: `M12 5v14M5 12h14`
      - `close`: `M6 6l12 12M18 6 6 18`
      - `camera-off`: `M3 3l18 18M10.5 6H14l1.5 2H19a2 2 0 0 1 2 2v7M3 8.5V17a2 2 0 0 0 2 2h11M9.9 9.9a3.5 3.5 0 0 0 4.2 4.2`
      - `info`: `M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8h.01`
      - SVG mit `aria-hidden="true"`; die Beschriftung trägt immer der umgebende Button (`aria-label`).
- [x] `src/index.html`: `lang="de"`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `<meta name="theme-color" content="#0b0d10">`, `<noscript>` auf Deutsch („Bitte JavaScript aktivieren, sonst kann nichts gescannt werden.“).
- [x] `public/.htaccess`:
      ```
      Options -Indexes
      AddType application/manifest+json .webmanifest
      AddType application/wasm .wasm
      RewriteEngine On
      RewriteCond %{HTTPS} !=on
      RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
      RewriteCond %{REQUEST_FILENAME} -f [OR]
      RewriteCond %{REQUEST_FILENAME} -d
      RewriteRule ^ - [L]
      RewriteRule ^ index.html [L]
      <IfModule mod_headers.c>
        <FilesMatch "\.(js|css|woff2|png|svg)$">
          Header set Cache-Control "public, max-age=31536000, immutable"
        </FilesMatch>
        <FilesMatch "^(index\.html|ngsw\.json|ngsw-worker\.js|safety-worker\.js|worker-basic\.min\.js|manifest\.webmanifest)$">
          Header set Cache-Control "no-cache"
        </FilesMatch>
      </IfModule>
      ```
      Die zweite `FilesMatch` steht bewusst danach, damit sie für `ngsw-worker.js` die erste überschreibt. Läuft die HTTPS-Umleitung auf Strato im Kreis (Browser meldet „zu oft umgeleitet“), die beiden Zeilen `RewriteCond %{HTTPS}`/`RewriteRule … R=301` entfernen, im Strato-Kundenbereich „HTTPS erzwingen“ für die Domain einschalten und das in `FINDINGS.md` sowie ADR-004 vermerken.
- [x] `.gitattributes` neu: `* text=auto eol=lf`, `*.cmd text eol=crlf`, `*.bat text eol=crlf`, `*.png binary`, `*.ico binary`, `*.onnx binary`. Danach `git add --renormalize .` und prüfen, dass `git status` nur erwartete Dateien zeigt; falls mehr als `.gitattributes` und die neuen Dateien geändert erscheinen, den Renormalize-Teil als eigenen `chore`-Commit vorziehen.
- [x] `.gitignore`: Block „Deploy“ mit `deploy.env`.
- [x] `deploy.env.example` (Kommentare wie CardMaker, aber nur diese Schlüssel): `WINSCP_PATH`, `SFTP_PROTOCOL`, `SFTP_HOST`, `SFTP_USER`, `SFTP_PASSWORD`, `SFTP_HOSTKEY`, `REMOTE_WEB_PATH` (Kommentar: eigener Ordner der Subdomain, z. B. `/scanner/`, **nie** `/` — der Upload löscht im Ziel alles, was nicht zum Build gehört), `BASE_HREF` (Standard `/`; nur ändern, wenn die App in einem Unterordner einer Domain läuft, dann z. B. `/scanner/`), `PUBLIC_URL` (z. B. `https://scan.example.de/`, nur für die Abschlussmeldung).
- [x] `deploy.cmd` (CRLF, `@echo off`, `chcp 65001`, Kopfkommentar „CamScanner - hochladen per Doppelklick“). Ablauf und Meldungen nach CardMaker, Schritte:
      1. `deploy.env` fehlt → Fehler mit Hinweis auf `deploy.env.example`.
      2. Einlesen mit `for /f "usebackq eol=# tokens=1,* delims==" %%A in ("deploy.env") do set "%%A=%%B"` **vor** `setlocal enabledelayedexpansion` (wörtlich aus CardMaker samt Kommentar).
      3. Standardwert `BASE_HREF=/`; Pflichtwerte über `:needValue` (aus CardMaker kopieren): `WINSCP_PATH`, `SFTP_PROTOCOL`, `SFTP_HOST`, `SFTP_USER`, `SFTP_PASSWORD`, `REMOTE_WEB_PATH`.
      4. Schutz: ist `REMOTE_WEB_PATH` gleich `/` → `[FEHLER] REMOTE_WEB_PATH darf nicht "/" sein. Der Upload loescht im Ziel alles, was nicht zur App gehoert - trage den eigenen Ordner der Subdomain ein.` und Abbruch. Endet der Wert nicht auf `/` → Fehler mit Hinweis auf den Schrägstrich am Ende.
      5. WinSCP-Pfad und Hostkey prüfen wie CardMaker (`:winscpFound`, `:protocolOk`).
      6. `[1/4] App bauen ...` → `call npm run build -- --base-href "!BASE_HREF!"`; Fehler → „Es wird nichts hochgeladen.“ Danach prüfen, dass `dist\cam-scanner\browser\index.html` und `dist\cam-scanner\browser\.htaccess` existieren.
      7. Bestätigung: Ziel anzeigen (`Ziel auf dem Server: !REMOTE_WEB_PATH!` und `Dort wird alles geloescht, was nicht zur App gehoert.`), dann `choice /c JN /m "Jetzt hochladen"`; `N` → Abbruch ohne Fehler.
      8. `[2/4]` Vorlauf: Prep-Skript mit `option batch continue` und `mkdir !REMOTE_WEB_PATH!` (wie CardMaker, ungeprüft).
      9. `[3/4] Verbinden und hochladen ...` → `synchronize remote -delete "dist\cam-scanner\browser" "!REMOTE_WEB_PATH!"` (Schalter vor den Verzeichnissen). Temp-Skripte unter `%TEMP%\camscanner-*.txt`, danach löschen.
      10. `[4/4] Fertig` mit `!PUBLIC_URL!`, falls gesetzt; `pause`. Fehlerpfad `:fail` mit `pause` und `exit /b 1`.
      11. `:writeSession` und `:needValue` unverändert aus CardMaker.
- [x] Trockenlauf: `deploy.cmd` ohne `deploy.env` und mit einer Test-`deploy.env` mit `REMOTE_WEB_PATH=/` ausführen; beide müssen vor dem Verbinden abbrechen. Den echten Upload macht der User (Zugangsdaten, Subdomain, SSL im Strato-Kundenbereich).
- [x] `.github/workflows/ci.yml`: Job `deploy` vollständig entfernen; `build-and-test` bleibt unverändert.
- [x] `docs/decisions/004-hosting-strato.md` (Kontext: Pages kann keine eigenen Header, Strato-Paket ist vorhanden · Optionen: GitHub Pages, Strato · Entscheidung: Strato statisch, `deploy.cmd`, eigener Ordner pro Subdomain, `-delete` · Konsequenzen: Upload nur von diesem Rechner, HTTPS-Umleitung per `.htaccess`, COOP/COEP für Phase 11 per `.htaccess` testbar).

## Doc-Updates

- [x] `AGENTS.md` Quickstart: Zeile `deploy.cmd        # Build + Upload nach Strato (braucht deploy.env)`; Critical Rule ergänzen: „`deploy.env` enthält Zugangsdaten und wird nie committet.“
- [x] `README.md` (Projekt-Root): Abschnitt „Deploy“ mit drei Sätzen: `deploy.env.example` nach `deploy.env` kopieren und ausfüllen, `deploy.cmd` doppelklicken, Ziel ist ein eigener Ordner auf dem Strato-Paket.
- [x] `docs/code-map.md`: Zeilen für `src/styles/` (globale Bausteine), `shared/icon`, `public/.htaccess`, `deploy.cmd`.
- [x] `docs/glossary.md`: „Design-Token“ (benannte Farbe/Größe aus dem Mockup als CSS-Variable `--cam-*`).

## Report-Back

Status: complete. Build, Lint und die 9 bestehenden Tests sind grün, `.htaccess` liegt im Build. Trockenläufe von `deploy.cmd` (ohne `deploy.env`, mit `REMOTE_WEB_PATH=/`, ohne Schrägstrich am Ende) brechen vor dem Verbinden ab. Offen beim User: echter Upload (Zugangsdaten, Subdomain, SSL im Strato-Kundenbereich) und die curl-Prüfung aus den Abnahme-Kriterien. Für `icon` wurde bewusst keine Spec-Datei behalten (Profil private).
