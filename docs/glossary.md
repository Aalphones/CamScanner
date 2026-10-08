# Glossar — CamScanner

Ein Begriff = eine Bedeutung. Neu abgeklärte Fachbegriffe hier ergänzen, nicht
stillschweigend anders verwenden.

| Begriff | Bedeutung |
|---|---|
| **Page** | Eine gescannte Seite im Page Buffer (`ScannedPage`): Original-Standbild, Ecken, begradigtes und gefiltertes Bild (alle als JPEG), Filter-Einstellung, Drehung und Vorschaubild — genug, um sie später neu zuzuschneiden oder zu filtern (ADR-005) |
| **Auswahl-Modus** | Zustand der Seitenübersicht nach „Auswählen“: Antippen markiert Seiten statt sie zu öffnen, Ziehen und Löschen sind aus, „Drehen“ wirkt nur auf die markierten Seiten |
| **Design-Token** | Benannte Farbe oder Größe aus dem Mockup als CSS-Variable `--cam-*` (z. B. `--cam-accent`); alle Styles verwenden nur diese Namen |
| **Taschenlampe (torch)** | Dauerlicht der Rückkamera; nur auf Geräten, deren Video-Track es meldet (`getCapabilities().torch`), sonst fehlt der Knopf |
| **Entwurf (Draft)** | Die Seite in Arbeit zwischen Auslöser und Übernahme in den Page Buffer — Standbild, Ecken, begradigtes Bild, Filter —, gehalten von `ScanSession` |
| **Qualitätsstufe** | Wahl beim PDF-Export: *Klein* (längste Kante höchstens 1240 px, JPEG 0,7), *Mittel* (2000 px, JPEG 0,8, Standard), *Original* (das vorhandene JPEG unverändert). Verkleinert wird nur, nie vergrößert |
| **Page Buffer** | Alle Seiten des aktuellen Dokuments in ihrer Reihenfolge, nur im Arbeitsspeicher — ein Neuladen der App verliert den Stapel (ADR-005, `core/page-buffer.ts`) |
| **Perspektivkorrektur / Warp** | Mathematische Entzerrung eines schräg fotografierten Dokuments auf ein rechteckiges Bild, anhand der 4 erkannten Eckpunkte |
| **Quad** | Die vier Eckpunkte eines erkannten Dokuments, **immer** in der Reihenfolge oben-links, oben-rechts, unten-rechts, unten-links, in Pixeln des Quell-Standbilds (Typ `Quad` in `core/geometry.ts`, festgelegt in ADR-003) |
| **Live-Rahmen** | Erkennung auf dem laufenden Kamerabild im Sucher, höchstens 4 Läufe pro Sekunde auf einem 480-px-Vorschaubild; „stabil“ (Rahmen pulsiert, „Dokument erkannt — halten …“) nach drei Treffern in Folge, deren Ecken sich um weniger als 3 % der Bilddiagonale bewegen |
| **Kantenerkennungs-Schwellwerte** | Das Zahlenpaar für Canny (aktuell 75/200): unterhalb des kleinen Werts zählt ein Helligkeitssprung nicht als Kante, oberhalb des großen sicher — dazwischen nur, wenn er an einer starken Kante hängt. Die Stellschrauben beim Feldtest |
| **Scan-Look** | Bildoptimierung, die ein Handyfoto wie einen klassischen Flachbett-Scan aussehen lässt (hoher Kontrast, oft S/W). Zugleich der Name des Bildschirms `/filter` mit Vorschau, Filter-Chips und den Reglern „Kontrast“ und „Helligkeit“ (Doppeltippen auf die Beschriftung setzt auf 50 zurück) |
| **Adaptive Threshold** | Schwellwert-Verfahren, das Hell/Dunkel lokal statt global bewertet — robuster bei ungleichmäßiger Beleuchtung als ein fester Schwellwert |
| **CLAHE** | Contrast Limited Adaptive Histogram Equalization — Kontrastverstärkung, die pro Bildregion arbeitet statt global |
| **Sauvola / Niblack** | Binarisierungsverfahren (Text vs. Hintergrund), die lokale Statistik nutzen — genauer als Otsu bei ungleicher Ausleuchtung |
| **Otsu** | Automatische Schwellwert-Berechnung für ein sauberes Schwarz/Weiß-Bild, wenn die Beleuchtung gleichmäßig ist |
| **Unsharp Mask** | Klassischer Schärfungsfilter (Original minus geglättete Kopie, verstärkt zurückaddiert) |
| **Background Division** | Schatten-/Beleuchtungskorrektur: Bild durch eine Schätzung seiner Beleuchtung teilen, um Helligkeitsgradienten rauszurechnen. Konkret (`core/image-filters.ts`): Graubild auf ein Viertel verkleinern, Schriftstriche per morphologischem Schließen (Ellipse 9 × 9) mit Papierfarbe füllen, Median 21 glätten, zurück auf volle Größe, dann `Bild · 255 / Hintergrund` — Papier wird überall gleich hell |
| **Filter (Scan-Look)** | Die fünf wählbaren Looks einer Seite: *Original* (unverändert) · *Auto* (Farbe bleibt, nur die Helligkeit wird per Background Division und CLAHE ausgeglichen, leicht nachgeschärft) · *Scan* (Graustufen, Background Division, kräftigeres CLAHE und Nachschärfen) · *S/W* (Background Division, dann reines Schwarz-Weiß per Otsu) · *Grau* (Graustufen mit CLAHE, ohne Schattenkorrektur). Danach wirken Kontrast und Helligkeit, 50 = neutral |
| **ONNX / ONNX Runtime Web** | Austauschformat für trainierte ML-Modelle bzw. die Laufzeit, die solche Modelle direkt im Browser (WASM/WebGPU) ausführt — kein Server nötig |
| **DocAligner** | ONNX-Modell zur Eckpunkterkennung eines Dokuments, geplanter Fallback falls die klassische OpenCV-Kontur-Erkennung versagt |
| **DocShadow** | ONNX-Modell zur Entfernung von Schlagschatten/Beleuchtungsgradienten auf Fotos |
| **NCHW** | Tensor-Layout (Batch, Channels, Height, Width), das die meisten Bild-ML-Modelle als Input erwarten |
| **WebGPU** | Browser-API für GPU-beschleunigte Berechnungen — schnellster Ausführungspfad für ONNX Runtime Web, mit WASM als Fallback |
| **Cross-Origin-Isolation** (COOP/COEP) | Header-Paar, das ein Browser-Feature (hier: WASM-Multithreading) freischaltet — ohne die Header fällt ORT auf Single-Thread zurück |
| **Web Share API** | Browser-API, die das native Teilen-Menü des Betriebssystems öffnet (z. B. Android Share Sheet) |
| **Secure Context** | Bedingung, unter der sicherheitskritische APIs (u. a. `getUserMedia`) überhaupt verfügbar sind: HTTPS oder `localhost` |
