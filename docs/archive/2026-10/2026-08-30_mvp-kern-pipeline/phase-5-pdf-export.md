# Phase 5 — PDF-Export & Abschluss

**Rating:** standard — `pdf-lib` nach Anleitung, plus das Aufräumen der Doku.

Ergebnis: Der Bildschirm `/result` zeigt das begradigte Blatt, „Als PDF
sichern" legt eine Datei im Download-Ordner ab, „Neu aufnehmen" setzt die
Sitzung zurück.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`buildPdf`, `downloadBlob`)
- `src/app/core/scan-session.ts`
- `docs/PROJECT.md` — Nicht-Ziele (nichts verlässt das Gerät)

## Entscheidungen (nicht neu verhandeln)

- `buildPdf` nimmt **eine Liste** von Seiten entgegen, auch wenn in diesem
  Meilenstein immer genau eine drin liegt. Meilenstein 2 (Mehrseiten-Flow) soll
  den Service unverändert weiterbenutzen können.
- Seitenformat: A4 hochkant (595 x 842 Punkt). Das Bild wird unter Wahrung des
  Seitenverhältnisses größtmöglich eingepasst und zentriert; der Rest bleibt
  weiß. Begründung: ein PDF in Kamera-Pixelmaßen druckt sich unvorhersehbar.
- Eingebettet wird als JPEG (`embedJpg`) — das begradigte Bild liegt aus
  Phase 4 bereits als JPEG vor, ein Umweg über PNG würde die Datei vervierfachen.
- Dateiname: `scan-YYYY-MM-DD-HHmm.pdf` aus der lokalen Uhrzeit.

## Bildschirm-Struktur (freihändig, verbindlich als Abnahme-Punkt)

- Dunkler Hintergrund, das begradigte Blatt mittig als Vorschau eingepasst, mit
  dezentem Schlagschatten, damit die weiße Seite vom Hintergrund abgesetzt ist.
- Unten eine Leiste mit zwei Knöpfen: links „Neu aufnehmen", rechts „Als PDF
  sichern" (Primär-Aktion, farbig).
- Nach dem Sichern eine kurze Rückmeldung im Bildschirm („PDF gesichert"), die
  nach drei Sekunden verschwindet. Kein `alert()`.

## Abnahme-Kriterien

- Die erzeugte Datei öffnet sich in einem beliebigen PDF-Betrachter, hat genau
  eine Seite im A4-Hochformat, und das Blatt ist vollständig und unverzerrt
  sichtbar.
- „Neu aufnehmen" ruft `scanSession.reset()` und landet im Sucher; ein zweiter
  Durchlauf funktioniert ohne Neuladen der Seite.
- Der Netzwerk-Tab zeigt während des gesamten Ablaufs keine ausgehende Anfrage
  außer den Dateien der App selbst.
- `npm run build`, `npm run lint`, `npm test` sind sauber.

## Checkliste

- [ ] `ng generate service core/pdf` → `buildPdf(pages: readonly Blob[]): Promise<Blob>`
      - `PDFDocument.create()`, je Seite `embedJpg(await page.arrayBuffer())`,
        `addPage([595, 842])`, Einpass-Faktor
        `Math.min(595 / bildBreite, 842 / bildHoehe)`, zentriert zeichnen
      - Rückgabe: `new Blob([await doc.save()], { type: 'application/pdf' })`
      - `pdf-lib` per dynamischem `import()` laden, damit es nicht im
        Start-Bundle liegt
- [ ] `src/app/core/file-save.ts` — `downloadBlob(blob: Blob, fileName: string): void`
      über ein temporäres `<a download>` plus `URL.revokeObjectURL` danach
- [ ] `ng generate component features/result` → `result.ts/.html/.scss`,
      BEM-Klassen `.result`, `.result__preview`, `.result__actions`,
      `.result__toast`. Vorschau-URL aus `warpedPage()` per `createObjectURL`,
      im `ngOnDestroy` wieder freigeben.
- [ ] Route `result` scharf schalten (mit Guard aus Phase 4).
- [ ] Abschluss-Durchlauf: Sucher → Aufnahme → Ecken → PDF, zweimal
      hintereinander ohne Neuladen.

## Doc-Updates

- [ ] `docs/code-map.md`: Feature-Zeile `result`, `core/pdf.ts`,
      `core/file-save.ts` — Tabelle danach vollständig für Meilenstein 1
- [ ] `docs/glossary.md`: Eintrag „Page Buffer" auf den Stand bringen (in M1
      existiert nur eine Seite, der Service ist aber schon auf eine Liste
      ausgelegt)
- [ ] `STATE.md`: Plan als abgeschlossen markieren, Zeiger auf den nächsten
      Meilenstein oder „(kein aktiver Plan)"
- [ ] `AGENTS.md`: Quickstart prüfen — stimmt der Ablauf noch?

## Report-Back
