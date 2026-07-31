# Commit Conventions — CamScanner

## Stack

| Layer | Choice |
|---|---|
| Format | Conventional Commits |
| Branch-Modell | Solo-Projekt: direkt auf dem Default-Branch (`main`) |

## Format

```
<type>(<scope>): <summary>

<optional body — erklärt das Warum, nicht das Was>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci`.

## Regeln

- Commit-Message erklärt das **Warum**, nicht nur das Was (der Diff zeigt das
  Was bereits)
- **Tidy First:** Refactoring und Verhaltensänderung nie im selben Commit —
  ein Refactor-Commit lässt bestehende Tests unverändert grün, ein
  Feature/Fix-Commit bringt neue/geänderte Tests mit
- Keine Secrets committen (`.env`, `*token*`, `*.pem`, Credentials)
- Kein Force-Push, kein `--amend` auf bereits gepushte Commits, kein
  `git reset --hard` ohne vorherige Prüfung des Arbeitsstands

## Critical Rules

1. **Direkt auf `main`** — kein Feature-Branch-Zwang für ein Solo-Projekt.
   Branch nur, wenn ein Experiment bewusst isoliert werden soll.
2. **Keine KI-Attributions-Zeile** in Commit-Messages (kein
   `Co-Authored-By: …`-Footer o. ä.).
