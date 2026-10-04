# Featureplan: Wohnungsakte und Vermietungsassistent

Stand: 24.09.2026. Die Umsetzung hat begonnen; der folgende Status grenzt den vorhandenen Umfang ab.

## Umsetzungsstand

- [x] Wohnungsakte mit manueller Stammdatenpflege, vorhandene Fläche weiterverwendet.
- [x] Lokale Dateiablage, Upload, Download und Bildvorschau; Zuordnung und Kategorien.
- [x] Expliziter Rohdatenimport mit Inhaltsvergleich und Versionen; Originale bleiben erhalten.
- [x] Medienbeschreibung, Reihenfolge, Titelbild und Freigabe für Inserate.
- [x] Rohdaten aus Git ausgeschlossen und bisherige Dokumenten-Platzhalter ersetzt.
- [x] Vermietungsvorgänge mit manueller Vorbereitung, Inseratentwurf und Archivierung.
- [x] Interessenten mit mehreren Vertragsparteien, Auswahl und Besichtigungsterminen.
- [x] Eigenständige Mietverhältnisse, bewusst bestätigte Bestandszuordnungen und Historie.
- [x] Manueller Abschluss mit bereits unterschriebenem Vertrag; wiederholbarer Abschluss ohne Duplikate.
- [ ] Vertragsvorlagen und Erzeugung eines ausgefüllten Vertragsentwurfs.
- [ ] Dokumentauswertung und LLM-Textentwürfe.
- [ ] Auswertung der externen Informationsquellen.

Die Dateifunktionen verwenden derzeit eine Grenze von 20 MB pro Datei. PDF und
Bilder können angesehen werden; Word-Dateien werden heruntergeladen. Dateien
werden noch nicht inhaltlich ausgewertet. Echte Rohdaten wurden bei Entwicklung
und Tests nicht importiert oder verändert.

Verifikation des ersten Ausbauschritts: 198 Unit-/API-Tests erfolgreich, darunter
Dateiablage, Wiederladen, Importgrenzen, Versionen und Duplikaterkennung.
Ein Browser-Test mit simulierten API-Antworten prüft Stammdaten, Import,
Freigabe und Wiederladen sowie die schmale Bildschirmansicht. Build und Lint
wurden ebenfalls geprüft.

Zweiter Ausbauschritt: Unter „Vermietungen“ ist der manuelle Ablauf einschließlich
Bestandsprüfung und Mietverhältnis verfügbar. Vor der additiven Datenmigration
wird beim ersten regulären Serverstart eine Sicherung neben der Datenbank angelegt.
Die tatsächlichen Nutzerdaten wurden während der Entwicklung nicht migriert.
Ein zusätzlicher Browser-Test nutzt eine eigene API mit fiktiven Daten und durchläuft
Vorgang, zwei Vertragsparteien, Besichtigung, Vertragsupload und Abschluss.
API-Tests prüfen Überschneidungen, wiederholte Abschlüsse, Bestandszuordnungen,
automatische Statusberechnung und unveränderte Belegung vor einem zukünftigen Beginn.
Ein separater Prozess-Test prüft Sicherung und wiederholten Start mit einer temporären
Datenbank. Noch offen bleiben insbesondere LLM-Unterstützung, Quellenrecherche,
Vertragsgenerierung und das gezielte Löschen nicht mehr benötigter Bewerberdaten.

## 1. Ziel und vereinbarter Umfang

Domus begleitet eine Neuvermietung von den Wohnungsunterlagen bis zum hinterlegten unterschriebenen Mietvertrag. Die erste Version bildet den gesamten Ablauf schlank ab.

