# Umbauplan: Domus als SaaS über Cloudflare

Stand: 11.11.2026. Ziel ist ein **geschlossener, kostenloser Pilotbetrieb**: eingeladene Nutzer registrieren sich, erhalten ein eigenes leeres Verwaltungskonto und verwalten darin ihre Objekte. Deine Bestandsdaten werden ausschließlich in dein eigenes Konto importiert.

Zielarchitektur: Cloudflare Workers für Oberfläche und API, verwaltetes PostgreSQL über Hyperdrive und private Dateien in R2. PostgreSQL und E-Mail-Versand werden außerhalb von Cloudflare betrieben. Dieser Plan beschreibt die noch umzusetzende Lösung; die Anwendung ist heute weiterhin eine lokale Einzelbenutzerinstallation.

## 1. Geprüfter Ist-Stand

| Bereich | Stand im Repository | Noch erforderlich |
| --- | --- | --- |
| Oberfläche | React 19, React Router 7, Vite 8; relative `/api`-Aufrufe | Anmeldung, Registrierung, Sitzungen und Kontoanzeige |
| Projektstruktur | npm-Workspaces, gemeinsamer Entwicklungsstart, zentrale Serverkonfiguration | Cloudflare-Konfiguration und getrennte Umgebungen |
| API | Express 5, generischer CRUD-Router, eigene Datei- und Vermietungsrouten | Authentifizierung, Kontoprüfung und definierte Eingabeschemas |
| Daten | `server/db.js` nutzt lowdb und eine globale JSON-Datei | Relationales Schema, Migrationen, Transaktionen und Kontentrennung |
| PostgreSQL | Docker-Compose, Startskripte und Umgebungsvariablen vorbereitet | Anbindung der Anwendung; Drizzle und Migrationen fehlen |
| Dateien | Lokale Dateien, serverseitiger Rohdatenimport, Base64-Uploads | Private R2-Ablage, Browser-Upload und Kontingente |
| Sicherheit | Lokale Host-/Origin-Beschränkungen und einzelne Fachprüfungen | Benutzerrechte und Schutz für einen öffentlich erreichbaren Dienst |
| Tests | Vitest, Supertest, Playwright und GitHub Actions vorhanden | Isolationstests, PostgreSQL-/Workers-Integration und Wiederherstellungstest |

Die Grundlagen der früheren Phase 0 sind weitgehend vorhanden. PostgreSQL, PGlite, Drizzle und better-auth sind noch nicht in die Anwendung integriert. Ob Docker auf dem Entwicklungsrechner tatsächlich läuft, wird bei der Umsetzung geprüft.

Erhalten bleiben Oberfläche, Navigation und Fachlogik in `src/domain/`, einschließlich Wohnungsakte, Vermietung und Mietverhältnissen. Ein Framework- oder TypeScript-Wechsel gehört nicht zum Umbau.

## 2. Zielarchitektur und Entscheidungen

```text
Browser unter einer gemeinsamen App-Domain
  ├─ Oberfläche → Cloudflare Workers Static Assets
  └─ /api/*    → Cloudflare Worker mit Express
                   ├─ Hyperdrive → verwaltetes PostgreSQL
                   ├─ privater R2-Bucket → Dateien
                   └─ E-Mail-Dienst → Bestätigung, Reset, Einladungen
```

