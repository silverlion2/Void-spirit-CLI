# Refactoring Patterns

## When to refactor:
- Before adding a new feature to existing code
- When fixing a bug reveals tangled logic
- When code is hard to understand or test
- When there's copy-pasted logic

## Common refactoring moves:
1. **Extract Function** — Pull logic into a named function
2. **Extract Variable** — Name complex expressions
3. **Inline** — Remove unnecessary indirection
4. **Rename** — Make names reveal intent
5. **Move** — Put code where it belongs (right module/file)
6. **Replace Conditional with Polymorphism** — OOP pattern for switch statements
7. **Introduce Parameter Object** — Group related parameters
8. **Replace Magic Numbers** — Named constants
9. **Decompose Conditional** — Extract complex if/else into named functions
10. **Consolidate Duplicate Conditional Fragments** — Move common code out of branches

## Safety rules:
- Always read the file before editing
- Make one refactoring at a time
- Run tests after each change
- Use git to checkpoint: commit before refactoring
- If no tests exist, write them first

## Architecture patterns:
- **Separation of concerns**: UI | Business Logic | Data Access
- **Single responsibility**: Each function/class does one thing
- **Dependency inversion**: Depend on abstractions, not concretions
- **Interface segregation**: Small, focused interfaces
