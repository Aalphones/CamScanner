# Phase 10 — Teilen

**Rating:** standard — Web Share API mit Datei, Fallback ist schon gebaut.

Ergebnis: Der Export-Bildschirm hat „Teilen“ als Hauptaktion (Mockup-Figur 5). Auf Android öffnet es das Share-Sheet mit der PDF-Datei; Browser ohne Datei-Teilen sehen nur „Herunterladen“.

## Kontext — vorher lesen

- `README.md` dieses Plans — Kontrakt (`canShareFiles`, `sharePdf`)
- `artifacts/camscanner-mockup.html` — Figur 5, `.actions`
- `src/app/features/export/` (Stand nach Phase 6), `src/app/core/file-save.ts`, `src/app/core/toast.ts`
- `docs/concept.md` Kapitel 4.7
- Vault-Fehlerklassen: `sprachen/typescript.md` — geprüft, nichts einschlägig

## Entscheidungen (nicht neu verhandeln)

- **Erkennung:** `canShareFiles()` = `typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([new Blob()], 'probe.pdf', { type: 'application/pdf' })] })`. Einmal beim Betreten des Export-Bildschirms auswerten.
- **Teilen:** `navigator.share({ files: [new File([blob], fileName, { type: 'application/pdf' })], title: fileName })`. Ergebnis: Erfolg → `'shared'`; `DOMException` mit `name === 'AbortError'` → `'cancelled'` (kein Hinweis); alles andere → `'failed'`.
- **Nutzer-Geste:** `share()` wird synchron im Klick-Handler mit dem **bereits fertigen** PDF-Blob aufgerufen (Phase 4 baut vorab). Kein `await` vor dem `share()`-Aufruf im Handler — sonst verfällt die Geste und der Browser verweigert.
- **Knöpfe:** kann teilen → `.btn.btn--primary.btn--block` mit `share`-Icon „Teilen“, darunter `.btn.btn--block` „Herunterladen“. Kann nicht teilen → nur „Herunterladen“ als Primär-Knopf (Stand Phase 4). Beide deaktiviert, solange gebaut wird.
- **Rückmeldung:** `'shared'` → Toast „Geteilt“ mit Aktion „Neues Dokument“ (wie nach dem Herunterladen). `'failed'` → Toast „Teilen hat nicht geklappt — bitte Herunterladen nutzen“.
- `navigator` wird nur in `core/share.ts` angefasst (Critical Rule 6 der Angular-Konventionen).

## Abnahme-Kriterien

- Android Chrome: „Teilen“ öffnet das Share-Sheet; Google Drive oder Mail erhält eine PDF-Datei mit dem eingestellten Namen, die sich öffnen lässt.
- Abbrechen im Share-Sheet: kein Hinweis, Bildschirm unverändert.
- Desktop-Firefox (kein Datei-Teilen): nur „Herunterladen“ sichtbar, funktioniert wie bisher.
- Qualität wechseln, sofort „Teilen“: Knopf ist deaktiviert, bis das neue PDF fertig ist, danach klappt das Teilen ohne Fehlermeldung.

## Checkliste

- [x] `ng generate service core/share` laut Kontrakt und Entscheidungen.
- [x] `features/export`: Signal `canShare` beim Start; Knöpfe und Rückmeldungen laut Entscheidungen.

## Doc-Updates

- [x] `docs/code-map.md`: Core-Zeile `share.ts`.
- [x] `docs/glossary.md`: „Web Share API“ um die Regel „nur mit fertigem Blob im Klick-Handler“ ergänzen.

## Report-Back

Status: complete. Lint, Build und die 9 bestehenden Tests grün. `Share` ist ein Service mit den Methoden `canShareFiles()`/`sharePdf()` (README-Kontrakt führt sie als freie Funktionen, Services sind im Bestand der Weg). Geräteprüfung (Share-Sheet auf Android) steht beim User aus.
