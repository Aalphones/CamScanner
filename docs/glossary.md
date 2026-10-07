# Glossar — CamScanner

Ein Begriff = eine Bedeutung. Neu abgeklärte Fachbegriffe hier ergänzen, nicht
stillschweigend anders verwenden.

| Begriff | Bedeutung |
|---|---|
| **Page** | Eine gescannte, bereits zugeschnittene/korrigierte Dokumentseite im Page Buffer (`pages[]`), bevor sie ins PDF eingebettet wird |
| **Design-Token** | Benannte Farbe oder Größe aus dem Mockup als CSS-Variable `--cam-*` (z. B. `--cam-accent`); alle Styles verwenden nur diese Namen |
| **Page Buffer** | In-Memory-Sammlung aller bisher gescannten Seiten der aktuellen Session |
| **Perspektivkorrektur / Warp** | Mathematische Entzerrung eines schräg fotografierten Dokuments auf ein rechteckiges Bild, anhand der 4 erkannten Eckpunkte |
| **Quad** | Die vier Eckpunkte eines erkannten Dokuments, **immer** in der Reihenfolge oben-links, oben-rechts, unten-rechts, unten-links, in Pixeln des Quell-Standbilds (Typ `Quad` in `core/geometry.ts`, festgelegt in ADR-003) |
| **Kantenerkennungs-Schwellwerte** | Das Zahlenpaar für Canny (aktuell 75/200): unterhalb des kleinen Werts zählt ein Helligkeitssprung nicht als Kante, oberhalb des großen sicher — dazwischen nur, wenn er an einer starken Kante hängt. Die Stellschrauben beim Feldtest |
| **Scan-Look** | Bildoptimierung, die ein Handyfoto wie einen klassischen Flachbett-Scan aussehen lässt (hoher Kontrast, oft S/W) |
| **Adaptive Threshold** | Schwellwert-Verfahren, das Hell/Dunkel lokal statt global bewertet — robuster bei ungleichmäßiger Beleuchtung als ein fester Schwellwert |
| **CLAHE** | Contrast Limited Adaptive Histogram Equalization — Kontrastverstärkung, die pro Bildregion arbeitet statt global |
| **Sauvola / Niblack** | Binarisierungsverfahren (Text vs. Hintergrund), die lokale Statistik nutzen — genauer als Otsu bei ungleicher Ausleuchtung |
| **Otsu** | Automatische Schwellwert-Berechnung für ein sauberes Schwarz/Weiß-Bild, wenn die Beleuchtung gleichmäßig ist |
| **Unsharp Mask** | Klassischer Schärfungsfilter (Original minus geglättete Kopie, verstärkt zurückaddiert) |
| **Background Division** | Schatten-/Beleuchtungskorrektur: Bild durch eine stark geblurrte Kopie seiner selbst teilen, um Helligkeitsgradienten rauszurechnen |
| **ONNX / ONNX Runtime Web** | Austauschformat für trainierte ML-Modelle bzw. die Laufzeit, die solche Modelle direkt im Browser (WASM/WebGPU) ausführt — kein Server nötig |
| **DocAligner** | ONNX-Modell zur Eckpunkterkennung eines Dokuments, geplanter Fallback falls die klassische OpenCV-Kontur-Erkennung versagt |
| **DocShadow** | ONNX-Modell zur Entfernung von Schlagschatten/Beleuchtungsgradienten auf Fotos |
| **NCHW** | Tensor-Layout (Batch, Channels, Height, Width), das die meisten Bild-ML-Modelle als Input erwarten |
| **WebGPU** | Browser-API für GPU-beschleunigte Berechnungen — schnellster Ausführungspfad für ONNX Runtime Web, mit WASM als Fallback |
| **Cross-Origin-Isolation** (COOP/COEP) | Header-Paar, das ein Browser-Feature (hier: WASM-Multithreading) freischaltet — ohne die Header fällt ORT auf Single-Thread zurück |
| **Web Share API** | Browser-API, die das native Teilen-Menü des Betriebssystems öffnet (z. B. Android Share Sheet) |
| **Secure Context** | Bedingung, unter der sicherheitskritische APIs (u. a. `getUserMedia`) überhaupt verfügbar sind: HTTPS oder `localhost` |
