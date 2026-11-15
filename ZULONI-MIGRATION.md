# Umstellung auf Zuloni

## Plan: Anwendung

1. Sichtbare Marke, Logo, Seitentitel, ?bersetzungen, E-Mails, PDF-Fu?zeilen und Exportnamen auf Zuloni umstellen.
2. Produktive Auth-Basis und MCP-Endpunkt auf https://www.zuloni.com umstellen.
3. Alte App-Adresse und zuloni.com mit Pfad und Query auf www umleiten; alte Auth-Callback-Links ber?cksichtigen.
4. Konten, Daten, Secrets und vorhandene Infrastruktur weiterverwenden.
5. Unit-, Integrations-, Browser- und Live-Pr?fungen durchf?hren, Preview und Produktion deployen.

## Plan: Cloudflare

1. Aktive Zone zuloni.com und bestehende Ressourcen pr?fen.
2. www.zuloni.com und zuloni.com als Custom Domains an den bestehenden Produktions-Worker binden. Cloudflare verwaltet DNS und TLS.
3. Email Sending f?r zuloni.com aktivieren, SPF/DKIM/DMARC pr?fen und Absender auf no-reply@zuloni.com umstellen.
4. DNS, HTTPS, Weiterleitungen, Auth-Discovery und MCP ?ber die ?ffentliche Domain pr?fen.

## Betrieb

Die ?ffentliche Marke lautet Zuloni. Worker domus und domus-preview, Repository, R2-Buckets, Hyperdrive, Workflows, Datenbankschemata, DOMUS_* Variablen, interne Ereignisse und domus:read bleiben zur Kompatibilit?t bestehen. Sie sind keine sichtbare Produktmarke.

Neue Domain: https://www.zuloni.com. MCP: https://www.zuloni.com/mcp. Nutzer melden sich auf der neuen Domain neu an; MCP-Clients m?ssen die neue Adresse und eine neue Freigabe verwenden. Bestehende Datens?tze werden nicht migriert oder zur?ckgesetzt.

Die Vorschau bleibt unter https://domus-preview.toni-gansel.workers.dev erreichbar. Rechtliche Betreiberangaben und vorhandene Kontaktadressen werden nicht erfunden oder ungepr?ft ersetzt.

Rollback: Vorherige Worker-Version wiederherstellen und die produktive BETTER_AUTH_URL auf die bisherige workers.dev-Adresse zur?cksetzen; Custom Domains bei Bedarf gezielt l?sen. Datenbanken und Dateispeicher bleiben unver?ndert.

## Umsetzung am 15. November 2026

- Zwei Subagents haben Branding und Runtime/Auth umgesetzt; die Hauptinstanz hat Cloudflare, Konfiguration und Deployment ?bernommen.
- Beide Custom Domains sind aktiv; HTTPS und die 308-Weiterleitungen wurden live gepr?ft.
- Cloudflare Email Sending ist f?r zuloni.com aktiv; SPF, DKIM und DMARC sind ?ffentlich aufl?sbar. Keine echten Testmails versendet; Zustellpr?fung bleibt in ToDo.MD.
- 289 Unit-Tests, Linter, Cloud-Smoke und 375 isolierte Integrationspr?fungen erfolgreich.
- Produktive OAuth-/PKCE-Anmeldestrecke, MCP-Discovery und Schutz der APIs live gepr?ft.
