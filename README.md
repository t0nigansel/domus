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
- `server/initialData.js` and `src/db/demoData.js` are committed and must only contain fictional demo data.
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
