# Phase 4 — Export: PDF & Herunterladen

**Rating:** standard — `pdf-lib` nach Anleitung, ein Bildschirm nach Mockup, ein Toast-Baustein.

Ergebnis: `/export` sieht aus wie Mockup-Figur 5 (ohne „Teilen“, das kommt in Phase 10). Das begradigte Blatt wird als PDF in wählbarer Qualität heruntergeladen. Meilenstein 1 ist damit Ende-zu-Ende benutzbar: Scannen → Zuschneiden → Exportieren.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`buildPdf`, `PdfPageInput`, `ExportQuality`, `downloadBlob`, `sanitizePdfFileName`, `Toast`)
- `artifacts/camscanner-mockup.html` — Figur 5 „Export“; Klassen `.pdfstack`, `.meta`, `.field`, `.seg`, `.seglabel`, `.actions`, `.privacy`
- `src/app/core/scan-session.ts`, `src/app/core/scan-flow.guards.ts`, `src/app/app.routes.ts`, `src/styles/_toast.scss`
- `docs/PROJECT.md` — Nicht-Ziele (nichts verlässt das Gerät)
- Vault-Fehlerklassen: `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Seitenformat A4 hochkant** (595 × 842 pt). Bild unter Wahrung des Seitenverhältnisses größtmöglich eingepasst und zentriert, Rest weiß. Drehung über `page.setRotation(degrees(rotation))` — die Seite wird als Ganzes gedreht angezeigt, das Bild bleibt unverändert eingebettet.
- **Qualitätsstufen:** `small` = längste Kante höchstens 1240 px, JPEG 0.7 · `medium` (Standard) = höchstens 2000 px, JPEG 0.8 · `original` = das vorhandene JPEG unverändert einbetten. Verkleinern über `createImageBitmap(blob)` → `OffscreenCanvas` → `convertToBlob`. Nie vergrößern.
- **Eingebettet als JPEG** (`embedJpg`), `pdf-lib` per dynamischem `import()`, damit es nicht im Start-Bundle liegt.
- **PDF wird vorab gebaut:** beim Betreten und bei jedem Qualitätswechsel; die Größenangabe ist die echte Dateigröße. Grund: ehrliche Angabe, und Phase 10 braucht den fertigen Blob beim Antippen (sonst verfällt die Nutzer-Geste fürs Teilen).
- **Dateiname:** Standard `Scan_YYYY-MM-DD.pdf` (lokales Datum). `sanitizePdfFileName`: trimmen, `\ / : * ? " < > |` durch `_` ersetzen, `.pdf` anhängen, wenn es fehlt (Groß-/Kleinschreibung egal), leer → Standardname.
- **Toast** als `core/toast.ts` (ein Toast zur Zeit, ein neuer ersetzt den alten, Standarddauer 3 s, mit Aktion 5 s) plus `shared/toast/toast.ts`, eingebunden einmal in `app.html` unter dem `<router-outlet />`.
- **Quelle der Seiten in dieser Phase:** genau eine Seite aus `scanSession.warpedPage()` mit Drehung 0. Phase 6 stellt auf den Page Buffer um.
- **Nach dem Herunterladen:** Toast „PDF gespeichert“ mit Aktion „Neues Dokument“ → `scanSession.reset()`, `/capture`.
- **Zurück-Pfeil** in dieser Phase → `/crop` (Ecken bleiben im Entwurf erhalten). Ab Phase 6 → `/pages`.
- **Erklärung zur Qualität:** kleines `info`-Icon hinter „Qualität“ (Button, `aria-label="Was bedeuten die Stufen?"`), antippen klappt eine Zeile in `--cam-muted` `.7rem` auf: „Klein: für Mail und Messenger · Mittel: gut lesbar · Original: volle Kamera-Auflösung, große Datei“.

## Struktur & Maße (Abnahme-Punkte, Mockup-Figur 5)

