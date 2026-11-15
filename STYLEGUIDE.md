# Domus Styleguide

Stand: 15. November 2026. Grundlage: `6b01ec8`; die anschließend lokal
umgesetzte UI-Vereinheitlichung ist in den folgenden Regeln berücksichtigt.

Dieser Guide beschreibt das Erscheinungsbild und das Verhalten von Domus. Er
verbindet den aktuellen Stil mit den bereits gewünschten UI-Regeln. Neue Masken
und Änderungen sollen dieselben Muster verwenden. Einzelne bestehende
Abweichungen sind keine neuen Designregeln und werden bei der Überarbeitung
der betreffenden Maske korrigiert.

## Zweck und Pflege

Markdown ist die verbindliche Quelle für Entscheidungen, Regeln und offene
Fragen. Die konkreten Designwerte stehen weiterhin in den CSS-Variablen und
Komponenten. Änderungen an diesen Werten und am Guide werden gemeinsam gepflegt.

Eine ergänzende HTML-Vorschau eignet sich für Farben, Schriften, Abstände und
interaktive Beispiele. Sie soll die echten Komponenten und CSS-Werte verwenden,
damit keine zweite, abweichende Designfassung entsteht. Eine solche Vorschau
ist noch nicht angelegt.

## Gestaltungsrichtung

**Verbindlicher Grundsatz: Eine saubere, minimalistische UI mit allem, was der
Benutzer für seine Aufgabe braucht, und niemals mehr.**

Jedes sichtbare Element muss eine aktuelle Aufgabe unterstützen, eine notwendige
Information vermitteln oder Orientierung geben. Elemente ohne diesen Nutzen
entfallen. Selten benötigte Angaben erscheinen im passenden Kontext oder erst
bei Bedarf. Wesentliche Informationen und häufige Aktionen bleiben direkt
erreichbar; Minimalismus darf sie nicht hinter unnötigen Klicks verstecken.

- Ruhig und übersichtlich: klare Gruppen, erkennbare Hierarchie und genügend
  Abstand zwischen unterschiedlichen Aufgaben.
- Einheitlich: dieselbe Aktion und dieselbe Art von Daten verwenden dieselben
  Komponenten, Beschriftungen und Interaktionen.
- Dunkel zuerst gestaltet; Hell und Systemeinstellung werden gleichwertig
  unterstützt. Die Systemeinstellung ist aktuell die Voreinstellung.
- Neutrale Flächen mit leichtem Navy-Anteil; Mint ist der zentrale Akzent.
- Der Kontext bleibt sichtbar: Detailansichten sollen sich möglichst innerhalb
  der Übersicht öffnen.

Die Palette ist im bestehenden Code aus der Faktio-Palette abgeleitet. Die
sichtbare Produktmarke bleibt Domus.

## Farben

Neue Oberflächen verwenden semantische Variablen aus
[src/index.css](src/index.css), keine zusätzlichen Einzelpaletten.

| Zweck | CSS-Variable | Hell | Dunkel |
| --- | --- | --- | --- |
| Seitenhintergrund | `--color-bg-base` | `#f4f5f9` | `#0f1117` |
| Karten und Listenzeilen | `--color-bg-surface` | `#ffffff` | `#171a22` |
| Haupttext | `--color-text-main` | `#16193a` | `#e6e8f0` |
| Ergänzender Text | `--color-text-muted` | `#585c78` | `#9a9fb2` |
| Akzent für Links und aktive Zustände | `--color-primary` | `#0b7a52` | `#2fd08f` |
| Mint, etwa für Fokusmarkierungen | `--color-mint` | `#2fd08f` | `#2fd08f` |
| Hintergrund primärer Buttons | `--color-btn-bg` | `#16193a` | `#dfe2ee` |
| Text primärer Buttons | `--color-btn-fg` | `#ffffff` | `#12141c` |
| Trennlinien und Kartenrahmen | `--color-border` | `#e2e4ee` | `#272b37` |
| Rahmen von Eingabefeldern | `--color-field-border` | `#868aa5` | `#666c80` |

