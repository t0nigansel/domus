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

The frontend calls the API under the same origin at `/api` (see `src/utils/api.js`); in development and preview, Vite forwards these requests to the API server.
The API stores all data in `server/db.json`, seeded from `server/initialData.js` if the file doesn't exist.

Domus is planned as a multi-user SaaS on Cloudflare Workers, with managed PostgreSQL via Hyperdrive and private R2 file storage. The current application still uses local lowdb storage without authentication. See [SaaS-Umbauplan.md](SaaS-Umbauplan.md) for the implementation phases and closed-pilot release criteria.

## Quick Start

Requires Node.js 22 or newer. The repository uses npm workspaces (`server/` is a workspace), so one install covers everything.

### Development

```bash
npm install
cp .env.example .env   # optional, defaults work locally
npm run dev            # API on http://localhost:3001, app on http://localhost:5173
```

`npm run dev:web` and `npm run dev:api` start only one side. Without the API server, the app shows "Error loading data".

### Cloudflare deployment (infrastructure stage)

`wrangler.jsonc` targets the existing `domus-preview` Worker by default. Explicit
environments `preview` and `production` select `domus-preview` and `domus`, with
separate private EU R2 buckets bound as `FILES`. Deployments upload only the cloud
build under `dist-cloud/`, never local data directories or `server/db.json`.

```bash
npm run dev:cloud           # build and run locally with emulated storage
npm run test:cloud          # local Workers runtime, routing, R2 and auth checks
npm run deploy:preview     # deploy to domus-preview
npm run deploy:production  # deploy to domus
```

The cloud build currently shows a pilot preparation page. The separate Express
cloud entrypoint exposes `/api/health`; domain APIs return `503` until account
isolation and data migration are implemented. The local lowdb API is deliberately
not imported by the Worker. The existing local application remains available with
`npm run dev`.

Better Auth is wired for PostgreSQL, verified email/password login, database-backed
rate limits and an explicit pilot email allowlist. It stays disabled until all
required settings exist. Organization onboarding and domain data migration are
still pending; an enabled auth handler alone is not a usable SaaS release.

Required runtime secrets: `BETTER_AUTH_SECRET`, `PILOT_EMAILS`, `RESEND_API_KEY`,
`MAIL_FROM`. `BETTER_AUTH_URL` is configured separately per environment. Bind a
separate Hyperdrive configuration as `HYPERDRIVE` in each environment after creating
the PostgreSQL databases, with query caching disabled for protected data. Never
commit database credentials or provider keys to Wrangler configuration. Local
settings can be copied from `.dev.vars.example` to ignored `.dev.vars`.

Auth schema migration uses a separate administrative connection:

```bash
# Set DOMUS_MIGRATION_DATABASE_URL securely in your environment or ignored .env.
npm run db:migrate:auth             # print proposed SQL only
npm run db:migrate:auth -- --apply  # explicitly apply to that database
```

Do not run migrations inside Worker requests. Use a non-owner runtime database
role for future RLS-protected domain data. Cloudflare Builds can deploy the
`saas/phase-0` branch to `domus-preview` after lint, unit and cloud runtime checks;
the production Worker is deployed separately. See the SaaS plan for the live setup
status and remaining release gates.

### Database (from phase 1 of the rebuild)

PostgreSQL runs in Docker for local development (requires Docker Desktop):

```bash
npm run db:up     # start PostgreSQL on 127.0.0.1:5432 and wait until it's ready
npm run db:down   # stop it (data stays in the Docker volume)
```

## Wohnungsakte und Dateien

Die Wohnungsdetailseite enthält eine Wohnungsakte mit Adresse, Fläche, Zimmern,
Ausstattung und Energieangaben. Leere Zahlenfelder bleiben unbekannt. Vorhandene
Miet- und Belegungsdaten werden beim Speichern dieser Stammdaten nicht verändert.

Fotos, Grundrisse und Dokumente können auf der Wohnungsseite oder unter Documents
hochgeladen werden (PDF, DOC/DOCX, JPG, PNG, WebP; maximal 20 MB pro Datei).
Unter Documents lassen sich auch zunächst nicht zugeordnete Dateien nachträglich
einer Wohnung zuordnen. Beschreibung, Kategorie, Reihenfolge, Titelbild und
Freigabe für Inserate sind bearbeitbar. Neue Dateien sind standardmäßig intern.

Mit **Rohdaten einlesen** werden unterstützte Dateien aus `rohdaten/` angezeigt.
Der anschließende Import kopiert die ausgewählte Datei; Originale bleiben erhalten.
Identische Inhalte werden je Wohnung nur einmal importiert. Eine geänderte Datei
aus demselben Rohdatenpfad erhält eine neue Version. Die Quellenliste
`rohdaten/informationsquellen.md` wird in diesem ersten Ausbauschritt noch nicht
ausgewertet.

| Einstellung | Standard | Zweck |
| --- | --- | --- |
| `DOMUS_RAW_DIR` | `rohdaten/` im Projekt | Eingangsordner für manuelle Importe |
| `DOMUS_FILES_DIR` | `data/files/` im Projekt | Verwaltete Kopien der Dateien |