| Thema | Entscheidung |
| --- | --- |
| Hosting | Ein Worker für die API mit statischem Vite-Build; SPA-Fallback für die Oberfläche, `/api/*` immer an den Worker |
| Backend | Express behalten; Einstiegspunkt und Abhängigkeiten in Phase 0 unter Workers prüfen |
| Datenbank | Verwaltetes PostgreSQL mit Drizzle und versionierten Migrationen; Cloud-Anbindung über Hyperdrive |
| Anbieter | PostgreSQL-Anbieter und Region anhand Wiederherstellung, Datenschutz, Verfügbarkeit und Kosten auswählen; noch nicht festgelegt |
| D1 | Nicht gewählt; SQLite/D1 würde den bisherigen PostgreSQL-Plan und dessen Absicherung verändern |
| Lokal | PostgreSQL aus `docker-compose.yml`; lokale Workers-Entwicklung mit Wrangler bzw. Cloudflare-Vite-Integration nach Kompatibilitätsprüfung |
| Tests | Bestehende Tests übernehmen; PGlite für unterstützte schnelle Tests, echtes PostgreSQL für RLS, Rollen und Parallelität; Workers-Tests für Laufzeit und Bindings |
| Anmeldung | better-auth mit PostgreSQL und Organisations-Plugin; Cookies, Adapter und E-Mail-Flows vorab unter Workers nachweisen |
| Konto | Organisation mit Mitgliedern; jeder fachliche Datensatz enthält `account_id`. „Tenant“ bleibt die Bezeichnung für Mieter |
| Kontentrennung | `accountId` als Pflichtparameter aller Datenzugriffe; zusätzlich PostgreSQL Row Level Security vor Pilotstart |
| Dateien | Private R2-Buckets je Umgebung; Schlüssel unter `<accountId>/<hash>`; Duplikaterkennung nur innerhalb eines Kontos |
| E-Mails | Transaktionaler Versanddienst; lokal abgefangene Nachrichten, im Pilot echter Versand mit verifizierter Absenderdomain |
| Umsetzung | JavaScript bleibt; keine zusätzlichen Cache-, Queue- oder Suchdienste ohne konkreten Bedarf |

Workers-Dateisystem und globaler Prozessspeicher sind keine dauerhafte Ablage. In Produktion gibt es weder `db.json` noch persistente `data/files/`- oder `rohdaten/`-Ordner. Benutzer- und Kontokontext dürfen nicht als veränderliche globale Variablen zwischen Anfragen geteilt werden.

## 3. Datenmodell und Zugriffsregeln

Fachliche Tabellen erhalten `account_id`, `created_at` und `updated_at`. Neue IDs erzeugt der Server als UUIDs. Auth-Tabellen folgen dem Bibliotheksschema.

| Tabellen | Inhalt |
| --- | --- |
| `user`, `session`, `account`, `verification` | Auth-Daten; `account` bezeichnet hier die Login-Verknüpfung der Bibliothek |
| `organization`, `member`, `invitation` | Domus-Konto, Mitgliedschaften, Einladungen |
| `properties`, `tenants` | Wohnungen und Personen |
| `leases`, `lease_parties` | Mietverhältnisse und Vertragsparteien |
| `rentals`, `rental_applications`, `rental_viewings` | Vermietungen, Bewerbungen, Besichtigungen |
| `documents`, `document_files` | Metadaten und Dateiversionen mit R2-Schlüssel, Hash, MIME-Typ und Größe |
| `issues`, `issue_attachments` | Schäden und Anliegen mit Anlagen |
| `costs`, `cost_tenants`, `contacts` | Kosten, Umlagen, Kontakte |
| `audit_log` | Konto, Nutzer, Zeitpunkt, Aktion und Entität; keine vollständigen Dokumente oder sensiblen Feldkopien |

Schlüssel, Beziehungen, Beträge in Cent, Daten und filterbare Werte werden relational gespeichert; beschreibende Ausstattung und Energieangaben können `jsonb` bleiben. Die tatsächlich benötigten Spalten werden aus den bestehenden Datenflüssen abgeleitet.

- Die Sitzung identifiziert den Nutzer. Das aktive Konto wird nur nach Prüfung der Mitgliedschaft übernommen; eine Konto-ID aus dem Browser allein ist keine Berechtigung.
- Beziehungen müssen zum selben Konto gehören: Ein Vertrag darf keine fremde Wohnung oder Vertragspartei referenzieren. Zusammengesetzte Fremdschlüssel und Constraints sichern dies zusätzlich ab.
- RLS gilt auch für Verbindungstabellen. Die Laufzeitrolle ist weder Superuser noch `BYPASSRLS` und darf den Schutz nicht als Tabellenbesitzer umgehen. Migrationen verwenden eine getrennte Rolle.
- Der Kontokontext wird transaktionslokal gesetzt, etwa über `set_config('app.account_id', ..., true)`. Ohne Kontext wird Zugriff verweigert. Hyperdrive-Pooling und Query-Cache werden auf Isolation geprüft; Cache für kontogeschützte Abfragen bis zum Sicherheitsnachweis deaktivieren.
- Fremde IDs liefern `404`, anonyme Fachzugriffe `401`. zod-Schemas begrenzen schreibbare Felder; Konto, IDs, Rollen und Zeitstempel sind nicht frei übernehmbar.
- Rollen: Owner verwaltet Konto und Mitglieder; Admin verwaltet Mitglieder im erlaubten Umfang; Member bearbeitet Fachdaten. Der letzte Owner darf nicht versehentlich entfernt werden.
- Mietüberschneidungen und wiederholte Abschlüsse werden auch bei parallelen Anfragen durch Transaktionen und geeignete Sperren bzw. Constraints abgesichert.
- Der fachliche Tageswechsel nutzt eine explizite Zeitzone, zunächst `Europe/Berlin`, statt der lokalen Zeitzone eines Workers.