Mint wird im hellen Modus nicht als normaler Fließtext auf Weiß eingesetzt;
dafür dient das dunklere Grün. Warnungen, Fehler und Erfolge nutzen die
vorhandenen semantischen Farbvariablen. Ihre Bedeutung muss zusätzlich durch
Text oder ein verständlich beschriftetes Symbol erkennbar sein.

## Schrift, Abstände und Formen

Die Schriftfamilie ist `Inter` mit Systemschriften als Fallback. Der Code lädt
hierfür aktuell keine separate Inter-Schriftdatei. Fließtext verwendet eine
Zeilenhöhe von `1.5`, Überschriften `1.2` und üblicherweise Gewicht `600`.
Seitentitel sind im gemeinsamen Seitenkopf `1.875rem` groß; kompaktere
Sondermasken verwenden teilweise eine responsive Größe.

| Token | Wert | Typischer Einsatz |
| --- | --- | --- |
| `--spacing-xs` | 4 px | sehr kleine Abstände |
| `--spacing-sm` | 8 px | zusammengehörige Elemente |
| `--spacing-md` | 16 px | Formularfelder, kompakte Gruppen |
| `--spacing-lg` | 24 px | Karten, Seitenränder |
| `--spacing-xl` | 32 px | größere Abschnittsabstände |
| `--radius-sm` | 6 px | Eingabefelder |
| `--radius-md` | 8 px | Buttons und kleinere Flächen |
| `--radius-lg` | 12 px | Karten und Listenzeilen |

Diese Pixelangaben entsprechen der üblichen Basis von 16 px pro `rem`.
Zur Umsetzung werden die vorhandenen `rem`-Variablen verwendet. Rahmen sind
dezent; Schatten unterstützen die Hierarchie, statt sie zu dominieren.

## Seiten und Navigation

### Gemeinsamer Aufbau der Hauptmasken

Die Hauptmasken folgen derselben Reihenfolge:

1. **Seitenkopf:** ein eindeutiger Titel und, wenn erforderlich, eine Hauptaktion.
   Eine Beschreibung ergänzt den Titel nur, wenn sie etwas erklärt.
2. **Suche und Filter:** direkt vor dem Inhalt, soweit sie für diesen Bestand
   nützlich sind. Keine vorsorglichen Filter oder mehrfachen Suchleisten.
3. **Übersicht:** die benötigten Einträge als einheitliche Liste. Die geschlossene
   Zeile zeigt nur, was zur Identifikation und zur nächsten Entscheidung nötig ist.
4. **Details und Bearbeitung:** am ausgewählten Eintrag aufklappen. Zusätzliche
   Aufgaben und Aktionen erscheinen dort, wo ihr Objekt und Zweck klar sind.
5. **Rückmeldung:** verständliche Zustände beim Laden, bei Fehlern, bei leeren
   Ergebnissen und nach einer Aktion. Meldungen stehen bei der betroffenen Aufgabe.

Dieser Aufbau ist die Vorgabe für neue und überarbeitete Hauptmasken. Fachlich
begründete Ausnahmen werden benannt. Zusätzliche Dashboards, Kennzahlenkarten,
Erklärungstexte oder Aktionsleisten entstehen nur bei einem konkreten Bedarf.

### Breite und Orientierung

Der gemeinsame Seitencontainer hat maximal 1400 px Breite und regulär 24 px
Innenabstand. Die Desktop-Seitenleiste verwendet aktuell 260 px. Bis 700 px
Viewportbreite wechselt sie in die obere Navigation; der Inhalt hat dann keinen
linken Seitenleistenabstand.

Der Seitenkopf verwendet `PageHeader`: Titel links, Hauptaktion rechts. Das
Verhältnis von Titel und Aktion soll über die Hauptmasken gleich bleiben.
Buttons neben Abschnittsüberschriften sind vertikal mittig ausgerichtet;
Überschriftenränder dürfen sie nicht nach unten versetzen.
Auf kleinen Displays beträgt die gemeinsame Seitentitelgröße `1.5rem`.
Bis 360 px stehen Titel und Hauptaktion untereinander, damit sie nicht
überlappen oder normale Seitentitel mitten im Wort umbrechen.

