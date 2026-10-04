# Umbauplan: Domus als Webanwendung (SaaS)

Stand: 04.10.2026. Ziel ist ein **lokal lauffähiges MVP**, das mehrere Nutzer mit sauber getrennten Daten unterstützt. Hosting-Plattform, Rechtliches (DSGVO, AVV, Impressum) und Abrechnung folgen danach und sind nicht Teil dieses Plans. Der Plan ist aber so angelegt, dass beides später ohne erneuten Umbau ergänzt werden kann.

## 1. Ausgangslage

| Bereich | Heute | Problem für SaaS |
| --- | --- | --- |
| Nutzer | Keine Anmeldung | Jeder mit Zugriff auf die URL sieht und ändert alles |
| Daten | Eine globale lowdb-JSON-Datei | Keine Trennung nach Konten; bei gleichzeitigen Zugriffen gehen Daten verloren; keine Transaktionen |
| API | Generischer CRUD-Router übernimmt beliebige Felder | Mass Assignment, keine Validierung, keine Prüfung, wem ein Datensatz gehört |
| Dateien | `data/files/<hash>`, Import aus `rohdaten/` auf dem Server | Kein Konto-Bezug; Serverordner gibt es online pro Nutzer nicht; Upload als Base64-JSON |
| Frontend | Ruft fest `http://localhost:3001` auf, lädt alle Daten beim Start | Kein Login, keine Sitzung, keine Kontoauswahl |
| Abhängigkeiten | Zwei getrennte `package.json`, Vite 5 mit bekannten Schwachstellen | Doppelte Pflege |

Erhalten bleiben: Fachlogik in `src/domain/` (Vermietung, Wohnungsakte), die Seitenstruktur, die bestehenden Tests als Verhaltensreferenz.

## 2. Architekturentscheidungen

| Thema | Entscheidung | Begründung |
| --- | --- | --- |
| Datenbank | PostgreSQL mit **Drizzle ORM** und versionierten Migrationen | Standard, überall hostbar, Transaktionen, Row Level Security |
| Lokale Datenbank | **PostgreSQL im Docker-Container** (`docker-compose.yml`, Daten in einem benannten Volume) | Entspricht dem späteren Betrieb; Verbindung per `DATABASE_URL` |
| Tests | PGlite (PostgreSQL als npm-Paket) im Speicher, frische Datenbank pro Testdatei | Tests und CI brauchen kein Docker, sind schnell, isoliert und berühren nie echte Daten; dieselben Migrationen |
| Anmeldung | **better-auth** (Bibliothek im eigenen Server, Daten in der eigenen Datenbank) | Kein externer Dienst nötig, E-Mail/Passwort, Sitzungen, Organisationen mit Rollen und Einladungen, 2FA als Plugin |
| Mandantenmodell | **Konto (Organisation) mit Mitgliedern**; jeder fachliche Datensatz hat `account_id` | Teams später ohne Datenmigration möglich. Begriff „Account“, weil „Tenant“ schon Mieter heißt |
| Kontotrennung | Pflichtparameter `accountId` in jeder Repository-Funktion; zusätzlich Postgres Row Level Security vor dem Livegang | Zwei Sicherungen; ein vergessener Filter allein führt nicht zum Datenleck |
| Datenmodell | Relationale Spalten für Schlüssel, Beziehungen und alles, womit gerechnet oder gefiltert wird (Daten, Beträge, Status); `jsonb` für beschreibende Angaben (Ausstattung, Energieangaben) | Weniger Umbau der vorhandenen Objekte; Logik wie Überschneidungsprüfung bleibt sauber abfragbar |
| Dateien | Speicher-Schnittstelle mit lokalem Treiber (`files/<accountId>/<hash>`); S3-Treiber später | Lokal sofort nutzbar, beim Hosting nur Treiberwechsel |
| Upload | `multipart/form-data` mit Streaming, Größenlimit pro Datei und Speicherkontingent pro Konto | Kein Base64-Aufblähen, Schutz vor Speicherflutung |
| Validierung | **zod**-Schemas pro Entität, gemeinsam von Server und Frontend genutzt | Ersetzt den generischen CRUD-Router |
| E-Mails | Schnittstelle mit Entwicklungs-Treiber (Ausgabe in Konsole und `data/mails/`) | Verifizierung, Passwort-Reset und Einladungen lokal testbar; echter Versand kommt mit dem Hosting |
| Frontend → API | Relativ `/api`, im Entwicklungsmodus über den Vite-Proxy | Gleiche Origin, Sitzungscookie ohne CORS-Sonderfälle |
| Projektstruktur | npm-Workspaces (`server/`, Frontend im Root), eine gemeinsame Lockdatei | Eine Abhängigkeitsversion pro Paket |
| Sprache | JavaScript bleibt; TypeScript ist kein Teil dieses Umbaus | Umbau nicht zusätzlich vergrößern |

## 3. Datenmodell (Kern)

Alle Tabellen außer den Auth-Tabellen enthalten `account_id` (Fremdschlüssel, `ON DELETE CASCADE`), `created_at` und `updated_at`. IDs sind UUIDs, die der Server erzeugt.