Dateimetadaten und Zuordnungen liegen in der bestehenden Datenbank. Für ein
vollständiges Backup die Datenbank **und** den verwalteten Dateiordner sichern.
`rohdaten/` und `data/` sind von Git ausgeschlossen. Bei extern konfigurierten
Speicherorten den gleichen Schutz sicherstellen. Der Dateiimport ist für die
bestehende lokale Einzelbenutzerinstallation vorgesehen.

Datei-Endpunkte: `GET /api/files/raw-files`, `POST /api/files/import`,
`POST /api/files/upload`, `GET /api/files/:id/content` und
`PUT /api/files/:id/metadata`. Uploads verwenden JSON mit Base64-Inhalt;
die Dateiinhalte selbst werden als Dateien außerhalb der JSON-Datenbank gespeichert.

## Vermietungen und Mietverhältnisse

Unter **Vermietungen** oder über die Wohnungsdetailseite lässt sich ein eigener
Vorgang für eine Neuvermietung anlegen. Konditionen und ein manueller Inseratentwurf
bleiben vom aktuellen Mietverhältnis getrennt. Bewerbungen können mehrere
Vertragsparteien enthalten; Besichtigungen haben Datum, Ortszeit, Status und Notizen.
Vorgänge können archiviert werden und bleiben anschließend lesbar.

Nach Auswahl einer Bewerbung lässt sich ein extern unterschriebener Vertrag aus
der Wohnungsakte zuordnen (Kategorie `Leases` / Mietverträge). Nach ausdrücklicher
Bestätigung legt der Abschluss genau ein Mietverhältnis an, auch bei wiederholtem
Klick oder einer wiederholten API-Anfrage. Nachrichtenversand, Veröffentlichung,
LLM-Funktionen und Vertragsgenerierung sind noch nicht Teil dieses Ausbauschritts.

Mietverhältnisse unterstützen mehrere Vertragsparteien, einen Mietbeginn und ein
optionales Ende. Das Enddatum ist der letzte Miettag. Zeiträume für dieselbe Wohnung
oder dieselbe Person dürfen sich nicht überschneiden. Geplante Mietverhältnisse
verändern weder die heutige Belegung noch die heutige Miete. Der Server berechnet
den Status beim Lesen anhand seines lokalen Datums; nach einem Datumswechsel die
Ansicht neu laden. Mietenden lassen sich in der Übersicht festlegen oder korrigieren.
Kontaktdaten bleiben unter Tenants bearbeitbar; bestätigte Vertragsparteien können
nicht über die bisherige Mieter-Löschfunktion aus der Historie entfernt werden.

Beim ersten Serverstart mit dieser Version werden die zusätzlichen Sammlungen
angelegt. Vorher wird eine bestehende Datenbank einmalig nach
`<Datenbankdatei>.before-rentals-v1.bak` kopiert. Die bestehenden Datensätze werden
nicht automatisch zu Verträgen zusammengeführt. Unter **Bestandsmieter prüfen**
werden gemeinsame Parteien, Zeitraum und Konditionen ausdrücklich bestätigt.
Früher vorbelegte einjährige Laufzeiten sollten dabei am Originalvertrag geprüft
werden. Bei einer Anschlussvermietung müssen aktive Bestandsmieter dieser Wohnung
zuerst bestätigt und deren Enddatum gegebenenfalls eingetragen werden.

API: `GET/POST /api/rentals`, `PUT /api/rentals/:id`,
`POST /api/rentals/:id/applications`, `PUT /api/rentals/:id/applications/:applicationId`,
`POST /api/rentals/:id/viewings`, `PUT /api/rentals/:id/viewings/:viewingId`,
`POST /api/rentals/:id/complete`, `POST /api/rentals/leases/confirm` und
`PUT /api/rentals/leases/:id/end`. Die Übersicht liefert Vorgänge, Mietverhältnisse
und noch nicht bestätigte Bestandsmieter. Monatsbeträge werden intern in Cent gespeichert.

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

- Everything you enter is written to `server/db.json`, which is ignored by Git. To keep it outside the project, set `DOMUS_DB_FILE=/path/to/domus.json`.
- `server/initialData.js` is committed and must only contain fictional demo data.
- Put backups and exports in `data/` (ignored by Git) or outside the project directory.
- Watch out for real tenant or property details in screenshots.
- Tests use an in-memory database and never touch your data.

## API server security

The API has no authentication, so it's locked down to local use:

| Setting | Default | Purpose |
|---------|---------|---------|
| `HOST` | `127.0.0.1` | Only reachable from this machine. Don't set `0.0.0.0` on untrusted networks. |
| `PORT` | `3001` | |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Browser origins allowed to call the API. |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Accepted `Host` headers (blocks DNS rebinding). |

Writes (`POST`/`PUT`) must be sent as `application/json`.

## License

[GPL-3.0](LICENSE)
