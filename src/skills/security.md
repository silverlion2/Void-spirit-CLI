# Security Best Practices

## Never do:
- Hardcode API keys, passwords, or secrets in code
- Use `eval()` or dynamic code execution with user input
- Trust user input without validation/sanitization
- Store passwords in plain text (use bcrypt/argon2)
- Use HTTP for sensitive data (always HTTPS)
- Expose stack traces or internal errors to users
- Use outdated dependencies with known CVEs

## Always do:
- Validate and sanitize all user inputs
- Use parameterized queries (prevent SQL injection)
- Escape HTML output (prevent XSS)
- Set proper CORS headers
- Use environment variables for secrets
- Implement rate limiting on APIs
- Use CSRF tokens for form submissions
- Set security headers: CSP, X-Frame-Options, HSTS

## Authentication checklist:
- Hash passwords with bcrypt (cost factor ≥ 12)
- Use JWT with short expiry + refresh tokens
- Implement account lockout after failed attempts
- Use HTTPS-only, HttpOnly, SameSite cookies
- Validate email/phone on signup

## Dependency security:
```bash
npm audit                    # Check for vulnerabilities
npm audit fix               # Auto-fix what's possible
npx npm-check-updates -u    # Update to latest versions
```
