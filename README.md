# CamScanner

Clientseitige Progressive Web App zum Scannen von Dokumenten: Kamera erfassen,
automatisch zuschneiden und begradigen, Scan-Look-Optimierung, mehrseitige
PDFs erzeugen, teilen über die Web Share API. Kein Backend, kein Login, keine
Daten verlassen das Gerät.

## Quickstart

Voraussetzung: Node.js 22+, npm.

```bash
npm install
npm start       # ng serve — http://localhost:4200
npm run build   # Production-Build nach dist/
npm test        # Vitest
npm run lint    # angular-eslint
```

Kamera-Zugriff (`getUserMedia`) verlangt einen Secure Context — `localhost`
funktioniert für die lokale Entwicklung, ein Deploy braucht HTTPS.

## Mehr

Voller Projekt-Kontext, Architektur und Konventionen: [AGENTS.md](AGENTS.md).