- Spalte über `100dvh`: Topbar (links `back`, Mitte „Exportieren“, rechts leerer Platzhalter 38 px), Seitenstapel, Meta-Zeile, Feld Dateiname, Qualität, Aktionen unten (`margin-top: auto`).
- Seitenstapel: Höhe 210 px; bis zu drei Vorschaubilder (die ersten drei Seiten, Seite 1 oben) 130 × 180 px, `object-fit: contain` auf `--cam-surface`-Grund mit Schatten `0 8px 24px #0009`, Radius 3 px; Lagen von unten nach oben: `rotate(-8deg) translateX(-26px)` Deckkraft .55 · `rotate(5deg) translateX(22px)` .8 · gerade 1. Bei einer Seite nur die oberste.
- Meta-Zeile: zentriert, `.75rem`, `--cam-muted`: „1 Seite · ca. 0,8 MB · A4“ bzw. „N Seiten · …“; während des Bauens „N Seiten · wird berechnet … · A4“. MB = Bytes / 1 048 576, eine Nachkommastelle, deutsches Komma (`Intl.NumberFormat('de-DE')`).
- Feld: Rand `1px solid --cam-line`, Hintergrund `--cam-surface`, Radius 12 px, Innenabstand `8px 12px`, Außenabstand `0 14px`; Beschriftung „DATEINAME“ (`.66rem`, Großbuchstaben, Sperrung `.06em`, `--cam-muted`), darunter ein randloses `<input>` `.9rem`.
- Qualität: Beschriftung „Qualität“ `.7rem` `--cam-muted` plus Info-Icon; Segment-Leiste drei gleich breite Felder „Klein · Mittel · Original“, Hintergrund `--cam-surface`, Radius 12, Innenabstand 3; aktives Feld `--cam-surface-2`, Text `--cam-text`, fett; als Radiogruppe (`role="radiogroup"`, Pfeiltasten wechseln).
- Aktionen: Innenabstand `14px 14px max(20px, env(safe-area-inset-bottom))`, Lücke 10 px. In dieser Phase nur `.btn.btn--primary.btn--block` „Herunterladen“ (deaktiviert, solange gebaut wird). Darunter Datenschutz-Zeile: `lock`-Icon 13 px in `--cam-accent`, „Bleibt auf deinem Gerät. Kein Upload.“, `.68rem`, `--cam-muted`.

## Abnahme-Kriterien

- Die Datei öffnet sich in einem beliebigen PDF-Betrachter, eine Seite A4 hochkant, Blatt vollständig und unverzerrt.
- Die drei Qualitätsstufen ergeben sichtbar unterschiedliche Dateigrößen; die Meta-Zeile zeigt jeweils die echte Größe.
- Ein eingetippter Name `Rechnung März` ergibt `Rechnung März.pdf`; `a/b` ergibt `a_b.pdf`; leeres Feld ergibt den Standardnamen.
- „Neues Dokument“ im Toast führt in den Sucher; ein zweiter Durchlauf funktioniert ohne Neuladen.
- Netzwerk-Tab: keine ausgehende Anfrage außer den App-Dateien.
- Neuladen auf `/export` landet im Sucher.

## Checkliste

- [x] `ng generate service core/pdf` → `ExportQuality`, `Rotation` (`0 | 90 | 180 | 270`), `PdfPageInput`, `buildPdf(pages, quality)` laut Entscheidungen; Konstanten `A4_WIDTH_PT = 595`, `A4_HEIGHT_PT = 842`, `QUALITY_PRESETS: Record<ExportQuality, { maxEdge: number; jpegQuality: number } | null>` (`original` = `null`).
- [x] `src/app/core/file-save.ts` — `downloadBlob` (temporäres `<a download>` über `inject(DOCUMENT)`, `URL.revokeObjectURL` im nächsten Tick per `setTimeout(…, 0)`) und `sanitizePdfFileName`.
- [x] `ng generate service core/toast` + `ng generate component shared/toast` nach Entscheidungen und `_toast.scss`; `role="status"`, `aria-live="polite"`.
- [x] `ng generate component features/export` nach „Struktur & Maße“. Signale: `fileName`, `quality` (Start `medium`), `pdf: Blob | null`, `building`. Ein `effect()` auf `quality` baut neu; ein laufender Bau, dessen Ergebnis nicht mehr zur aktuellen Qualität passt, wird verworfen (Zähler `buildToken`). Vorschau-URLs per `createObjectURL`, freigeben in `ngOnDestroy`.
- [x] `app.routes.ts`: Route `export` mit `canActivate: [draftWarpedGuard]`.

## Doc-Updates

- [x] `docs/code-map.md`: Feature-Zeile `export`; Core-Zeilen `pdf.ts`, `file-save.ts`, `toast.ts`; Shared `toast/`.
- [x] `docs/glossary.md`: „Qualitätsstufe“ (Klein/Mittel/Original mit den Werten aus dieser Phase).

## Report-Back

Status: complete. `npm run build`, `npm run lint`, `npm test` (9 Tests) grün. Geräte-/Browser-Prüfung der Abnahme-Kriterien steht beim User aus.

Abweichungen:
- `downloadBlob(blob, fileName, targetDocument = document)` nimmt das Dokument als dritten Parameter statt `inject(DOCUMENT)` — eine freie Funktion hat keinen Injektionskontext.
- Die Toast-Komponente heißt `ToastView` (der Service heißt schon `Toast`) und hat kein eigenes Stylesheet; `_toast.scss` ist global.
- `buildPdf` ist eine Methode des Services `Pdf`.
- `angular.json`: `pako` (Abhängigkeit von pdf-lib) in `allowedCommonJsDependencies`, sonst Build-Warnung.
- Ein Toast, der durch einen neuen ersetzt wird, ruft sein `onExpire` auf (für Phase 6: gelöschte Seite wird endgültig).
- Seitenstapel-Schräglage hängt an der Tiefe von oben (Seite 1 gerade, Seite 2 +5°, Seite 3 −8°), nicht an der DOM-Position — sonst stünde bei zwei Seiten die falsche Lage oben.
