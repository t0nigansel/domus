import { useTranslation } from '../i18n';
import './LegalPage.css';

function OperatorContact() {
    const { t } = useTranslation();
    return <>
        <p><strong>Toni Gansel</strong><br />Am Kirchbrunnen 18<br />38446 Wolfsburg<br />{t("Deutschland")}</p>
        <p>{t("E-Mail")}{" "}<a href="mailto:info@faktio.net">info@faktio.net</a><br />{t("Telefon")}{" "}<a href="tel:+4915126913280">+49 151 269 132 80</a></p>
    </>;
}

export default function LegalPage({ page }) {
    const { t } = useTranslation();
    const privacy = page === 'datenschutz';
    const title = t(privacy ? 'Datenschutzerklärung' : 'Impressum');
    return <main className="legal-page">
        <title>{title}{" "}{t("· Domus")}</title>
        <meta name="robots" content="noindex" />
        <a className="legal-back" href="/">{t("← Zurück zu Domus")}</a>
        <h1>{title}</h1>
        {privacy ? <PrivacyPolicy /> : <>
            <h2>{t("Betreiber von Domus")}</h2>
            <OperatorContact />
            <p>{t("Für Datenschutzanfragen kannst du die oben genannte E-Mail-Adresse verwenden.")}</p>
            <p><a href="/datenschutz.html">{t("Datenschutzerklärung")}</a></p>
        </>}
    </main>;
}