- Die Wohnungsakte erweitert die vorhandene Wohnungsverwaltung.
- Der Vermietungsassistent bereitet Inhalte und Dokumente vor. Veröffentlichung, Nachrichtenversand und Unterzeichnung erfolgen außerhalb von Domus.
- Vorhandene Hamburger Standardmietverträge in Word und PDF bilden die Grundlage der Vertragsvorlagen. Die konkrete Ausgabe und Feldstruktur werden anhand der später bereitgestellten Dateien geprüft.
- Fotos, Grundrisse, Verträge und weitere Unterlagen werden vom Nutzer im vorhandenen Ordner `rohdaten/` gepflegt und schrittweise ergänzt.
- `rohdaten/informationsquellen.md` enthält künftig vom Nutzer gepflegte externe Informationsquellen für Inserate. Die Datei ist derzeit leer.
- Die Umsetzung kann mit fiktiven Beispieldaten beginnen. Die Einrichtung und Abnahme der echten Vertragsvorlage erfolgt nach Bereitstellung der Dateien.

## 2. Bestehende Grundlage

Technik: React/Vite, Express-API, lowdb mit JSON-Persistenz. Die vorhandene Architektur bleibt für diesen Ausbau erhalten; keine zusätzliche Benutzerverwaltung oder umfassende Infrastrukturmigration.

| Bereich | Vorhanden | Zu ergänzen |
| --- | --- | --- |
| Wohnungen | Name, Lagebezeichnung, Miete, Nebenkosten, Status, Zustand, Notizen | Strukturierte Adresse, Fläche, Zimmer, Ausstattung, Energieangaben, Medien |
| Mieter | Kontaktdaten, Wohnungszuordnung, Mietbeginn/-ende | Eigenständige Mietverhältnisse, mehrere Vertragsparteien, Historie |
| Dokumente | Metadaten, Kategorien, API | Echte Dateiablage, Upload/Import, Vorschau/Download, Zuordnung |
| Wohnungsdetailseite | Stammdaten, Bewohner, Schäden | Wohnungsakte; fest eingetragene Beispieldokumente ersetzen |
| Vermietung | Keine eigene Umsetzung | Vorgänge, Interessenten, Termine, Entwürfe, Vertragsabschluss |
| LLM | Keine Anbindung | Extraktionsvorschläge und Textentwürfe mit kontrollierter Datenbasis |

Relevante Einstiegspunkte: `src/pages/PropertyDetails.jsx`, `src/pages/Documents.jsx`, `src/hooks/domain/useTenants.js`, `src/db/services/`, `server/app.js`, `server/db.js`.

## 3. Feature: Digitale Wohnungsakte

### Stammdaten

- Adresse, Wohnungsbezeichnung, Etage, Wohnfläche und Zimmeranzahl.
- Ausstattung: beispielsweise Balkon, Terrasse, Küche, Keller, Stellplatz, Aufzug, Bodenbeläge.
- Zustand, Modernisierungen und interne Hinweise.
- Heizungsart und relevante Angaben aus dem Energieausweis, sofern vorhanden.
- Unbekannte Angaben bleiben ausdrücklich unbekannt; keine erfundenen Standardwerte.
- Die vorhandenen Wohnungsdatensätze bleiben erhalten. Eine zusätzliche Gebäudehierarchie ist für die erste Version nicht erforderlich.

### Medien und Dokumente

- Fotos und Grundrisse hochladen oder aus `rohdaten/` importieren.
- Raum/Beschreibung, Reihenfolge, Titelbild und Freigabe für Inserate pflegen.
- Dokumente kategorisieren, einer Wohnung zuordnen, ansehen und herunterladen.
- Interne Dokumente und personenbezogene Angaben von zur Veröffentlichung freigegebenen Inhalten unterscheiden.
- Originaldateien bleiben unverändert; bearbeitete oder neu erzeugte Dateien erhalten eigene Versionen.

### Angaben aus Dokumenten vorschlagen

Der Nutzer startet die Auswertung ausgewählter Dokumente ausdrücklich. Domus zeigt erkannte Angaben mit Quelldokument und möglichst Seite/Textstelle. Erst bestätigte Vorschläge werden zu Stammdaten.

- Widersprüche zwischen vorhandenem Wert und Vorschlag nebeneinander anzeigen.
- Bestätigung oder Ablehnung je Angabe ermöglichen.
- Quelle und Bestätigungszeitpunkt speichern.
- Textbasierte PDFs und DOCX zuerst unterstützen. Bei Scans oder nicht lesbaren Dokumenten einen klaren Hinweis und manuelle Erfassung anbieten; allgemeine OCR ist kein Muss für die erste Version.
- Fotos zunächst manuell beschriften. Automatische Raum- und Ausstattungserkennung ist eine spätere Erweiterung.