## 4. Umsetzung bis zum geschlossenen Pilot

Jede Phase endet mit lauffähiger Anwendung und passenden grünen Lint-, Build- und Testschecks. Ein Standardkonto ohne Anmeldung ist ausschließlich ein interner Zwischenschritt und wird nicht öffentlich bereitgestellt.

### Phase 0: Cloudflare-Kompatibilität nachweisen

- Separaten Workers-Einstiegspunkt und minimale Wrangler-Konfiguration vorbereiten; lokale Bestandsnutzung bis zur Migration erhalten.
- Express einschließlich Fehlerbehandlung unter Workers starten. Swagger-Erzeugung und lokale Dateizugriffe aus dem Produktionsstart entfernen; `/api-docs` bleibt Entwicklungssache.
- React-Build ausliefern; direkte Aufrufe wie `/properties/123` und unbekannte `/api/*`-Routen prüfen.
- Mit isolierten Testressourcen PostgreSQL über Hyperdrive und privates R2 durchlaufen: lesen, schreiben, löschen sowie Datenbank-Transaktion mit Rollback.
- better-auth-Anmeldung samt Session-Cookie und Adapter in derselben Laufzeit nachweisen. Proxy-Header, Host-/Origin-Prüfung und Secrets anpassen.
- Datenbank-/E-Mail-Anbieter, Regionen, Pilotbudgets und anfängliche Kontingente dokumentieren, bevor reale Kundendaten gespeichert werden.

**Abnahme:** Der gesamte technische Pfad funktioniert mit synthetischen Daten in einer isolierten Testumgebung. Express und Auth benötigen keine dauerhaften lokalen Dateien; ungeschützte Bestandsdaten werden nicht veröffentlicht.

### Phase 1: PostgreSQL, Validierung und Bestandsimport

- Schema und Migrationen für vorhandene Entitäten erstellen, zunächst mit einem festen internen Konto.
- `server/db.js`, `createCrudRouter`, `rentalService` und Dateimetadaten auf kontogebundene Datenzugriffe umstellen. Keine zweite dauerhafte lowdb-Schreibstrecke behalten.
- Eingaben validieren, Beziehungen absichern und Fachregeln einschließlich historischer Vertragsparteien und idempotenten Vermietungsabschlusses übernehmen.
- Importkommando für JSON und lokale Dateien erstellen: explizites Zielkonto, Trockenlauf, Wiederholbarkeit ohne Duplikate, Referenzprüfung und Vollständigkeitsbericht mit Datei-Hashes. Originale bleiben unverändert.
- Neue Konten starten leer; Demo-Seeds nur ausdrücklich in Entwicklung und Tests ausführen.

**Abnahme:** Bisherige Fachabläufe funktionieren auf PostgreSQL. Importanzahlen, Beziehungen, Geldwerte und Dateiverweise stimmen. Parallele Abschlüsse erzeugen keine doppelten oder überlappenden Mietverhältnisse.

### Phase 2: Anmeldung, Konten und Oberfläche

- Registrierung, E-Mail-Bestätigung, Login, Logout, Passwort-Reset und Sitzungsablauf integrieren.
- Verifizierte Registrierung erzeugt genau ein leeres Konto mit Owner. Pilotregistrierung serverseitig auf eingeladene Personen beschränken; eine versteckte öffentliche Registrierung reicht nicht.
- Auth-Middleware vor sämtlichen Fachrouten; Konto und Rolle pro Anfrage prüfen. RLS aktivieren und mit tatsächlicher Laufzeitrolle testen.
- Auth-Kontext und geschützte Seiten ergänzen. Daten erst nach bestätigter Sitzung laden; bei Logout/Kontowechsel Zustand leeren und verspätete Antworten des alten Kontos verwerfen.
- Sichere Cookies (`httpOnly`, `Secure` in der Cloud, angemessenes `SameSite`), Origin-/CSRF-Prüfung und sichere einmalige Reset-/Einladungstokens umsetzen.
- Bestandskonto mit deinem Nutzer als Owner verknüpfen; neue Nutzer sehen keine Bestandsdaten.

