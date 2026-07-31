# TypeScript Conventions — CamScanner

This file is the single source of truth for TypeScript conventions in this
project.

## Stack

| Layer | Choice |
|---|---|
| TypeScript | ~6.0 |
| Strict Mode | `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `exactOptionalPropertyTypes` — alle aktiv in `tsconfig.json` |
| Module | ESM (`"module": "preserve"`, Angular-Default) |

## Regeln

- Explizite Typen auf Funktionsparametern, Rückgabewerten **und** Lambda-/Callback-Parametern
- `unknown` statt `any`; nie `as any` — wenn ein Escape-Hatch nötig ist:
  `as unknown as T` mit Kommentar warum
- Diskriminierte Unions statt Magic Strings (z. B. Page-Status, Export-Status)
- Const-asserted Unions statt `enum`
- Kein `!` Non-Null-Assertion — narrow mit Type Guard
- `import type` für reine Typ-Importe

## Projekt-spezifisch

- **Bildverarbeitungs-Grenzen typisieren:** Alle Funktionen, die mit
  OpenCV.js/Canvas/ONNX-Tensoren arbeiten, bekommen explizite Domain-Typen
  (`DocumentCorners`, `PageImage`, …) statt roher `any`/`Mat`-Durchreichung —
  OpenCV.js selbst ist schwach typisiert, das ist kein Grund, es im
  restlichen Code durchsickern zu lassen.
- **`unknown` an der OpenCV/ONNX-Grenze narrowen**, nicht `any` — die
  Drittbibliotheken liefern oft lose typisierte Rückgaben.

## Critical Rules

1. **Keine `any`-Durchreichung über Modul-Grenzen** — auch nicht für
   OpenCV.js/onnxruntime-web-Interop. Ein dünner typisierter Wrapper-Service
   ist die Grenze, dahinter bleibt der Code sauber typisiert.
2. **`noUncheckedIndexedAccess` ernst nehmen** beim Page-Buffer-Array-Zugriff
   (`pages[i]` ist `Page | undefined`) — kein stillschweigendes `pages[i]!`.