## 4. Rohdaten und externe Quellen

### Rohdaten als Eingang

`rohdaten/` ist der vom Nutzer gepflegte Eingangsordner. Bestehende Dateien und Unterordner werden weder umbenannt noch verschoben. Eine neue Ordnerstruktur ist keine Voraussetzung.

Vorgesehener Import:

1. Nutzer startet einen Import und wählt Dateien aus dem konfigurierten lokalen Rohdatenverzeichnis aus.
2. Domus zeigt Dateityp und Importstatus und fragt nach Wohnung sowie Dokumentkategorie.
3. Bestätigter Import kopiert Dateien in die verwaltete lokale Ablage und speichert Herkunft sowie Inhalts-Hash.
4. Erneutes Importieren unveränderter Dateien erzeugt keine Duplikate. Geänderte Dateien werden als neue Version angeboten.

Keine automatische Überwachung in Version 1. Neue Dateien werden auf ausdrücklichen Import hin übernommen. Der lokale Server darf nur innerhalb des konfigurierten Eingangsordners lesen; frei übergebene Dateipfade werden nicht akzeptiert.

Das Repository ist laut README öffentlich. `rohdaten/` wird aktuell nicht durch `.gitignore` ausgeschlossen. Vor der Datenintegration den gesamten Rohdatenordner und die verwaltete Dateiablage vom Versionskontrollsystem ausschließen. Auch die Quellenliste bleibt zunächst lokal; eine öffentlich teilbare Beispieldatei kann separat angelegt werden.

### Informationsquellen für Inserate

Die vom Nutzer gepflegte Markdown-Datei bleibt die maßgebliche Quellenliste. Domus liest sie auf Anforderung neu ein. Vorgeschlagene, einfache Struktur pro Eintrag:

```markdown
## Name der Quelle
- URL: https://example.org
- Thema: Verkehr / Umgebung / Infrastruktur
- Geltungsbereich: Ort oder Stadtteil
- Hinweise: Welche Informationen hier hilfreich sind
```

Auch einfache Markdown-Links sollen erkannt werden. Fehlende Angaben werden angezeigt, nicht erfunden.

Rechercheablauf:

1. Nutzer wählt Quellen für einen Vermietungsvorgang aus und startet den Abruf.
2. Domus schlägt relevante Lageinformationen mit URL, Abrufdatum und Belegstelle vor.
3. Nutzer bestätigt Aussagen für die Verwendung im Inserat.
4. Der Textgenerator erhält bestätigte Wohnungsdaten und bestätigte Lageinformationen als getrennte Eingaben.

Quelleninhalte sind Daten und keine Anweisungen an das LLM. Externe Texte dürfen keine Aktionen auslösen. Quellen werden serverseitig nur über öffentliche HTTP(S)-Adressen abgerufen; lokale und private Netzwerkziele sowie entsprechende Weiterleitungen werden gesperrt.

Bei unerreichbaren, gesperrten oder nicht auswertbaren Quellen zeigt Domus den Fehler und ermöglicht einen manuell hinterlegten Auszug mit Quellenangabe. Kein unbegrenztes Crawling und keine Umgehung von Zugangsbeschränkungen.

Konkrete Entfernungen, Fahrzeiten und Aussagen zur Infrastruktur benötigen Belege. Allgemeine Stadtteilinformationen dürfen nicht als bewiesene Eigenschaft der Wohnung erscheinen. Quellenbelege bleiben intern am Entwurf nachvollziehbar; der exportierte Inseratstext wird separat dargestellt.

## 5. Feature: Vermietungsassistent

Pro Neuvermietung entsteht ein eigener Vorgang mit Wohnung, Bearbeitungsstand, Konditionen und Dokumenten. Bestehende Mietdaten werden durch die Vorbereitung einer Neuvermietung nicht verändert.

### Schritt 1: Vorbereitung