| Tabelle | Inhalt |
| --- | --- |
| `user`, `session`, `account`, `verification` | Von better-auth verwaltet (Hinweis: better-auth nennt Login-Verknüpfungen `account`; unsere Konten heißen dort `organization`) |
| `organization`, `member`, `invitation` | Domus-Konto, Mitglieder mit Rolle (`owner`, `admin`, `member`), Einladungen |
| `properties` | Wohnungen; Stammdaten als Spalten, Ausstattung/Energie als `jsonb` |
| `tenants` | Personen (Mieter, Vertragsparteien) |
| `leases`, `lease_parties` | Mietverhältnisse und Vertragsparteien |
| `rentals`, `rental_applications`, `rental_viewings` | Vermietungsvorgänge, heute als verschachtelte Objekte gespeichert |
| `documents`, `document_files` | Metadaten und Dateiversionen (Hash, Größe, MIME-Typ, Herkunft) |
| `issues`, `issue_attachments` | Schäden und Anliegen |
| `costs`, `cost_tenants` | Kosten und Umlage auf Mieter |
| `contacts` | Kontakte (Handwerker, Versicherung, …) |
| `audit_log` | Wer hat wann was geändert (Konto, Nutzer, Aktion, Entität) |

Die Duplikaterkennung über Hash gilt **pro Konto**, nicht global. Sonst ließe sich herausfinden, ob ein anderes Konto eine bestimmte Datei besitzt.

## 4. Umsetzung in Phasen

Jede Phase endet mit grünem Lint, grünen Tests und lauffähiger App. Größenangaben: S (Tage), M (ca. 1 Woche), L (mehrere Wochen), jeweils für eine Person.

### Phase 0: Aufräumen und Grundlage (S)

- ~~Offene Arbeiten committen~~ (erledigt). Security-PR und Feature-Branch mergen.
- `docker-compose.yml` mit PostgreSQL und Healthcheck; `npm run db:up` / `db:down`.
- npm-Workspaces einrichten, Abhängigkeiten zusammenführen.
- Vite auf die aktuelle Hauptversion heben (schließt die verbliebenen Audit-Funde).
- `src/utils/api.js` auf relatives `/api` umstellen, Vite-Proxy auf den Server.
- Totes Dexie/IndexedDB-Erbe entfernen (`src/db/database.js`, `migration.js`, `demoData.js`, Test-Setup).
- `.env.example` mit allen Variablen; Konfiguration an einer Stelle einlesen und beim Start prüfen.
- README: Hinweise auf das öffentliche Repository anpassen.

Abnahme: App verhält sich wie vorher; `npm run dev` startet Frontend und Server gemeinsam.

### Phase 1: PostgreSQL statt lowdb (L)

- Drizzle-Schema und erste Migration für alle Tabellen aus Abschnitt 3, zunächst mit `account_id`, aber noch einem festen Standardkonto.
- Repository-Schicht pro Entität (`server/repositories/`), jede Funktion verlangt `accountId`.
- `rentalService`, `fileStore` und die CRUD-Routen auf die Repositories umstellen; Transaktionen statt `db.update`.
- Generischen `createCrudRouter` durch Routen mit zod-Schemas ersetzen; `id`, `account_id` und Zeitstempel sind nie aus dem Request übernehmbar.
- Bestehende API-Tests auf PGlite umstellen; Verhalten bleibt gleich.
- Importskript `npm run import:legacy`: übernimmt `server/db.json` und `data/files/` in ein angegebenes Konto. Testet vorab im Trockenlauf und schreibt einen Bericht. Die Originaldateien bleiben unverändert erhalten. Bis Phase 2 gibt es nur das Standardkonto; dort wird es mit deinem Nutzer als `owner` verknüpft, sodass die Bestandsdaten ausschließlich für dich sichtbar sind.

Abnahme: Alle bisherigen Tests grün auf Postgres; deine echten Daten sind nach dem Import vollständig sichtbar; `db.json` wird nicht mehr verwendet.

### Phase 2: Anmeldung und Konten (L)

- better-auth einbinden: Registrierung, E-Mail-Bestätigung, Anmeldung, Abmeldung, Passwort vergessen.
- Organisations-Plugin: Beim Registrieren entsteht ein Konto mit dem Nutzer als `owner`.
- Middleware: Sitzung prüfen → aktives Konto und Rolle bestimmen → `req.accountId`. Alle fachlichen Routen erfordern eine Sitzung.
- Zugriffe über fremde IDs liefern `404` (nicht `403`), damit die Existenz fremder Daten nicht erkennbar ist.
- Frontend: Seiten für Anmeldung, Registrierung, Passwort-Reset; Auth-Kontext; bei `401` zur Anmeldung; Abmelde-Button; Kontoname in der Navigation.
- Sitzungscookie `httpOnly`, `SameSite=Lax`, `Secure` außerhalb von localhost.
- **Isolationstests**: Zwei Konten mit Daten; für jede Route wird geprüft, dass Konto B weder lesen noch ändern noch löschen kann, was Konto A gehört. Ein E2E-Test durchläuft Registrierung, Anmeldung und Datenerfassung.

