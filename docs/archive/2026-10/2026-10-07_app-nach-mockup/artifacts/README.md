# Design-Artefakte

| Datei | Inhalt | Phasen |
|---|---|---|
| `camscanner-mockup.html` | Alle sechs Bildschirme nebeneinander in Telefonrahmen, dazu die Token-Leiste und Notizen | alle UI-Phasen |

Bildschirme im Mockup (Reihenfolge wie dort, Überschrift der jeweiligen Figur):

| Nr. im Mockup | Bildschirm | Route | Phase |
|---|---|---|---|
| 1 | Scannen | `/capture` | 2, Leiste unten in 6, Live-Rahmen in 5 |
| 2 | Zuschneiden | `/crop` | 3 |
| 3 | Filter („Scan-Look“) | `/filter` | 8, Schalter „Schatten entfernen“ in 11 |
| 4 | Seitenübersicht | `/pages` | 6 |
| 5 | Export | `/export` | 4, „Teilen“ in 10 |
| 6 | Fehlerzustand „Kamera ist gesperrt“ | Teil von `/capture` | 2 |

## Ansehen

Offline: Datei im Browser öffnen (keine externen Abhängigkeiten, ein eingebettetes Skript schaltet die Filter-Chips um). Die Abnahme-Fassung lag beim User unter `C:\Users\sasch\.verwalter\workspaces\e3c23602\.artefakte\camscanner-mockup.html`; diese Kopie hier ist die maßgebliche.

## Design-System

Kein externes Design-System. Die Werte stehen als CSS-Variablen im `:root` des Mockups und als Token-Tabelle in der Plan-README; Phase 1 überträgt sie nach `src/styles/_tokens.scss`.

## Platzhalter

- `.paper`, `.stamp`, die linierten Papier-Attrappen: stehen für echte Kamerabilder bzw. Seiten.
- `.status` („9:41 ●●● 5G“) und `.phone`: Telefonrahmen, nicht Teil der App.
- Zahlen wie „4 Seiten“, „ca. 1,8 MB“, „Scan_2026-10-07.pdf“, Slider-Stellungen 62 % / 48 %: Beispielwerte.
- „Lädt KI-Modell · einmalig ca. 25 MB“: Größe ist geschätzt, Phase 11 setzt den gemessenen Wert ein.
- Der Kamera-Hintergrund (`.cam`-Verlauf) steht für das Live-Bild.

## Neu erzeugen

Handgeschriebene HTML-Datei, nichts zu erzeugen.
