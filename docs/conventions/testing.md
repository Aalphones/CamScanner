# Testing Conventions — CamScanner

## Stack

| Layer | Choice |
|---|---|
| Runner | Vitest (`npm test`) |
| Umgebung | jsdom |

## Regeln

- Neue Features bekommen Unit-Tests für die nicht-triviale Logik (Kanten-
  erkennung-Wrapper, Perspektivkorrektur-Aufruf, PDF-Zusammenbau,
  Page-Buffer-State) — reine Template-/Styling-Komponenten ohne Logik
  brauchen keinen Test-Overkill
- **Bildverarbeitung testen ohne echte Kamera:** OpenCV.js/ONNX-Aufrufe hinter
  einem Service kapseln (siehe `angular.md` → Critical Rules #6) und in
  Unit-Tests mocken — kein echter `getUserMedia`-Stream in Tests
- Nach jeder Code-Änderung: zugehörige Tests laufen lassen, Failures fixen,
  bevor weitergemacht wird

## Critical Rules

1. **Kein Test committen, der nur durchläuft, weil er nichts prüft** — ein
   `expect(true).toBe(true)`-Platzhalter ist schlimmer als kein Test, weil er
   Abdeckung vortäuscht.