function PrivacyPolicy() {
    const { t } = useTranslation();
    return <>
        <p className="legal-date">{t("Stand 13. November 2026")}</p>
        <p>{t("Domus unterstützt die Verwaltung von Immobilien, Mietern, Vermietungen und Unterlagen. Hier erfährst du, welche Daten dabei verarbeitet werden und wie du deine Rechte wahrnehmen kannst.")}</p>

        <h2>{t("1. Verantwortlicher und Kontakt")}</h2>
        <OperatorContact />
        <p>{t("Dieser Kontakt gilt für den Betrieb von Domus und für Datenschutzanfragen. Die Faktio-Adresse wird vorläufig auch für Domus verwendet.")}</p>

        <h2>{t("2. Kontodaten und Immobilienverwaltung")}</h2>
        <p>{t("Für Registrierung und Anmeldung verarbeiten wir deinen Namen, deine E-Mail-Adresse, den Passwort-Hash, den Bestätigungsstatus, Sitzungen und deine Kontomitgliedschaft. Hinzu kommen Vorgänge zur E-Mail-Bestätigung und zum Zurücksetzen des Passworts.")}</p>
        <p>{t("Zur Immobilienverwaltung werden die von dir eingegebenen Angaben zu Wohnungen, Eigentums- und Ausstattungsmerkmalen, Mietern und Kontakten, Bewerbungen, Besichtigungen, Mietverhältnissen, Anliegen und Kosten sowie hochgeladene Fotos und Dokumente verarbeitet. Dazu können Namen, Kontaktdaten, Mietzeiträume, Vertragsparteien, Mietbeträge und Zahlungsangaben gehören.")}</p>
        <p>{t("Die Kontoverwaltung und die Bereitstellung der angeforderten Funktionen beruhen auf Art. 6 Abs. 1 Buchstabe b DSGVO. Sicherheitsmaßnahmen und die Abwehr missbräuchlicher Zugriffe dienen unserem berechtigten Interesse an einem sicheren Dienst nach Art. 6 Abs. 1 Buchstabe f DSGVO.")}</p>
        <p>{t("Für die personenbezogenen Daten deiner Mieter, Bewerber und anderer Personen, die du zur eigenen Immobilienverwaltung eingibst, bestimmst du die Zwecke der Verarbeitung und die dafür erforderliche Rechtsgrundlage. Bei einer Nutzung für weitere Vermieter ist die Auftragsverarbeitung nach Art. 28 DSGVO mit dem Betreiber zu regeln.")}</p>
        <p>{t("Die erforderlichen Zugangsdaten ermöglichen dein Konto. Welche weiteren Inhalte du eingibst oder hochlädst, bestimmst du selbst.")}</p>

        <h2>{t("3. Hosting, Datenbank, Dateien und Protokolle")}</h2>
        <p>{t("Die Website und die Anwendung werden über Cloudflare betrieben. Dabei können IP-Adresse, Zeitpunkt, angefragte Adresse, Browserinformationen sowie Verbindungs- und Fehlerdaten verarbeitet werden. Cloudflare übernimmt die Auslieferung der Anwendung, die Verbindung zur Datenbank und den Schutz der Infrastruktur.")}</p>
        <p>{t("Kontodaten und Fachdaten werden in einer PostgreSQL-Datenbank bei Neon (Databricks) am gewählten Standort Frankfurt am Main gespeichert. Hochgeladene Dateien liegen in einem privaten Cloudflare-R2-Bucket mit EU-Jurisdiktion. Downloads werden nach Prüfung der Anmeldung und Kontozuordnung bereitgestellt.")}</p>
        <p>{t("Zur Zugriffssicherung werden Zähler für Anfragelimits in der Datenbank geführt. Bei Änderungen protokolliert Domus Konto, Nutzerkennung, Zeitpunkt, Aktion und betroffenen Datenbereich. Diese Verarbeitung dient der Sicherheit und Nachvollziehbarkeit auf Grundlage von Art. 6 Abs. 1 Buchstabe f DSGVO.")}</p>
        <p>{t("Cloudflare und Neon gehören zu US-Unternehmen. Insbesondere technische Daten können auch außerhalb der EU beziehungsweise des EWR verarbeitet werden. Informationen zu den Anbietern und ihren Übermittlungsgarantien stehen im Cloudflare Data Processing Addendum und in den Neon-Vertragsbedingungen einschließlich der darin einbezogenen Databricks-Bedingungen. Auskünfte zu den konkret für Domus geltenden Vereinbarungen erhältst du beim Verantwortlichen.")}</p>
        <p className="legal-sources"><a href="https://www.cloudflare.com/cloudflare-customer-dpa/">{t("Cloudflare Data Processing Addendum")}</a> · <a href="https://neon.com/platform-terms">{t("Neon-Vertragsbedingungen")}</a></p>

        <h2>{t("4. E-Mails und Kontaktanfragen")}</h2>
        <p>{t("E-Mail-Bestätigungen und Passwort-Reset-Links werden über Cloudflare Email Service verschickt. Dabei werden Empfängeradresse, Nachrichteninhalt und technische Zustellinformationen verarbeitet. Der vorläufige Absender ist no-reply@faktio.net.")}</p>
        <p>{t("Nachrichten an info@faktio.net werden über Cloudflare Email Routing an das Outlook-Postfach des Betreibers bei Microsoft weitergeleitet. Zur Bearbeitung verarbeiten wir deine Kontaktangaben und den Inhalt deiner Nachricht. Dabei kann eine Verarbeitung außerhalb des EWR stattfinden. Bitte sende die zur Klärung erforderlichen Angaben.")}</p>
        <p>{t("Die Bearbeitung erfolgt je nach Anliegen auf Grundlage von Art. 6 Abs. 1 Buchstabe b oder f DSGVO und bei gesetzlichen Datenschutzpflichten auf Grundlage von Buchstabe c.")}</p>
        <p className="legal-sources"><a href="https://www.microsoft.com/de-de/privacy/privacystatement">{t("Microsoft-Datenschutzbestimmungen")}</a></p>

        <h2>{t("5. Cookies und Browserspeicher")}</h2>
        <p>{t("Domus verwendet technisch notwendige Anmelde-Cookies von Better Auth. Das Cookie")}{" "}<code>__Secure-better-auth.session_token</code>{" "}{t("ordnet die Anmeldung einer Sitzung zu. Eine Sitzung gilt regulär sieben Tage und kann bei weiterer Nutzung verlängert werden. Beim Abmelden wird die aktuelle Sitzung ungültig. Ein Passwort-Reset beendet bestehende Anmeldungen.")}</p>
        <p>{t("Deine Wahl zwischen heller, dunkler oder der Systemdarstellung wird unter")}{" "}<code>domus-theme</code>{" "}{t("im lokalen Browserspeicher abgelegt, bis du die Wahl änderst oder die Browserdaten löschst. Bei Systemdarstellung folgt Domus den Darstellungseinstellungen deines Geräts.")}</p>
        <p>{t('Deine gewählte UI-Sprache wird unter')}{' '}<code>domus-language</code>{' '}{t('lokal in deinem Browser gespeichert, bis du die Sprache änderst oder die Browserdaten löschst.')}</p>
        <p>{t("Diese Speicherungen dienen der von dir angeforderten Anmeldung und Darstellungswahl nach § 25 Abs. 2 Nr. 2 TDDDG. Die anschließende Verarbeitung beruht auf Art. 6 Abs. 1 Buchstabe b beziehungsweise f DSGVO. Domus verwendet keine Werbe- oder Analyse-Tracker.")}</p>

        <h2>{t("6. Speicherdauer, Dateien und Löschanfragen")}</h2>
        <p>{t("Konto- und Verwaltungsdaten werden grundsätzlich für die Dauer der Nutzung gespeichert. Bestätigungslinks gelten 24 Stunden, Passwort-Reset-Links eine Stunde. Der Ablauf eines Links führt zur Ungültigkeit dieses Links und bewirkt keine Löschung sämtlicher zugehöriger Datenbankeinträge.")}</p>
        <p>{t("Für technische Protokolle gelten die Speicherfristen der genutzten Dienste und Betriebseinstellungen. Auskunft über die konkret für deine Daten geltende Dauer erhältst du beim Verantwortlichen. Soweit gesetzliche Pflichten oder die Klärung konkreter Ansprüche eine weitere Aufbewahrung erfordern, werden die betroffenen Daten entsprechend länger gespeichert.")}</p>
        <p>{t("Für die Wartung, Bestandsübernahme und Wiederherstellung können geschützte lokale Kopien beim Betreiber bestehen. Bei einer Löschanfrage werden auch diese Kopien und die anwendbaren Aufbewahrungspflichten berücksichtigt. R2-Dateien ohne zugehörigen Datenbankeintrag werden durch einen täglichen Bereinigungslauf frühestens nach 24 Stunden entfernt.")}</p>
        <p>{t("Eine automatische Kontolöschung steht in der aktuellen Pilotversion noch aus. Für Löschung, Berichtigung, Einschränkung oder die Herausgabe deiner Daten wende dich an den Verantwortlichen. Für die Aufbewahrung der von dir verwalteten Miet- und Geschäftsunterlagen gelten die jeweils anwendbaren Pflichten.")}</p>

        <h2>{t("7. Automatisierte Entscheidungen")}</h2>
        <p>{t("Domus trifft keine automatisierten Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung und führt kein darauf gerichtetes Profiling durch.")}</p>

        <h2>{t("8. Deine Rechte")}</h2>
        <p>{t("Im Rahmen der gesetzlichen Voraussetzungen hast du Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit. Eine erteilte Einwilligung kannst du für die Zukunft widerrufen.")}</p>
        <p>{t("Gegen eine Verarbeitung aufgrund von Art. 6 Abs. 1 Buchstabe f DSGVO kannst du aus Gründen deiner besonderen Situation Widerspruch einlegen. Nutze dafür die oben genannte Kontaktadresse.")}</p>
        <p>{t("Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren. Für den Betreiber in Niedersachsen ist dies insbesondere der Landesbeauftragte für den Datenschutz Niedersachsen.")}</p>
        <p className="legal-sources"><a href="https://www.lfd.niedersachsen.de/beschwerde">{t("Beschwerde beim Landesbeauftragten für den Datenschutz Niedersachsen")}</a> · <a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=de">{t("Datenschutz-Grundverordnung")}</a></p>
    </>;
}
