# 001 — Frontend-Framework: Angular

**Status:** Akzeptiert
**Datum:** 2026-07-31

## Kontext

Das Konzept ([docs/concept.md](concept.md)) ist framework-agnostisch geschrieben —
es nennt nur OpenCV.js, Canvas API, pdf-lib, Web Share API, optional
onnxruntime-web. Beim Bootstrap musste ein konkreter Frontend-Stack gewählt
werden.

## Entscheidung

Angular 22 (standalone, zoneless), TypeScript, SCSS. Selektor-Prefix `cam`,
Datei-Naming nach 2025-Style-Guide (kein `.component.`-Infix).

## Begründung

Explizite Nutzerwahl im Bootstrap-Interview. Zoneless + Signals passen
technisch gut zu einer canvas-/kamera-lastigen App: State-Updates pro Frame
laufen gezielt statt über globale Change-Detection-Zyklen.

## Alternativen (verworfen)

- **Vanilla TypeScript + Vite** — ursprüngliche Empfehlung (kein
  Framework-Overhead), aber Nutzerpräferenz ging klar zu Angular
- **React/Svelte + Vite** — ebenfalls zur Wahl gestellt, nicht gewählt

## Konsequenzen

- Angular CLI ist die einzige Quelle für neue Komponenten/Services/Pipes
  (`ng generate`) — siehe `docs/conventions/angular.md`
- Kein NgRx im Startzustand — erst einführen, wenn echter Cross-Feature-State
  entsteht (siehe ADR-Kandidat bei Bedarf)