Abnahme: Zwei Nutzer können sich lokal registrieren und sehen ausschließlich ihre eigenen Daten.

### Phase 3: Dateien pro Konto (M)

- Speicher-Schnittstelle (`put`, `get`, `delete`, `exists`) mit lokalem Treiber unter `files/<accountId>/`.
- Upload per `multipart/form-data` mit Streaming; Typprüfung anhand des Dateiinhalts, nicht nur der Endung.
- Speicherkontingent pro Konto (Standardwert konfigurierbar).
- Download und Vorschau nur nach Prüfung von Sitzung und Kontozugehörigkeit; bestehende Schutz-Header bleiben.
- Serverseitigen `rohdaten/`-Import ersetzen durch Mehrfach- und Ordner-Upload im Browser mit denselben Regeln für Hash, Duplikate und Versionen.
- `informationsquellen.md` (Featureplan) wird eine Kontoeinstellung statt einer Datei auf dem Server.

Abnahme: Dateien eines Kontos sind für andere Konten weder abrufbar noch auf Duplikate prüfbar.

### Phase 4: Härtung (M)

- Rate Limiting für Anmeldung, Registrierung, Passwort-Reset und Upload.
- `helmet` mit Content Security Policy; `/api-docs` nur in der Entwicklung.
- CSRF: Origin-Prüfung für alle schreibenden Anfragen zusätzlich zu `SameSite`-Cookies und JSON-Pflicht.
- Einheitliche Fehlerbehandlung ohne interne Details; strukturierte Logs ohne personenbezogene Inhalte.
- Audit-Log für Änderungen an Mietern, Mietverhältnissen, Dokumenten und Mitgliedern.
- Row Level Security in Postgres als zweite Sicherung (`SET LOCAL app.account_id` pro Transaktion).
- Technische Grundlage für spätere DSGVO-Pflichten: Konto vollständig löschen (Daten und Dateien) und Datenexport als ZIP.
- Optional: Zwei-Faktor-Anmeldung (better-auth-Plugin).
- GitHub Actions: Berechtigungen pro Job, Dependabot, Laufzeit der nächtlichen Agenten prüfen (private Repositories haben ein begrenztes Kontingent an Actions-Minuten).

Abnahme: Sicherheitstests für die genannten Punkte grün; Kontolöschung hinterlässt keine Daten und Dateien.

### Phase 5: Teams (S, Teil des MVP)

- Mitglieder einladen (E-Mail mit Einladungslink), Rollen ändern, Mitglieder entfernen.
- Rechte: `member` darf Daten bearbeiten, aber keine Mitglieder verwalten und das Konto nicht löschen.

## 5. Nicht Teil dieses Plans (folgt nach dem MVP)

- Hosting, HTTPS, Reverse Proxy, Backups, Monitoring; S3-Treiber für Dateien; echter E-Mail-Versand.
- Rechtliches: Datenschutzerklärung, AVV, TOMs, Impressum, AGB.
- Abrechnung und Tarife.
- LLM-Funktionen aus dem Featureplan. Bei SaaS kommen dafür Kosten pro Konto, Datenschutzfragen und Missbrauchsschutz hinzu; sie werden nach dem MVP neu bewertet.

## 6. Auswirkungen auf den Featureplan

Der Featureplan geht von einer lokalen Einzelplatz-Anwendung aus („keine zusätzliche Benutzerverwaltung“, lokaler `rohdaten/`-Ordner, Quellenliste als Datei). Mit diesem Umbau gilt:

- Neue Features entstehen nach Phase 1 direkt auf Postgres und mit `accountId`.
- Der Rohdatenimport wird zum Browser-Upload (Phase 3).
- Die offenen Featureplan-Punkte (Vertragsvorlagen, LLM, Quellenauswertung) sollten bis nach Phase 2 pausieren, damit sie nicht zweimal gebaut werden.

## 7. Getroffene Entscheidungen (04.10.2026)

| Frage | Entscheidung |
| --- | --- |
| Offene Arbeiten | Auf Branch `feature/wohnungsakte-vermietung` committet (baut auf `fix/security-hardening` auf) |
| Anmeldung | better-auth im eigenen Server |
| Lokale Datenbank | PostgreSQL im Docker-Container; Tests mit PGlite |
| Mehrbenutzer | Von Anfang an mitgedacht: Rollen im Datenmodell, Einladungen (Phase 5) gehören zum MVP |
| `rohdaten/`-Import | Wird durch Mehrfach- und Ordner-Upload im Browser ersetzt |
| Bestandsdaten | Bleiben vollständig erhalten und werden in das Konto des Eigentümers importiert; nur dort sichtbar |
| Featureplan | Vertragsvorlagen, LLM-Funktionen und Quellenauswertung pausieren bis nach Phase 2 |

### Voraussetzung auf dem Entwicklungsrechner

Docker ist noch nicht installiert. Benötigt werden **WSL 2** und **Docker Desktop** (Administratorrechte und ein Neustart). Bis dahin laufen alle Tests weiter mit PGlite; nur die lokale Entwicklungsdatenbank braucht Docker.
