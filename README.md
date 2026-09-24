# Domus - Property Management System

[![CI Pipeline](https://github.com/t0nigansel/domus/actions/workflows/ci.yml/badge.svg)](https://github.com/t0nigansel/domus/actions/workflows/ci.yml)
[![Nightly Tests](https://github.com/t0nigansel/domus/actions/workflows/nightly-agents.yml/badge.svg)](https://github.com/t0nigansel/domus/actions/workflows/nightly-agents.yml)
[![License](https://img.shields.io/badge/license-GPL%203.0-blue.svg)](LICENSE)

A property management application for small landlords: properties, tenants, issues, documents, costs and contacts.

> This project was previously hosted at `github.com/tonileet/domus` and is now maintained here.

## Architecture

| Part | Location | Tech |
|------|----------|------|
| Frontend | `src/` | React 19, React Router 7, Vite |
| API server | `server/` | Express, lowdb (JSON file storage), Swagger docs |
| Test agents | `agents/` | Node scripts that run lint, unit, E2E and API tests and write reports |

The frontend talks to the API at `http://localhost:3001/api` (see `src/utils/api.js`).
The API stores all data in `server/db.json`, seeded from `server/initialData.js` if the file doesn't exist.

## Quick Start

### Development

Start the API server and the frontend in two terminals:

```bash
# Terminal 1 - API server (http://localhost:3001, docs at /api-docs)
cd server
npm install
npm start

# Terminal 2 - frontend (http://localhost:5173)
npm install
npm run dev
```

Without the API server, the app shows "Error loading data".

### Testing

```bash
npm run lint          # ESLint
npm test              # Vitest (frontend unit tests and server API tests)
npm run test:e2e      # Playwright (install browsers first: npx playwright install)
npm run test:agents   # Run all test agents and write a report to test-results/
```

### Build

```bash
npm run build
npm run preview
```

## CI/CD

GitHub Actions workflows:

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request to `main`/`develop`: lint, unit tests with coverage, E2E tests and build.
- [`.github/workflows/nightly-agents.yml`](.github/workflows/nightly-agents.yml) runs all test agents at 02:00 UTC and opens a GitHub issue (label `nightly-test-failure`) when they fail.

To run the agent analysis on a push to another branch, include `[run-agents]` in the commit message.

## Data Privacy

This repository is public. Be careful where your real data ends up:

- **`server/db.json` is currently tracked by Git.** Everything you enter in the app is written to this file, so a `git commit -a` would publish your tenants' personal data. Don't enter real data until this file is removed from version control and added to `.gitignore`.
- `server/initialData.js` and `src/db/demoData.js` are committed and must only contain fictional demo data.
- Put backups and exports in `data/` (ignored by Git) or outside the project directory.
- Watch out for real tenant or property details in screenshots.
- The API server has no authentication. Only run it on a trusted machine.

## License

[GPL-3.0](LICENSE)
