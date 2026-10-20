# 010 — Ecken auf voller Auflösung per Linienanpassung nachziehen

**Status:** Akzeptiert
**Datum:** 2026-10-20

## Kontext

Die OpenCV-Erkennung (`core/document-detection.ts`) arbeitet auf einer Arbeitskopie mit 1024 px langer Kante. Ihre Ecken liegen auf ganzen Pixeln dieser Kopie, und die Dilatation nach Canny schiebt die äußere Kontur um etwa einen Pixel nach außen. Auf dem 4000-px-Original sind das mehrere Pixel Tisch am Seitenrand — nach dem Begradigen ein dunkler Saum.

## Optionen

- **Nichts tun** — der Saum bleibt, der User zieht die Ecken von Hand nach.
- **`cornerSubPix`** — fehlt in OpenCV.js; außerdem sind Eckpunkte an abgerundeten oder geknickten Blattecken unzuverlässig.
- **Linienanpassung an die Kanten** — je Seite Kantenpunkte quer zur Kante auf voller Auflösung suchen, eine Gerade hindurchlegen, Ecken als Schnittpunkte benachbarter Geraden.

## Entscheidung

Linienanpassung als reine TypeScript-Funktion (`core/edge-refinement.ts`, kein OpenCV): 32 Stützpunkte auf dem mittleren Stück jeder Kante, je Stützpunkt der stärkste Helligkeitssprung im Suchfenster (Feinlage per Parabel), schwache Punkte und Ausreißer raus, Gerade per Hauptachse. Suchbreite 3 Pixel der Arbeitskopie, umgerechnet aufs Original, mindestens 6 px.

Verfeinert werden nur automatisch erkannte Ecken, und nur wenn das OpenCV-Ergebnis gewinnt (ADR-011) — die Suchbreite ist auf dessen Versatz bemessen, KI-Ecken weichen weiter ab. Vom User gezogene Ecken bleiben unangetastet.

Sicherheitsnetz, ganz oder gar nicht: zu wenige Kantenpunkte, parallele Geraden, eine Ecke weiter als 2 × Suchbreite gewandert oder ein nicht konvexes Ergebnis → das Eingangs-Viereck bleibt, Konsole `Kanten: verworfen (<Grund>)`.

## Konsequenzen

- Beim Zuschneiden wird das Standbild einmal mehr in voller Auflösung gelesen (~50 MB kurzzeitig bei 12 MP).
- Muster oder Linien direkt am Blattrand können eine Kante verziehen; das Sicherheitsnetz begrenzt den Schaden auf 2 × Suchbreite.
- Gewinnt die KI, gibt es keine Feinlage — der Saum kann dort bleiben.