Für Übersichten von Häusern und Wohnungen gilt:

- Öffnen und Schließen erfolgt in der jeweiligen Listenzeile.
- Der Benutzer bleibt in derselben Übersicht. Titel, Seitenbreite und übrige
  Einträge bleiben erhalten; beim Aufklappen entsteht kein seitlicher Versatz.
- Im Haus-/Wohnungsbereich ist jeweils nur ein Haus oder eine Wohnung geöffnet.
- Direkte URLs öffnen den passenden Eintrag in dieser Übersicht.
- Browser-Zurück und erneutes Laden stellen die Auswahl anhand der URL wieder her.
- Untergeordnete Aufgaben dürfen eine eigene Seite haben, etwa das Erstellen
  einer Nebenkostenabrechnung. Die Rückkehr zum Objekt bleibt eindeutig.

## Listen, Karten und Detailbereiche

### Aussehen der Elemente

| Element | Gestaltungsregel |
| --- | --- |
| Listenzeile | Neutrale Fläche, dezenter Rahmen, klarer Titel; wenige ergänzende Angaben |
| Karte | Fasst eine zusammengehörige Aufgabe zusammen; kein zusätzlicher Rahmen nur zur Dekoration |
| Primärer Button | Für die wichtigste Aktion im jeweiligen Kontext; klarer Text mit Verb |
| Sekundärer Button | Zurückhaltende Umrandung; geringere optische Gewichtung |
| Eingabefeld | Beschriftung darüber, einheitliche Höhe und Rahmen, sichtbarer Fokus |
| Badge | Kurzer Status oder entscheidungsrelevanter Wert; keine Sammlung aller verfügbaren Daten |
| Icon | Einheitliche bestehende Lucide-Icons; ergänzt Bedeutung, statt sie allein zu tragen |
| Trennlinie | Trennt inhaltlich unterschiedliche Gruppen; ersetzt keinen sinnvollen Abstand |

Neue Elemente übernehmen die vorhandenen Farben, Radien und Abstände. Zusätzliche
Farben, Schatten, Animationen und verschachtelte Karten benötigen einen konkreten
Nutzen. Die gleiche Bedeutung erhält über alle Masken dieselbe Darstellung.

### Verhalten

Übersichten verwenden `List` und `ListRow` aus
[src/components/common/ListRow.jsx](src/components/common/ListRow.jsx).
Titel, Untertitel, ergänzende Angaben und Aufklappaktion haben feste Rollen.
Aufgeklappte Zeilen werden dezent mit der Akzentfarbe markiert.

Ein Detailbereich nutzt die Breite seiner Elternzeile. Ein zusätzlicher
zentrierter Seitencontainer innerhalb der Zeile ist zu vermeiden. Verschachtelte
Aufklappaktionen müssen unabhängig voneinander ihren Zustand anzeigen.

Wohnungsdetails verwenden Tabs für ihre Teilbereiche. Häuser verwenden aktuell
gruppierte Abschnitte innerhalb der geöffneten Zeile; eine zusätzliche
Tab-Struktur für Häuser ist bisher nicht festgelegt.

Fotos und Dokumente sollen bei Häusern und Wohnungen dieselbe Dateiverwaltung
verwenden: Suche, Kategorien, Upload, Fotogalerie, Bearbeiten und Download.
Ohne Dateien zeigt der Bereich nur den Leerhinweis und die Upload-Aktion.
Kategoriefilter werden auf tatsächlich vorhandene Kategorien begrenzt; ein
bereits gewählter Filter bleibt zum Zurücksetzen sichtbar, auch wenn er keine
Treffer mehr hat. Upload-Bereiche besitzen eine sichtbare Schließen-Aktion.

