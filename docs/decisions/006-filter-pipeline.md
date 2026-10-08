# 006 — Filter-Pipeline: OpenCV.js auf dem Haupt-Thread

**Status:** Akzeptiert
**Datum:** 2026-10-08

## Kontext

Jede Seite bekommt einen Scan-Look (Original, Auto, Scan, S/W, Grau) plus Kontrast und Helligkeit. Der Filter-Bildschirm braucht schnelle Vorschauen, das PDF das Ergebnis in voller Auflösung (bis 12 MP). Schatten und Lichtverläufe sollen verschwinden, Schrift lesbar bleiben — das schafft nur eine echte Bildverarbeitung, keine reine Farbverschiebung.

## Optionen

- **Canvas-`filter` (CSS-Filter wie `contrast()`, `grayscale()`)** — schnell, ohne Zusatzbibliothek; kennt aber keine lokale Helligkeitskorrektur, Schatten bleiben.
- **OpenCV.js auf dem Haupt-Thread** — dieselbe Bibliothek, die Erkennung und Begradigen schon laden; Background Division, CLAHE, Otsu und Unsharp Mask stehen bereit. Blockiert die Oberfläche, solange gerechnet wird.
- **OpenCV.js im Web Worker** — Oberfläche bleibt bedienbar; der Worker müsste die 13-MB-OpenCV-Datei ein zweites Mal laden und initialisieren, dazu kommt die Bildübergabe zwischen den Threads.

## Entscheidung

OpenCV.js auf dem Haupt-Thread, gekapselt in `core/image-filters.ts` (`renderFiltered`). Vorschauen werden verkleinert gerechnet (`maxEdge`), die volle Auflösung nur beim Übernehmen einer Seite. Ein `MatScope` pro Aufruf gibt alle OpenCV-Objekte im `finally` frei. Das Bild läuft ab dem Filter als RGB oder Grau weiter, nie als RGBA — sonst würden Kontrast und Helligkeit den Alphakanal mitverschieben und das JPEG dunkel einfärben.

## Konsequenzen

- Während des Voll-Renderns ist die Oberfläche kurz eingefroren. Der Filter-Bildschirm zeigt deshalb einen Zustand „Speichert …“ (Phase 8).
- Gemessen auf dem Entwicklungsrechner (Node, dieselbe WebAssembly-Datei, 4000 × 3000 px): Original ~0,1 s, Grau ~0,2 s, S/W ~0,4 s, Scan ~0,8 s, Auto ~2,1 s. Auf dem Handy entsprechend langsamer; „Auto“ ist der teuerste Look, weil er in Farbe arbeitet.
- Der WebAssembly-Speicher wächst beim ersten Vollbild-Lauf und gibt nichts an den Browser zurück — 20 Läufe hintereinander lassen ihn danach aber nicht weiter wachsen.
