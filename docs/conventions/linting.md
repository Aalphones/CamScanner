# Linting & Formatting Conventions — CamScanner

> **Source-of-truth references:**
> - `eslint.config.js` (angular-eslint, projekt-lokal)
> - `.prettierrc` (projekt-lokal)

## Stack

| Layer | Choice |
|---|---|
| Linter | `angular-eslint` (`ng lint` / `npm run lint`) |
| Formatter | Prettier (`printWidth: 100`, `singleQuote: true`, HTML-Parser `angular`) |

## Regeln

- `npm run lint` muss vor jedem Commit sauber durchlaufen — kein
  `--no-verify`, kein Ignorieren einzelner Regeln ohne Kommentar warum
- Prettier ist die einzige Formatierungsquelle — keine manuelle
  Abweichung vom konfigurierten Stil
- Selector-Prefix-Regel (`cam`) ist scharf gestellt — neue Komponenten ohne
  `cam-`-Präfix schlagen fehl (siehe `docs/conventions/angular.md`)

## Critical Rules

1. **Lint-Fehler werden gefixt, nicht unterdrückt** — `eslint-disable` nur mit
   Begründungskommentar direkt daneben, nie pauschal für eine ganze Datei.
