# Debugging Methodology

## Systematic debugging steps:
1. **Reproduce** — Get exact error message, stack trace, steps to reproduce
2. **Isolate** — Binary search: narrow down which file/function/line causes the issue
3. **Read the error** — Parse stack traces, error codes, HTTP status codes carefully
4. **Check recent changes** — Use `git diff` and `git log` to find what changed
5. **Add logging** — Strategic console.log/print at key decision points
6. **Check assumptions** — Verify inputs, env vars, config values, API responses
7. **Search** — Look up error messages in docs, Stack Overflow, GitHub issues
8. **Fix & verify** — Make one change at a time, test immediately

## Common bug categories:
- **Async/timing**: Race conditions, missing await, stale closures
- **State**: Mutation bugs, stale state, wrong initialization
- **Types**: Implicit coercion, null vs undefined, string vs number
- **Environment**: Missing env vars, wrong paths, version mismatches
- **Network**: CORS, timeouts, wrong URLs, auth headers
- **Build**: Import errors, circular deps, missing transpilation

## Debug commands to try:
- `git log --oneline -10` — recent changes
- `git diff HEAD~1` — what changed last
- `npm ls <package>` — check dependency versions
- `node --inspect` — Chrome DevTools debugger
