# Testing Patterns

## Test generation rules:
- Test the happy path first, then edge cases
- Test error handling: invalid inputs, missing data, network failures
- Test boundaries: empty arrays, max values, zero, negative numbers
- One assertion per test when possible
- Descriptive test names: `should return 404 when user not found`

## Test structure (Arrange-Act-Assert):
```javascript
test('should calculate total with discount', () => {
  // Arrange
  const items = [{ price: 100 }, { price: 50 }];
  const discount = 0.1;

  // Act
  const total = calculateTotal(items, discount);

  // Assert
  expect(total).toBe(135);
});
```

## What to test:
- **Unit**: Pure functions, utilities, transformations, validators
- **Integration**: API endpoints, database queries, service interactions
- **E2E**: Critical user workflows (login, checkout, signup)

## Testing tools by ecosystem:
- **JavaScript**: Jest, Vitest, Mocha, Playwright, Cypress
- **Python**: pytest, unittest, httpx (async)
- **Go**: testing package, testify
- **Rust**: built-in #[test], cargo test

## Mock patterns:
- Mock external APIs and databases
- Don't mock what you own — test real implementations
- Use dependency injection for testability