**Abnahme:** Zwei Nutzer arbeiten unabhängig. Konto B kann über keine Route Daten von Konto A lesen, ändern, verknüpfen oder löschen; direkte Datei-IDs und manipulierte Konto-IDs sind abgedeckt. Logout/Kontowechsel hinterlassen keine fremden Daten in der Oberfläche.

### Phase 3: Private Dateien in R2

- Dateioperationen auf privaten R2-Speicher umstellen; keine öffentlichen Bucket-URLs oder `r2.dev` für Kundendateien.
- Authentifizierte Multipart-Uploads ohne Base64-JSON über die API einführen, mit begrenztem Speicherverbrauch. Bestehendes Limit von 20 MB je Datei zunächst beibehalten und unter Workers messen.
- Dateityp am Inhalt prüfen, Namen/Metadaten/Download-Header absichern. Speicherkontingente auch bei parallelen Uploads durchsetzen.
- Vorschau und Download nur nach Sitzungs- und Kontoprüfung; keine öffentliche Zwischenspeicherung privater Antworten.
- Browser-Mehrfachupload ersetzt den Rohdatenordner auf dem Server. Ordnerauswahl ist eine optionale Bedienhilfe; Herkunft, Duplikate und Versionen bleiben nachvollziehbar.
- PostgreSQL und R2 besitzen keine gemeinsame Transaktion: Uploadabbrüche bereinigen, unvollständige Dateien nicht als verfügbar anzeigen, Löschungen wiederholbar ausführen und verwaiste Objekte abgleichen.
- Bestandsdateien nach R2 übernehmen; Hash und Größe gegen den Importbericht prüfen.

**Abnahme:** Fremde Downloads und Duplikatabfragen scheitern. Uploadabbrüche, Quotenüberschreitung und Wiederholungen erzeugen weder kaputte sichtbare Dokumente noch unkontrolliert zurückbleibende Dateien.

### Phase 4: Betrieb und Pilotfreigabe

- Lokale, Staging- und Pilot-/Produktionsumgebungen mit eigenen Datenbanken, Buckets, Auth-Secrets und E-Mail-Einstellungen trennen. Vorschauen bekommen keine Produktionsdaten oder -Secrets.
- GitHub Actions um Workers-Build und Staging-Deployment ergänzen. Migrationen separat und einmalig ausführen; Rollback und rückwärtskompatible Schemaänderungen dokumentieren.
- Domain, HTTPS und verifizierten E-Mail-Versand einrichten. Registrierung und Reset mit echten Testpostfächern prüfen.
- Rate Limits für Auth/Upload, Sicherheitsheader, redigierte Fehlerlogs, Audit-Ereignisse sowie Alarmierung für Fehler und Ressourcenverbrauch ergänzen. Limits müssen über Worker-Instanzen hinweg wirken.
- Datenbank-Backups und Dateisicherung mit Aufbewahrung festlegen. R2 allein ist kein Backup gegen versehentliche Löschung.
- Vollständigen Export und Kontolöschung für Fachdaten, Dateien, Mitgliedschaften und zugehörigen Sitzungszugriff umsetzen. Bei Mitgliedschaft in mehreren Konten bleibt der Nutzer für die übrigen Konten erhalten. Backup-Aufbewahrung und verzögerte Löschung dokumentieren; Wiederherstellung darf gelöschte Konten nicht unkontrolliert reaktivieren.
- Datenbank und Dateien gemeinsam in einer isolierten Umgebung wiederherstellen; Beziehungen/Hashes prüfen sowie erreichbare Wiederherstellungszeit und möglichen Datenverlust dokumentieren.
- Pilotumfang, Supportperson, Fehlerkontakt, Speicher-/Objektlimits und Kostenalarme festlegen. Kosten umfassen Cloudflare, PostgreSQL, E-Mail und Backups; Beträge anhand gewählter Tarife und Lastannahmen dokumentieren.
- Datenflüsse, Anbieter, Speicherorte, Aufbewahrung und erforderliche Datenschutz-/Vertragsunterlagen für reale Pilotdaten prüfen und dokumentieren. Kostenlose Nutzung ersetzt diese Prüfung nicht.

