# Code Review & Quality

## When reviewing code, always check:
- **Logic errors**: Off-by-one, null/undefined handling, race conditions
- **Security**: SQL injection, XSS, path traversal, hardcoded secrets, insecure crypto
- **Performance**: N+1 queries, unnecessary re-renders, memory leaks, large bundle imports
- **Error handling**: Missing try/catch, unhandled promise rejections, generic error messages
- **Naming**: Variables/functions should reveal intent, avoid abbreviations
- **DRY**: Extract repeated logic into helpers
- **Types**: Ensure type safety, avoid `any` in TypeScript
- **Edge cases**: Empty arrays, null inputs, concurrent access, network failures

## Code smell patterns to flag:
- Functions > 30 lines → suggest extraction
- > 3 parameters → suggest options object
- Nested callbacks > 2 levels → suggest async/await
- Magic numbers → suggest named constants
- Boolean parameters → suggest enum or options
- Commented-out code → suggest removal
