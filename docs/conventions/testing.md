# Testing Conventions — CamScanner

## Stack

| Layer | Choice |
|---|---|
| Runner | Vitest (`npm test`) |
| Umgebung | jsdom |

## Regeln

- **Automatisierte Tests gibt es nur für reine Rechen-Funktionen ohne Kamera,
  Canvas oder OpenCV** — konkret `core/geometry.ts`. Ein Test, der nur prüft,
  ob ein Mock aufgerufen wurde, sichert nichts ab — deshalb gibt es hier keine
  Mock-Tests für OpenCV.js/Kamera/Canvas-Services.
- **Alles andere** (Kamera-Zugriff, Kantenerkennung, Perspektivkorrektur,
  PDF-Zusammenbau, Page-Buffer-State) wird über die Smoke-Checkliste des
  jeweiligen Plans **manuell** abgenommen — der User prüft am realen Gerät.
- Nach jeder Code-Änderung an `core/geometry.ts`: zugehörige Tests laufen
  lassen, Failures fixen, bevor weitergemacht wird.

## Critical Rules

1. **Kein Test committen, der nur durchläuft, weil er nichts prüft** — ein
   `expect(true).toBe(true)`-Platzhalter ist schlimmer als kein Test, weil er
   Abdeckung vortäuscht.