**Abnahme:** Die Freigabeliste in Abschnitt 5 ist erfüllt. Erst dann starten eingeladene Pilotkunden mit ihren Daten.

### Phase 5: Teamzugänge abschließen

- Die bereits vorgesehenen Einladungen, Rollenänderungen und das Entfernen von Mitgliedern fertigstellen; Datenmodell und Autorisierung sind schon in Phase 2 enthalten.
- Einladungen an Konto, Empfänger und Ablaufzeit binden. Entfernte Mitglieder verlieren den Zugriff auch mit noch vorhandener Sitzung.

**Abnahme:** Rollen, Einladungsannahme, Zugriffsentzug und Schutz des letzten Owners sind getestet. Bei einem ausdrücklich auf Einzelpersonen begrenzten ersten Pilot darf der Betreiber die Pilotzulassung zunächst selbst verwalten; vor Teamnutzung ist Phase 5 erforderlich.

## 5. Verbindliche Freigabeliste für den Pilot

- [ ] Workers-Kompatibilität einschließlich Express, Auth, PostgreSQL-Transaktionen und R2 nachgewiesen.
- [ ] Bestandsdaten und Dateien vollständig und ausschließlich deinem Konto zugeordnet.
- [ ] Neue Konten starten leer; Pilotregistrierung ist serverseitig beschränkt.
- [ ] Isolation aller Fachrouten, Beziehungen, Dateien und Exporte mit zwei Konten getestet.
- [ ] RLS mit Produktionsrollen und Hyperdrive geprüft; kein kontenübergreifender Cache.
- [ ] Gleichzeitige Abschlüsse/Uploads erhalten Datenintegrität und Kontingente.
- [ ] Registrierung, Verifizierung, Reset, Sitzungsablauf und Logout funktionieren.
- [ ] Staging und Produktion getrennt; keine Secrets/echten Daten im öffentlichen Repository, in Vorschauen oder Testberichten.
- [ ] Export und Löschung funktionieren; Aufbewahrung und Backup-Löschung dokumentiert.
- [ ] Datenbank und Dateien erfolgreich gemeinsam wiederhergestellt; Wiederherstellungsziele dokumentiert.
- [ ] Monitoring, Supportkontakt, Kostenalarme und begrenzter Pilotumfang eingerichtet.
- [ ] Anbieter-/Regionenauswahl, Datenflüsse und Datenschutz-/Vertragsprüfung abgeschlossen.
- [ ] Lint, Build, Fachtests, Sicherheits-/Isolationstests und Workers-Staging-Smoke-Test grün.

## 6. Öffentlicher und bezahlter Start nach dem Pilot

Öffentliche Selbstregistrierung erst nach Auswertung des Piloten freischalten. Fehler, Speicherverbrauch, Last, Supportaufwand und Wiederherstellungserfahrungen auswerten und Betriebsgrenzen anpassen.

Für ein bezahltes Angebot zusätzlich:

- Tarife mit serverseitig durchgesetzten Objekt-, Speicher- und gegebenenfalls Mitgliederlimits.
- Zahlungsdienst und Kundenportal; signierte, idempotente Webhooks für Abonnementzustände.
- Definiertes Verhalten bei Zahlungsverzug, Kündigung und Tarifwechsel ohne ungeplante Datenlöschung.
- Abrechnungs-, Steuer- und Vertragsanforderungen für das konkrete Angebot klären und Texte/Prozesse vor bezahltem Start fertigstellen.
- Missbrauchsschutz für öffentliche Registrierung; Support-/Verfügbarkeitszusagen passend zum tatsächlich tragfähigen Betrieb.

Für den ersten Pilot zurückgestellt: Zahlungsintegration, eigene Kundensubdomains, Microservices, eigener Cache, LLM-Funktionen und neues Frontend. Vertragsgenerierung und Quellenauswertung aus dem Featureplan warten auf eine stabile Konten-/Datenbasis. Künftige Quellen sind Kontoeinstellungen statt gemeinsam genutzter Serverdateien.

## 7. Aufwand und nächster Schritt

