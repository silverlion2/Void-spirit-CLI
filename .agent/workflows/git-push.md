---
description: How to commit and push code to GitHub (PowerShell-safe)
---

# Git Push Workflow

// turbo-all

Use semicolons (`;`) instead of `&&` for chaining commands — PowerShell doesn't support `&&` in older versions.

## Steps

1. Stage all changes:
```bash
git add -A
```

2. Check what's staged:
```bash
git status
```

3. Commit with a conventional commit message:
```bash
git commit -m "feat: description of change"
```

Commit prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`

4. Push to remote:
```bash
git push
```

## Chaining (PowerShell-safe)

To do it all in one line, use **semicolons** — NOT `&&`:

```powershell
git add -A; git commit -m "feat: description"; git push
```

> ⚠️ **Never use `&&`** in PowerShell. It will fail with:
> `The token '&&' is not a valid statement separator in this version.`

## First push to a new branch

```bash
git push -u origin main
```

## Tagging a release

```bash
git tag v1.0.0; git push --tags
```
