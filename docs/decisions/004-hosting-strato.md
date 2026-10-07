# 004 — Hosting auf Strato als statischer Build

**Status:** Akzeptiert
**Datum:** 2026-10-07

## Kontext

Die App ist ein reiner statischer Build ohne Backend. Sie braucht eigene HTTP-Header (Cache-Steuerung für den Service Worker, später eventuell `COOP`/`COEP` für die KI-Schattenentfernung), die GitHub Pages nicht setzen kann. Ein Strato-Paket mit eigener Subdomain ist bereits vorhanden.

## Optionen

- **GitHub Pages** — kostenlos, Upload per Pipeline; keine eigenen Header, keine `.htaccess`.
- **Strato, statisch** — Apache mit `.htaccess`, Upload per WinSCP von diesem Rechner.

## Entscheidung

Strato, statisch. `deploy.cmd` baut die App und gleicht `dist/cam-scanner/browser` per WinSCP (`synchronize remote -delete`) mit einem **eigenen Ordner pro Subdomain** ab. Das Skript verweigert das Ziel `/`, weil `-delete` im Ziel alles entfernt, was nicht zum Build gehört. Die GitHub-Pipeline prüft nur noch (Lint, Build, Test) und lädt nichts mehr hoch.

## Konsequenzen

- Der Upload läuft nur von diesem Rechner, mit Zugangsdaten aus `deploy.env` (nie im Git).
- HTTPS-Umleitung, SPA-Fallback auf `index.html` und die Cache-Header kommen aus `public/.htaccess`, die Angular mit in den Build kopiert.
- `COOP`/`COEP` lassen sich für Phase 11 per `.htaccess` nachrüsten und testen.
- Läuft die HTTPS-Umleitung im Kreis („zu oft umgeleitet“), die beiden `RewriteCond %{HTTPS}`/`R=301`-Zeilen aus der `.htaccess` entfernen und im Strato-Kundenbereich „HTTPS erzwingen“ einschalten.
