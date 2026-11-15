# Zuloni MCP: Lesen und Auswerten

Der produktive MCP-Endpunkt ist `https://www.zuloni.com/mcp`. Nach dem Domainwechsel
m?ssen bestehende Clients diese Adresse verwenden und erneut autorisiert werden;
vorherige Tokens bleiben an den bisherigen Issuer und die bisherige Ressource gebunden. Er verwendet
Streamable HTTP mit dem offiziellen TypeScript SDK; MCP 2026-07-28 sowie die
zustandslose Kompatibilität für 2025-Clients werden unterstützt.

## Werkzeuge

| Werkzeug | Inhalt |
| --- | --- |
| `list_properties` | Wohnungen, Leerstand, aktuelle Mietbeträge; Filter nach Haus und Status |
| `list_leases` | Verträge, Parteien, Kaltmieten, Laufzeiten und auslaufende Verträge |
| `list_tenants` | Mieter und Mietverhältnisse; gemeinsame Mieten gelten pro Vertrag |
| `analyze_costs` | Jahreskosten, Vorjahresvergleich, Kategorien und direkte Wohnungskosten |
| `list_issues` | Schäden und Verlauf, offene Vorgänge nach Alter |
| `search_documents` | Metadaten, Uploadzeitraum und optionale Inhaltssuche |
| `read_document` | PDF-/DOCX-Text mit Dokument-ID und Fundstellen |
| `get_property_dossier` | Wohnung, Haus, Mieter, Verträge, Kosten, Schäden, Dokumente, Datenlücken |

Listen unterstützen `offset` und `limit`. Inhaltssuchen prüfen höchstens zehn
Dokumente je Aufruf; `nextOffset` setzt sie fort. PDFs sind auf 100 Seiten und
20 MB begrenzt. Auszüge sind begrenzt und als gekürzt gekennzeichnet. PDF-Seiten
sind Originalseiten; bei DOCX ist die Fundstelle ein Textabschnitt, keine
verbindliche Druckseite. Scans/Bilder werden nicht per OCR ausgewertet und liefern
einen Hinweis. Leerer Text belegt nicht, dass eine Klausel im Original fehlt.

Kosten werden nach dem gespeicherten Fälligkeitsdatum ausgewertet. Wiederholungen
werden nicht hochgerechnet. Gemeinsame und Hauskosten bleiben unverteilt. Das
Ergebnis ist eine Datenbasis, keine fertige Nebenkostenabrechnung oder Anlage V.

## Verbindung durch einen Nutzer

1. Im MCP-fähigen Assistenten die Zuloni-Adresse mit `/mcp` eintragen.
2. Mit dem eigenen Zuloni-Konto anmelden.
3. Assistenten und Rücksprungadresse prüfen und den Lesezugriff freigeben. Die
   Seite erklärt die Weitergabe personenbezogener Daten an den KI-Anbieter.
4. Unter **Einstellungen → KI-Assistenten über MCP** können Verbindungen getrennt
   werden. Access-Tokens werden sofort abgewiesen; Refresh-Tokens werden entfernt.
   Bereits an den Anbieter übermittelte Daten kann ein Widerruf nicht zurückholen.

OAuth 2.1 verwendet Authorization Code mit PKCE/S256, ressourcengebundene Tokens
und den einzigen Daten-Scope `domus:read`. `offline_access` erlaubt die Erneuerung.
Access-Tokens gelten 15 Minuten. Dynamische Clientregistrierung (DCR) ist
eingeschaltet; eine Registrierung allein gibt keinen Datenzugriff.
Client-ID-Metadatendokumente (CIMD) werden nicht abgerufen. Clients müssen DCR
unterstützen oder vorab über Better Auth registriert sein.

## Betrieb und Freischaltung

Der Zugang wird mit `DOMUS_MCP_ENABLED: "true"` freigeschaltet; ohne diesen Wert
ist er gesperrt. Preview und Produktion sind nach Migration freigeschaltet.
Bei gesperrtem MCP funktioniert die App-Anmeldung ohne die neuen OAuth-Tabellen.
Produktive Migrationen werden niemals während HTTP-Anfragen ausgeführt.

Für Preview und Produktion jeweils getrennt:

1. Die administrative Datenbankverbindung sicher als
   `DOMUS_MIGRATION_DATABASE_URL` bereitstellen (bestehendes Verfahren).
2. `npm run db:migrate:auth` zeigt die zusätzlichen Auth-/OAuth-Tabellen;
   `npm run db:migrate:auth -- --apply` legt sie an. Das Skript berücksichtigt
   das MCP-Schema unabhängig vom Freischaltungsflag.
3. Die Laufzeitrolle benötigt ausschließlich auf den neuen Auth-Tabellen dieselben
   DML-Rechte wie bei den bestehenden Auth-Tabellen:

   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON jwks, "oauthClient",
     "oauthAccessToken", "oauthRefreshToken", "oauthConsent",
     "oauthClientAssertion", "oauthResource", "oauthClientResource"
     TO domus_runtime;
   ```

4. `DOMUS_MCP_ENABLED: "true"` im passenden Wrangler-Environment setzen, Preview
   deployen und prüfen. Produktion danach separat freischalten. `BETTER_AUTH_URL`
   muss die echte Zuloni-Domain der Umgebung sein; sie bestimmt die MCP-Ressource.

Öffentliche Discovery-Routen:

- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-authorization-server/api/auth`

Es gibt keinen gemeinsamen Adminschlüssel und keine MCP-Schreibwerkzeuge.
Browser-Cookies allein reichen am MCP-Endpunkt nicht. Werkzeuge verwenden den
verifizierten Nutzer aus dem Access-Token und ausschließlich feste GET-Routen der
bestehenden Domain-API. Kontoprüfung und PostgreSQL-RLS gelten damit auch hier;
`accountId` ist kein unterstütztes Werkzeugargument. Dokumententext ist eine
nicht vertrauenswürdige Quelle und wird nie als Code oder Anweisung ausgeführt.

## Prüfen

```bash
npx vitest run server/tests/mcp.test.js
npm run test:cloud:integration
npm run lint
npm run build:cloud
npx wrangler deploy --env preview --dry-run
```

Der Integrationstest verwendet isolierte PostgreSQL-, Workers-, R2- und
Browser-Instanzen. Er prüft OAuth/PKCE, Freigabe, getrennte Vermieterkonten,
Original-PDF-Text und Widerruf einschließlich Refresh-Tokens. Produktive Daten
und LLM-API-Schlüssel werden nicht verwendet.

Grundlagen: [offizielles MCP SDK](https://modelcontextprotocol.io/docs/sdk),
[Better Auth MCP](https://better-auth.com/docs/plugins/mcp),
[OAuth-Freigabe](https://better-auth.com/docs/plugins/oauth-provider/sign-in-flow).