- Verfügbarkeit, gewünschte Kaltmiete, Nebenkosten, Kaution und mitvermietete Bestandteile erfassen.
- Fehlende Stammdaten, Medien und Vertragsangaben als Checkliste anzeigen.
- Aktuelle Wohnungsdaten übernehmen; Konditionen für die Neuvermietung separat speichern.

### Schritt 2: Inserat

- Titel, Eckdaten und Beschreibung aus bestätigten Angaben erzeugen.
- Optional bestätigte Informationen aus der Quellenliste ergänzen.
- Ton und Länge anpassen; Text direkt bearbeiten und Entwurf speichern.
- Ausgewählte Fotos und Grundriss zuordnen.
- Text kopieren und ausgewählte Medien herunterladen.
- Die für einen gespeicherten Entwurf verwendeten Daten und Quellen als Stand festhalten. Spätere Änderungen überschreiben einen freigegebenen Entwurf nicht stillschweigend.

### Schritt 3: Interessenten

- Kontaktdaten und eingefügte Anfragen manuell erfassen.
- Mehrere künftige Vertragsparteien einer Bewerbung zuordnen können.
- Status und offene Fragen pflegen; LLM-Antwortentwürfe auf Basis bestätigter Angaben erstellen.
- Interessenten bleiben von bestehenden Mietern getrennt, bis ein Mietverhältnis angelegt wird.
- Keine automatische Bewertung oder KI-Rangliste.

### Schritt 4: Besichtigungen

- Datum, Uhrzeit, Interessenten und Notizen manuell erfassen.
- Einladung und Nachfassnachricht als kopierbaren Entwurf erstellen.
- Ergebnis und offene Aufgaben festhalten.
- Keine Kalender- oder E-Mail-Integration erforderlich.

### Schritt 5: Auswahl

- Nutzer wählt die Bewerbung und bestätigt alle Vertragsparteien.
- Kontaktdaten, Mietbeginn und endgültige Konditionen vervollständigen.
- Schritte dürfen übersprungen werden, beispielsweise bei bereits gefundenen Mietern. Für die Vertragserstellung gelten trotzdem die erforderlichen Pflichtfelder.

### Schritt 6: Mietvertragsentwurf

- Vorhandenen Hamburger Standardmietvertrag als versionierte Vorlage hinterlegen.
- Einmalig variable Felder und Optionen zuordnen: Vermieter, Mieter, Mietobjekt, Beginn, Konditionen, mitvermietete Bestandteile und Anlagen.
- Das konkrete Dokument bestimmt die Felder. Die Bezeichnung „Hamburger Standardmietvertrag“ ersetzt keine Prüfung der gelieferten Vorlage.
- DOCX mit eingerichteten Platzhaltern befüllen; vorhandene ausfüllbare PDFs anhand zugeordneter Formularfelder befüllen.
- Bei normalen PDFs/Scans zunächst prüfen, ob eine passende Word-Ausgangsdatei vorliegt. Andernfalls ist eine einmalige, visuell geprüfte Vorlageneinrichtung nötig. Keine beliebige automatische PDF-Rekonstruktion versprechen.
- Vorhandene Klauseln aus der gewählten Vorlagenversion übernehmen. Das LLM darf Feldzuordnungen vorschlagen und fehlende Angaben erläutern; das eigentliche Befüllen erfolgt deterministisch.
- Unausgefüllte Pflichtfelder und widersprüchliche Angaben vor dem finalen Export anzeigen.
- Vertragsdaten zur Prüfung zusammenfassen; ausgefüllten Vertrag und Anlagen exportieren. DOCX und druckbares PDF als Zielausgabe bei Word-Vorlagen; PDF bei PDF-Vorlagen. Die konkrete Konvertierung wird mit der tatsächlichen Vorlage geprüft.
- Jede erzeugte Fassung referenziert ihre Vorlagenversion und den verwendeten Datenstand.

### Schritt 7: Abschluss

