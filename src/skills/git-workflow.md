# Git Workflow

## Commit conventions (Conventional Commits):
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code change that neither fixes nor adds
- `docs:` — Documentation only
- `test:` — Adding/updating tests
- `chore:` — Maintenance tasks
- `perf:` — Performance improvement
- `style:` — Formatting, missing semicolons
- `ci:` — CI/CD changes

## Best practices:
- Commit early, commit often — small atomic commits
- Write descriptive commit messages: `feat: add user authentication with JWT`
- Use branches: `feature/xxx`, `fix/xxx`, `refactor/xxx`
- Always check `git status` and `git diff --staged` before committing
- Never commit secrets, .env files, or node_modules

## Common workflows:
```bash
# Feature branch workflow
git checkout -b feature/new-feature
# ... make changes ...
git add -A
git commit -m "feat: implement new feature"
git push origin feature/new-feature

# Quick fix on main
git stash
git checkout main
git pull
# ... fix ...
git commit -am "fix: resolve critical bug"
git push
git checkout -
git stash pop

# Undo last commit (keep changes)
git reset --soft HEAD~1

# See what changed in a file
git log -p --follow -- path/to/file
```