Im Haus sind Wohnungszuordnungen und Kosten zunächst als Informationen sichtbar.
„Zuordnung verwalten“ und „Kosten bearbeiten“ öffnen die Verwaltungsfelder;
„Fertig“ schließt diese wieder. Zuordnungen werden bei ihrer Änderung unmittelbar
gespeichert; die Kostenzeiträume besitzen weiterhin eigene Speichern-Aktionen.

## Formulare und Aktionen

- Beschriftungen stehen oberhalb der Eingabefelder, Hinweise darunter.
- Felder besitzen innerhalb derselben Gruppe einheitliche Höhen, Breiten und
  Abstände sowie die vorhandenen Farben und Rahmen.
- Die gemeinsamen Feldstile stehen zentral in `src/index.css`: mindestens
  44 px Höhe, 10 px Innenabstand, `0.875rem` Schriftgröße und semantischer
  Feldrahmen. Mehrzeilige Textfelder dürfen höher sein. Beschriftungen sind
  technisch mit ihrem Eingabefeld verknüpft.
- Zusammengehörige Angaben werden gruppiert. Im Mietformular sind dies etwa
  „Mietzeitraum“ sowie „Miete und Kaution“.
- Das Raster folgt dem Inhalt: zwei Spalten für Beginn und Ende, drei für die
  Mietbeträge, ganze Zeilen für längere Angaben. Bis 600 px stehen die
  Mietformularfelder untereinander.
- Optionale Angaben dürfen das Speichern nicht blockieren. Pflichtangaben
  müssen verständlich benannt sein; ungültige Eingaben bleiben prüfbar.
- „Speichern“ ist die normale Beschriftung für das Speichern eines Formulars.
  Eine konkrete andere Aktion erhält ein konkretes Verb, etwa „Haus anlegen“.
- Primäre Aktion und Abbrechen stehen zusammen am Formularende. Während des
  Speicherns werden Mehrfachaufrufe verhindert; Fehler erscheinen sichtbar am
  betroffenen Formular. Erfolg muss erkennbar sein.
- Aufklappbare Eingabepanels besitzen zusätzlich eine beschriftete
  Schließen-Aktion am Panelkopf. Hausformulare bieten „Speichern“ und „Abbrechen“;
  Abbrechen verwirft den geöffneten Hausentwurf.
- Eine zusätzliche Ebene wie „Weitere Aktionen“ wird weggelassen, wenn sie
  lediglich eine einzige bereits eindeutig benannte Aufklappaktion enthält.

Im Mietverhältnis ist bei ausgewählter Vertragspartei nur der Mietbeginn
erforderlich. Vertragsdatei, Geldbeträge und weitere Angaben können später
ergänzt werden. Fehlende Beträge sind unbekannt und werden nicht als null Euro
ausgegeben. Eine gespeicherte Kennzeichnung ohne Mietverhältnis darf einen
aktuellen aktiven Mietvertrag nicht überstimmen.

## Responsive Darstellung und Bedienbarkeit

Hauptaktionen, Formulare und Aufklappschalter sollen mindestens 44 px hohe
Bedienflächen bieten. Die Tab-Reihenfolge muss nachvollziehbar und der
Tastaturfokus sichtbar sein. Icons mit einer Aktion brauchen einen zugänglichen
Namen; eine Farbe oder ein Icon allein ersetzt keine Statusbeschreibung.

Inhalte passen sich schmalen Ansichten an. Formularraster werden einspaltig,
Aktionsgruppen dürfen umbrechen. Lange Namen und Adressen dürfen keinen
horizontalen Seitenüberlauf erzeugen. Aktionswörter sollen nicht mitten im Wort
abbrechen. Größere Änderungen werden auf Desktop und Smartphone sowie in beiden
Farbmodi geprüft.

Die vorhandenen Breakpoints sind auf einzelne Komponenten verteilt. Sie bilden
noch kein einheitliches, globales Breakpoint-System. Neue Ausnahmen werden nur
eingeführt, wenn die bestehenden Muster den Inhalt nicht sinnvoll abbilden.

## Bereits geäußerte und umgesetzte Wünsche

