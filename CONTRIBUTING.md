# Contributing to Void Spirit

Thanks for your interest! Void Spirit is an open-source AI coding assistant and contributions are welcome.

## Quick Start

```bash
git clone https://github.com/silverlion2/void-spirit-cli.git
cd void-spirit-cli
npm install
node src/index.js
```

## How to Contribute

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/my-feature`
3. **Make your changes** and test them locally
4. **Commit**: `git commit -m "feat: add my feature"`
5. **Push**: `git push origin feature/my-feature`
6. **Open a Pull Request**

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `refactor:` — Code change that neither fixes a bug nor adds a feature

## Adding a New Provider

1. Create `src/providers/your-provider.js`
2. Export a function matching the existing interface
3. Register it in `src/providers/index.js`
4. Update the README provider table

## Adding a New Tool

1. Add the tool definition in `src/tools/definitions.js`
2. Add the handler in `src/tools/executor.js`
3. Update the README tools section

## Reporting Issues

- Use GitHub Issues
- Include your Node.js version, OS, and provider being used
- Include steps to reproduce

## Code of Conduct

Be respectful. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).