- Versand und Unterschriftenstatus manuell pflegen.
- Unterschriebenen Vertrag hochladen und dem Vorgang zuordnen.
- Abschluss ausdrücklich bestätigen und daraus genau ein Mietverhältnis anlegen; wiederholtes Bestätigen erzeugt keine Duplikate.
- Ein zukünftiger Mietbeginn bleibt als geplant erkennbar. Der aktuelle Mieter und die heutige Belegung bleiben bis zum tatsächlichen Wechsel korrekt.
- Abgebrochene Vorgänge ohne Mietverhältnis archivieren können.

## 6. Datenmodell und Architektur

Vorgeschlagene Ergänzungen, bei Umsetzung an vorhandene Konventionen anpassen:

| Modell | Aufgabe |
| --- | --- |
| Erweiterte Wohnung | Stammdaten und bestätigte Quellenbezüge |
| Dokument/Medium | Dateireferenz, Hash, Kategorie, Wohnung, Sichtbarkeit, Herkunft und Version |
| Extraktionsvorschlag | Feld, vorgeschlagener Wert, Quelle, Prüfstatus |
| Vermietungsvorgang | Wohnung, Phase, Verfügbarkeit, gewünschte und vereinbarte Konditionen |
| Bewerbung | Interessenten/Vertragsparteien, Anfragen, Status und Notizen |
| Besichtigung | Vorgang, Bewerbung, Termin und Ergebnis |
| Entwurf | Textart, Inhalt, freigegebener Stand, verwendete Daten und Quellen |
| Quellenbeleg | URL, Abrufzeit, relevante Belegstelle und bestätigte Aussage |
| Vertragsvorlage | Originaldatei, Version, Feldzuordnung und Pflichtfelder |
| Mietverhältnis | Wohnung, Vertragsparteien, Beginn, optionales Ende, Konditionen, Vertragsdateien |

Dateiinhalte liegen außerhalb der JSON-Datenbank; lowdb speichert Metadaten und Verweise. Neue Fachlogik lebt in Services bzw. Domain-Funktionen, nicht in Seitenkomponenten. Die Dokumentverwaltung verwaltet Dateien und Metadaten; Extraktion und Recherche erhalten eigene Services. Damit bleibt die bestehende Trennung in `src/documents/AGENT.md` erhalten.

LLM-Aufrufe laufen über das Backend. Anbieter, Modell und Zugang werden vor der Implementierung dieser Anbindung festgelegt. Es werden nur die für die jeweilige Aktion ausgewählten Inhalte übermittelt; Mieterdokumente gehören nicht in den Kontext der Inseratserstellung. Bei LLM-Ausfall bleiben manuelle Bearbeitung und der Vermietungsablauf nutzbar.

### Bestandsdaten und Mietverhältnisse

- Bestehende Datensätze und IDs erhalten; neue Felder additiv ergänzen.
- Migration vorab sichern und wiederholbar gestalten.
- Das derzeitige automatische Mietende nach einem Jahr durch ein ausdrücklich angegebenes, optionales Enddatum ersetzen.
- Historische Wohnungszuordnungen beim Auszug erhalten.
- Bestehende Mieter nicht allein wegen gleicher Wohnung oder gleicher Datumsangaben automatisch zu einem gemeinsamen Vertrag zusammenführen; unklare Zuordnungen zur Prüfung markieren.
- Zeitliche Überschneidungen und widersprüchliche Belegung anzeigen; Vorbereitung einer Anschlussvermietung muss möglich bleiben.
- Geldbeträge zuverlässig berechnen, nicht vom LLM berechnen lassen.
- Interessentendaten und Anhänge nach Abschluss bewusst löschen können, ohne Vertrags- und Mietverhältnisdaten zu verlieren.

## 7. Umsetzung in überschaubaren Schritten

Die folgenden Pakete ergeben gemeinsam die erste vollständige Version.

