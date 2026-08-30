# 003 — Kantenerkennung auf verkleinerter Kopie, Zustands-Übergabe über einen Signal-Service

**Status:** Akzeptiert
**Datum:** 2026-08-30

## Kontext

Zwei Fragen fielen in derselben Phase an: Auf welchem Bild läuft die
Dokumenterkennung, und wie kommt das Ergebnis von einem Bildschirm zum
nächsten (`/capture` → `/crop` → `/result`)?

Ein Handy-Standbild hat leicht 12 Megapixel. OpenCV.js arbeitet in
WebAssembly ohne automatische Speicherbereinigung; jede Zwischenstufe der
Pipeline (Graustufen, Weichzeichner, Kantenbild) belegt noch einmal so viel.

## Entscheidung

**1. Erkennung auf einer verkleinerten Kopie.** `detect()` zeichnet das
Standbild über ein `OffscreenCanvas` auf maximal 1024 px lange Kante herunter
und sucht darauf. Die gefundenen Ecken werden mit dem Kehrwert des
Verkleinerungsfaktors auf Original-Koordinaten hochgerechnet. Das Begradigen
(Phase 4) arbeitet auf dem Original — Auflösung geht nicht verloren.

**2. Ecken-Reihenfolge ist projektweite Konvention.** Ein `Quad` ist immer
oben-links, oben-rechts, unten-rechts, unten-links, in Pixeln des
Quell-Standbilds. Jede Funktion, die Ecken liefert oder entgegennimmt, hält
sich daran; `sortQuadCorners()` ist die einzige Stelle, die sortiert.

**3. Zustands-Übergabe über `ScanSession` (Signals), nicht über Router-State.**

## Begründung

- **Verkleinern ist nicht nur schneller, sondern genauer:** Auf dem Original
  liefern Papierfasern, Druckraster und Textzeilen Hunderte konkurrierender
  Konturen. Auf der verkleinerten Kopie fällt dieses Rauschen weg, und die
  Blattkante bleibt als größte zusammenhängende Kontur übrig.
- **Router-State überlebt kein Neuladen** und ist nicht typisiert (`unknown`
  aus der History-API). Ein Signal-Service ist typsicher, im ganzen Baum
  lesbar und kann sein `ImageBitmap` in `reset()` sauber freigeben.
- Der Preis: Ein neu geladener Tab hat keinen Zustand mehr. Deshalb prüft
  jede Route außer `/capture` per Guard, ob der nötige Zustand da ist, und
  schickt sonst zurück in den Sucher (Phase 4).

## Konsequenzen

- Die Stellschrauben der Erkennung (Canny-Schwellwerte 75/200,
  `approxPolyDP`-Toleranz 2 % des Umfangs, Mindestfläche 20 % des Bildes,
  1024 px Arbeitskante) stehen als benannte Konstanten am Kopf von
  `core/document-detection.ts`. Sie werden beim Feldtest angefasst und dürfen
  nie als nackte Zahlen im Aufruf landen.
- **Speicher-Regel für alles, was OpenCV.js anfasst:** Jede `Mat` und jeder
  `MatVector` wird freigegeben. In `document-detection.ts` übernimmt das ein
  kleiner Ablagekorb (`MatScope`), den ein einziges `finally` leert — statt
  einer Kaskade verschachtelter `try`-Blöcke. Wer neue OpenCV-Services baut,
  übernimmt dieses Muster.
- `detect()` liefert `null`, wenn kein plausibles Viereck gefunden wurde.
  Kein Notbehelf mit erfundenen Punkten — der User korrigiert die Ecken in
  Phase 4 ohnehin von Hand.
- Der OpenCV-Lazy-Chunk entsteht erst, sobald ein Bildschirm
  `DocumentDetection` tatsächlich injiziert (Phase 4).
