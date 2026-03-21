# Project Scaffolding

## Quick-start commands by framework:

### JavaScript / TypeScript
```bash
# React + Vite
npx -y create-vite@latest ./ --template react-ts

# Next.js
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir

# Express API
npm init -y && npm i express cors dotenv

# Node CLI tool
npm init -y  # set "type": "module", add "bin" field
```

### Python
```bash
# FastAPI
pip install fastapi uvicorn
# Flask
pip install flask
# Django
pip install django && django-admin startproject myproject .
```

### Standard project structure (JS/TS):
```
project/
├── src/
│   ├── index.ts          # Entry point
│   ├── config/           # Configuration
│   ├── routes/ or pages/ # Routes
│   ├── services/         # Business logic
│   ├── utils/            # Helpers
│   └── types/            # Type definitions
├── tests/
├── public/               # Static assets
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Essential files to create:
1. `.gitignore` — node_modules, .env, dist, .DS_Store
2. `.env.example` — Document required env vars (without values)
3. `README.md` — Setup instructions, usage, API docs
4. `tsconfig.json` / `jsconfig.json` — Path aliases, strict mode
