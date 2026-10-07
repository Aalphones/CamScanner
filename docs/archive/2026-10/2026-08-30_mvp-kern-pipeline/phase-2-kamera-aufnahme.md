# Phase 2 — Kamera & Aufnahme

**Rating:** standard — bekannte Web-API, keine offenen Entscheidungen.

Ergebnis dieser Phase: Der Sucher zeigt das Kamerabild, ein Druck auf den
Auslöser legt ein Standbild in voller Auflösung in die Sitzung und wechselt auf
`/crop` (dort steht in dieser Phase noch ein Platzhalter).

## Kontext — vorher lesen

- `docs/conventions/angular.md` — besonders Critical Rules 1, 4, 6
- `README.md` dieses Plans — Kontrakt-Sektion (`ScanSessionService`)
- `src/app/core/scan-session.ts` (aus Phase 1)

## Entscheidungen (nicht neu verhandeln)

- Das Standbild kommt aus `createImageBitmap(videoElement)` — **nicht** über
  `ImageCapture.takePhoto()`, das gibt es in zu wenigen Browsern.
- Kamera-Wunsch: `{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false }`.
  „ideal" statt „exact", damit ein Laptop mit Frontkamera nicht komplett
  scheitert.
- Der Zustand der Kamera ist ein Signal mit genau diesen Werten:
  `'idle' | 'starting' | 'running' | 'denied' | 'insecure' | 'unavailable'`.
  Als const-asserted Union in `camera.ts`, keine losen Strings.

## Abnahme-Kriterien

- Auf `localhost` bzw. über HTTPS erscheint das Live-Bild formatfüllend
  (`object-fit: cover`), ohne schwarze Balken, in Hoch- und Querformat.
- Der Auslöser ist ein Kreis von 72 px Durchmesser, unten mittig, mit
  mindestens 24 px Abstand zum unteren Rand.
- Kamera abgelehnt → statt Video ein zentrierter Text: „Ohne Kamera-Erlaubnis
  kann nichts gescannt werden. Erlaubnis im Browser-Menü neben der Adresszeile
  freigeben und die Seite neu laden." Dazu ein Knopf „Nochmal versuchen".
- Aufruf über unsicheres HTTP → Text: „Die Kamera funktioniert nur über eine
  verschlüsselte Verbindung (https)." Kein Auslöser sichtbar.
- Nach dem Auslösen liegt in `scanSession.sourceFrame()` ein `ImageBitmap` mit
  den echten Kamera-Maßen (nicht den CSS-Maßen des Video-Elements), und der
  Kamera-Stream ist gestoppt (alle Tracks `stop()`).

## Checkliste

- [x] `ng generate service core/camera` → `src/app/core/camera.ts`
      - `state: Signal<CameraState>` (Union oben)
      - `start(video: HTMLVideoElement): Promise<void>` — prüft zuerst
        `window.isSecureContext` (falsch → `'insecure'`, kein `getUserMedia`),
        dann ob `navigator.mediaDevices` existiert (fehlt → `'unavailable'`),
        fängt `NotAllowedError` → `'denied'`, alles andere → `'unavailable'`
      - `captureFrame(video: HTMLVideoElement): Promise<ImageBitmap>`
      - `stop(): void` — alle Tracks stoppen, `srcObject` leeren
      - Kein `navigator`-Zugriff außerhalb dieses Service (Regel 6 der
        Angular-Conventions)
- [x] `ng generate component features/capture` → `capture.ts/.html/.scss`
      - `ChangeDetectionStrategy.OnPush`, `inject()`
      - `<video autoplay playsinline muted>` — `playsinline` ist auf iOS
        zwingend, sonst öffnet Safari den Vollbild-Player
      - `start()` in `ngOnInit`, `stop()` in `ngOnDestroy`
      - Auslöser-Klick: `captureFrame()` → `scanSession.setSourceFrame(...)` →
        `stop()` → `router.navigate(['/crop'])`
      - Während der Aufnahme ist der Auslöser deaktiviert (schützt vor Doppel-Tap)
- [x] Layout in `capture.scss`, BEM-Klassen: `.capture`, `.capture__video`,
      `.capture__shutter`, `.capture__hint`. `:host` direkt stylen, kein
      Wrapper-Element.
- [x] Erst-Nutzer-Hinweis über dem Bild, dezent und einzeilig: „Dokument
      formatfüllend ins Bild halten". Bleibt dauerhaft stehen — er kostet nichts
      und beantwortet die einzige offene Frage dieses Bildschirms.
- [x] Route `capture` in `app.routes.ts` scharf schalten.

## Doc-Updates

- [x] `docs/code-map.md`: Feature-Zeile `capture` + `core/camera.ts`

## Report-Back

**Spec-Dateien entfernt:** `ng generate` legt standardmäßig `.spec.ts` an;
`docs/conventions/testing.md` schreibt für Kamera-/Component-Code explizit
keine Tests vor (nur `core/geometry.ts` bekommt welche) — `camera.spec.ts`
und `capture.spec.ts` direkt nach dem Generieren gelöscht, konsistent mit
Phase 1 (dort auch keine Specs neben `opencv-loader.ts`/`scan-session.ts`).

**Unsicherste Stelle:** `capture.html` — die vier Zustände (`running`,
`denied`, `insecure`, `unavailable`) sind über `@switch` auf `state()`
geschaltet, das Video-Element selbst bleibt aber immer im DOM (nur der
Zustand darüber wechselt), damit `viewChild.required('video')` nicht ins
Leere greift, sobald z. B. „Nochmal versuchen" nach `denied` zurück auf
`running` wechselt. Auf echtem Gerät ungeprüft (kein Kamera-Zugriff hier) —
Smoke-Checkliste-Punkt 4 deckt genau das ab.