1. **Dateiablage und Wohnungsakte:** Lokale Daten ausschließen, Upload/Import und Downloads implementieren, Stammdaten und Medien ergänzen, Beispieldokumente ersetzen.
2. **Vermietung und Mietverhältnis:** Vorgänge, Interessenten, Termine und manuelle Statuspflege ergänzen; Mietverhältnis und Bestandsmigration einführen.
3. **Vertragsvorlagen:** Mit einer fiktiven DOCX-Vorlage Feldzuordnung, Befüllung, Vorschau/Export und Abschluss durchgängig umsetzen. Tatsächliche Word/PDF-Vorlagen nach Lieferung einrichten und prüfen.
4. **LLM-Unterstützung:** Dokumentvorschläge, Inserate und Antwortentwürfe ergänzen. Bestätigung, Quellenbezug und Fehlerbehandlung umsetzen.
5. **Externe Quellen:** Markdown-Liste importieren, ausgewählte Quellen abrufen, belegte Lageinformationen zur Prüfung vorschlagen und in Inserate einbeziehen.
6. **Durchgängige Abnahme:** Gesamtablauf inklusive Bestandsdaten, Wiederaufnahme eines Vorgangs und zukünftiger Mietbeginne prüfen.

## 8. Abnahmekriterien

- Eine vorhandene Wohnung kann ohne Datenverlust um Stammdaten, Fotos, Grundriss und Dokumente ergänzt werden.
- Importierte Dateien bleiben nach Neustart erreichbar; erneuter Import erzeugt keine ungewollten Duplikate. Rohdateien werden nicht verändert.
- Extrahierte Angaben werden erst nach Bestätigung übernommen. Widersprüche und nicht lesbare Dokumente werden sichtbar.
- Ein Inserat verwendet nur bestätigte Wohnungs- und Lageinformationen; interne Notizen und Bewerberdaten werden nicht veröffentlicht.
- Ein Quellenfehler verhindert weder manuelle Bearbeitung noch einen Inseratentwurf ohne externe Informationen.
- Ein Nutzer kann Interessenten und Besichtigungen erfassen, eine Bewerbung auswählen und einen Vertrag vorbereiten, ohne externe Nachrichten auszulösen.
- Mehrere Mieter können in einem Vertrag stehen. Pflichtfelder sind ausgefüllt und Klauseltext sowie Layout bleiben bei der Befüllung erhalten.
- Exportierte Verträge werden anhand repräsentativer langer Namen, Adressen, mehrerer Parteien und Anlagen visuell geprüft.
- Abschluss und Wiederholung desselben Abschlusses erzeugen insgesamt nur ein Mietverhältnis.
- Anschlussvermietungen verändern bestehende Belegung und Konditionen nicht vorzeitig; unbefristete Mietverhältnisse benötigen kein künstliches Enddatum.
- Automatisierte Prüfungen decken Migration, Zuordnung, Importgrenzen, Quellenabrufgrenzen, Vertragsbefüllung und Abschluss ab. Ein E2E-Test durchläuft den vollständigen Ablauf mit fiktiven Daten und simulierten LLM-Antworten.

## 9. Bewusst später

- Portalveröffentlichung, E-Mail-Versand, Kalenderanbindung und elektronische Signatur.
- Mietpreisrecherche und rechtliche Mietpreisbewertung.
- 3D-Modelle, virtuelles Möblieren und automatische Bildinterpretation.
- Allgemeine OCR für beliebige Scans, freier Chat über alle Unterlagen und automatische Ordnerüberwachung.
- Umfangreiche Gebäudehierarchie, Mehrbenutzerbetrieb und zusätzliche Infrastruktur.

## 10. Noch anhand der späteren Daten festzulegen

- Konkrete Vertragsausgaben, Anzahl der Vorlagen, vorhandene PDF-Formularfelder und Zuordnung der Word-/PDF-Fassungen.
- Benötigte Vertragsoptionen und Anlagen anhand der gelieferten Dokumente.
- Zuordnung der Rohdateien zu Wohnungen; tatsächliche Quellen aus `informationsquellen.md`.
- Anbieter/Modell und Zugang für die LLM-Anbindung sowie lokale PDF-Konvertierung.

Diese Punkte blockieren die Planung und die Arbeit mit fiktiven Beispielen nicht. Die tatsächlichen Vertragsvorlagen und echten Quellen müssen vor ihrer produktiven Verwendung separat geprüft werden.