Der Umbau ist ein Vorhaben über mehrere Wochen für eine Person. Eine belastbare Termin- und Kostenschätzung folgt nach Phase 0. Größte Unsicherheiten sind Workers-/Auth-Kompatibilität, Datenmigration sowie transaktionssichere Fachlogik und Kontentrennung. Die Phasen sind aufeinanderfolgende Arbeitsblöcke, keine bereits umgesetzten Funktionen.

**Nächster Umsetzungsschritt:** Phase 0 mit synthetischen Testdaten durchführen. Danach die bestätigte Laufzeitintegration für die PostgreSQL-Migration verwenden. Die lokale Bestandsinstallation bleibt bis zum geprüften Import nutzbar.

## 8. Angelegte Cloudflare-Ressourcen

Stand: 11.11.2026. Beide Worker und die privaten Buckets wurden im Dashboard erstellt. Der Cloudflare-Einstiegspunkt und die Cloud-Oberfläche werden nun aus dem Repository deployt; die eigentliche Objektverwaltung und Bestandsdaten sind noch nicht online freigegeben.

| Umgebung | Worker | URL | R2-Bucket | Binding |
| --- | --- | --- | --- | --- |
| Produktion, vorbereitet | `domus` | https://domus.toni-gansel.workers.dev | `domus-files` | `FILES` |
| Staging/Preview | `domus-preview` | https://domus-preview.toni-gansel.workers.dev | `domus-preview-files` | `FILES` |

Beide Buckets sind leer, auf die Jurisdiktion EU beschränkt und verwenden die Storage Class Standard. Public Access ist für beide deaktiviert. Die Bindings wurden jeweils in der Cloudflare-Umgebung „Production“ des entsprechenden Workers gespeichert; `domus-preview` ist ein eigener Worker für die fachliche Staging-Umgebung.

Im Repository umgesetzt: `wrangler.jsonc` mit getrennten Umgebungen, EU-R2-Bindings, Cloud-Build und Deploy-Befehlen; Express-Einstiegspunkt ohne Import der lokalen lowdb-API; `/api/health`; geschlossene Fach-APIs bis zur Migration; better-auth-Konfiguration mit Pilotbeschränkung, E-Mail-Verifizierung und Datenbank-Rate-Limit; explizites Auth-Migrationskommando; PostgreSQL-Verbindungs- und Transaktionshelfer. Die Anmeldung bleibt ohne vollständige Datenbank-/Mail-Konfiguration deaktiviert. Konto-Onboarding und Fachmigration sind weiterhin ausstehend.

Geprüft: lokale Workers-Laufzeit mit Express, SPA-Direktnavigation, gesperrter API und R2-Schreiben/Lesen/Löschen; Passwort-Hashing, Verifizierungstokens und Pilotbeschränkung mit isolierter Testdatenbank im Workers-Prozess. Diese Auth-Tests verwenden einen Memory-Adapter und ersetzen keinen PostgreSQL-/Hyperdrive-Nachweis. Getrennte zufällige `BETTER_AUTH_SECRET`-Werte wurden in Cloudflare gespeichert, ohne sie im Repository oder Chat offenzulegen.

Noch offen: PostgreSQL-Anbieter verbinden und getrennte Datenbanken über Hyperdrive anbinden; Auth-Schema auf PostgreSQL prüfen, echte E-Mail-Zustellung und Absenderdomain einrichten; Organisations-Onboarding, relationale Fachmigration und vollständige Kontentrennung umsetzen; anschließend die restlichen Pilot-Freigaben. Keine Bestandsdateien wurden hochgeladen. Es wurden keine neuen Cloudflare-API-Tokens für die lokale CLI angelegt; sie verwendet den bereits vorhandenen OAuth-Zugang.

## 9. Technische Referenzen

Cloudflare-Dokumentation zur gewählten Architektur, geprüft am 11.11.2026:

- [Express auf Workers](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/)
- [Static Assets und SPA-Routing](https://developers.cloudflare.com/workers/static-assets/)
- [Workers-Dateisystem: speicherbasiert und temporär](https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/)
- [Hyperdrive für externes PostgreSQL](https://developers.cloudflare.com/hyperdrive/)
- [R2 Object Storage](https://developers.cloudflare.com/r2/)
- [D1 als SQLite-Alternative, hier nicht gewählt](https://developers.cloudflare.com/d1/)
