# 009 — Aufnahme als echtes Foto per ImageCapture

**Status:** Akzeptiert
**Datum:** 2026-10-20

## Kontext

Der Auslöser hält bisher ein Bild aus dem laufenden Videostream fest (`createImageBitmap(video)`). Der Stream ist höchstens 4K (angefragt 3840 × 2160, oft weniger), durchläuft die Video-Rauschunterdrückung des Geräts, und der Autofokus arbeitet auf Video statt auf ein Einzelfoto hin. Die Filter-Pipeline ist auf bis zu 12 MP ausgelegt (ADR-006) — die Reserve liegt also vor ihr, in der Aufnahme.

## Optionen

- **Videobild lassen** — schnell und überall verfügbar, aber Video-Auflösung und Video-Verarbeitung.
- **`ImageCapture.takePhoto` mit Rückfall aufs Videobild** — echtes Foto über die Foto-Pipeline der Kamera, wo der Browser es kann.
- **Video-Auflösung hochdrehen** — mehr als 4K liefern die Geräte im Stream nicht; die Video-Verarbeitung bleibt.

## Entscheidung

`ImageCapture.takePhoto` mit der größten Foto-Auflösung bis 12 MP (`PHOTO_MAX_PIXELS`); meldet das Gerät mehr, wird kleiner angefragt, und ignoriert es die Anfrage, wird nach dem Dekodieren verkleinert (Toleranz 5 % für gerundete Größen). Antwortet `takePhoto` nicht binnen 5 s, zählt das Videobild; ein spät eintreffendes Foto wird verworfen. Bei eingeschalteter Taschenlampe gilt immer das Videobild — ob `takePhoto` die Dauerleuchte anlässt, ist ungeprüft. Das Foto wird gemäß EXIF aufrecht gedreht. Rückfall: fünf Videobilder im Abstand von 60 ms, das schärfste nach Varianz des Laplace-Bilds der Bildmitte (`core/sharpness.ts`).

## Konsequenzen

- Nur Chromium-Browser haben `ImageCapture`; Safari und Firefox nehmen den Rückfall aufs Videobild.
- Das Foto hat oft 4:3 statt des 16:9-Sucherausschnitts — auf dem Zuschneiden-Bildschirm ist mehr Umgebung zu sehen als im Sucher.
- Auslösen dauert länger als ein Griff ins Videobild; im schlimmsten Fall 5 s bis zum Rückfall.
- `captureFrame` muss vor `Camera.stop()` laufen: `takePhoto` braucht den laufenden Track.
- Die Konsole meldet je Aufnahme `Camera: Foto W × H` oder `Fotoaufnahme nicht möglich, nehme das Videobild` — der Prüfpunkt am Gerät.
