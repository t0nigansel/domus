import { useTranslation } from '../i18n';
import './SiteFooter.css';

export default function SiteFooter() {
    const { t } = useTranslation();
    return <footer className="site-footer">
        <nav aria-label={t("Rechtliche Informationen")}>
            <a href="/impressum.html">{t("Impressum")}</a>
            <a href="/datenschutz.html">{t("Datenschutzerklärung")}</a>
        </nav>
        <span className="release-version">{t("Version")}{" "}{import.meta.env.VITE_APP_VERSION}</span>
    </footer>;
}