| Entscheidung | Festgelegtes Verhalten |
| --- | --- |
| Vermietung gehört zur Wohnung | Verwaltung des Mietverhältnisses im Wohnungskontext |
| Wohnungen konsistent öffnen | In der Übersicht aufklappen, keine seitliche Inhaltsverschiebung |
| Häuser wie Wohnungen öffnen | Dieselbe Übersicht und Breite, aufklappbare Hauszeilen |
| Ruhigere Mietformulare | Gruppen, gleichmäßige Felder und Beschriftungen oberhalb |
| Weniger unnötige Ebenen | Mietende direkt erreichbar, ohne äußeres „Weitere Aktionen“ |
| Unvollständige Erfassung ermöglichen | Optionale Vertragsangaben erlauben; Button „Speichern“ |
| Hausdateien wie Wohnungsdateien | Gemeinsame Foto- und Dokumentenverwaltung |
| Überschrift und Button ausrichten | „Häuser“ und „Haus anlegen“ vertikal passend ausrichten |

## Neue Wünsche und offene Entscheidungen

Die folgenden Wünsche wurden ausdrücklich benannt und sind als Regeln in diesem
Guide aufgenommen:

| Wunsch | Status | Umsetzung im Guide |
| --- | --- | --- |
| Einheitlicher Aufbau der Hauptmasken | Vereinbart | Seitenkopf, bedarfsgerechte Suche/Filter, Übersicht, Details und Rückmeldung |
| Einheitliches Aussehen der Elemente | Vereinbart | Gemeinsame Komponenten, Tokens und visuelle Rollen |
| Saubere minimalistische UI mit allem Nötigen und niemals mehr | Vereinbart | Jedes sichtbare Element braucht einen konkreten Nutzen |

„Vereinbart“ beschreibt die Designvorgabe und bedeutet keine vollständige
Überarbeitung aller bestehenden Masken.

### Sinnvolle Ergänzungen zur Abstimmung

- **Informationsmenge:** Welche Angaben müssen je Hauptmaske bereits in der
  geschlossenen Zeile sichtbar sein, welche erst nach dem Öffnen?
- **Zustände:** Ein gemeinsames Muster für leere Bestände, keine Suchtreffer,
  Laden, Fehler und Erfolg; jeweils nur die nötige Erklärung und nächste Aktion.
- **Sprache:** Kurze, konkrete Begriffe, konsistente Ansprache und eindeutige
  Aktionsnamen. Technische Details nur, wenn sie dem Benutzer eine Entscheidung
  ermöglichen.
- **Bedienung:** Einheitliches Verhalten für Speichern, Abbrechen,
  ungespeicherte Änderungen und das Zurückkehren zur Übersicht.
- **Darstellung:** Verbindliche Beispiele für Desktop, Smartphone, Hell und
  Dunkel, einschließlich Tastaturfokus und gut lesbarer Zustände.

Die zusätzlichen Detailentscheidungen sind Vorschläge; sie wurden noch nicht
als konkrete Ausgestaltung jeder Maske festgelegt.

Für jede neue Idee halten wir fest: den Wunsch, ein konkretes Beispiel, den
betroffenen Bereich, den Status „Idee“, „vereinbart“ oder „umgesetzt“ und das
Ergebnis. Erst vereinbarte Wünsche werden verbindliche Regeln. Der Guide soll
Entscheidungen festhalten, ohne offene Ideen als bereits beschlossen darzustellen.

## Quellen im Projekt

- [Designvariablen und gemeinsame Seitenstile](src/index.css)
- [Theme und Systemeinstellung](src/context/ThemeContext.jsx)
- [Navigation und responsives Hauptlayout](src/layouts/MainLayout.css)
- [Gemeinsame Listen](src/components/common/ListRow.jsx)
- [Mietformulare](src/pages/Rentals.css)
- [Wohnungsdetails](src/pages/PropertyDetails.jsx)
- [Hausübersicht und Hausdetails](src/pages/Buildings.jsx)
- [Formular- und Assistentenflächen](src/pages/Assistants.css)
- [Bisherige UI-Prinzipien für Komponenten](src/components/AGENT.md)
