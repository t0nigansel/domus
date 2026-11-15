import { useTranslation } from '../i18n';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronUp, Languages, LogOut, SunMoon } from 'lucide-react';
import { useCloudAuth } from '../context/CloudAuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import './AccountMenu.css';

export default function AccountMenu() {
    const { t, language, setLanguage } = useTranslation();
    const auth = useCloudAuth();
    const { appearance, setAppearance } = useTheme();
    const menu = useRef(null);
    const id = useId();
    const [preferenceError,setPreferenceError]=useState('');
    const savePreference=(key,value)=>{
        const apply=()=>{if(key==='appearance')setAppearance(value);else setLanguage(value);};
        if(auth)api.get('/settings').then(settings=>api.put('/settings',{...settings,appearance,language,[key]:value})).then(apply).catch(()=>{apply();setPreferenceError(t('Die Einstellung konnte nicht im Konto gespeichert werden.'));});
        else apply();
    };
    const accountName = auth?.account.name || t('Lokale Nutzung');
    const userName = auth?.user.name || accountName;
    const initials = userName.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('de-DE') || 'D';

    useEffect(() => {
        function closeOutside(event) {
            if (menu.current && !menu.current.contains(event.target)) menu.current.open = false;
        }
        function closeOnEscape(event) {
            if (event.key === 'Escape' && menu.current?.open) {
                menu.current.open = false;
                menu.current.querySelector('summary').focus();
            }
        }
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, []);

    return <details className="account-menu" ref={menu} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
        <summary className="account-menu-trigger" aria-label={t('Kontomenü für {name}', { name: accountName })} aria-controls={`${id}-panel`}>
            <span className="account-menu-avatar" aria-hidden="true">{initials}</span>
            <span className="account-menu-label">{accountName}</span>
            <ChevronUp size={18} className="account-menu-chevron" aria-hidden="true" />
        </summary>
        <div className="account-menu-panel" id={`${id}-panel`}>
            <Link className="btn-outline" to="/settings" onClick={()=>{ if(menu.current)menu.current.open=false; }}>{t('Einstellungen')}</Link>
            <div className="account-menu-profile">
                <p className="account-menu-name">{userName}</p>
                {auth && <p className="account-menu-email">{auth.user.email}</p>}
            </div>
            <div className="account-menu-appearance">
                <SunMoon size={18} aria-hidden="true" />
                <label htmlFor={`${id}-appearance`}>{t("Darstellung")}</label>
                <select id={`${id}-appearance`} value={appearance} onChange={event => savePreference('appearance',event.target.value)}>
                    <option value="system">{t("System")}</option>
                    <option value="light">{t("Hell")}</option>
                    <option value="dark">{t("Dunkel")}</option>
                </select>
            </div>
            <div className="account-menu-appearance">
                <Languages size={18} aria-hidden="true" />
                <label htmlFor={`${id}-language`}>{t('Sprache')}</label>
                <select id={`${id}-language`} value={language} onChange={event => savePreference('language',event.target.value)}>
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                </select>
            </div>
            {preferenceError && <p role="alert">{preferenceError}</p>}
            {auth && <div className="account-menu-signout">
                {auth.error && <p role="alert" className="account-menu-error">{t(auth.error)}</p>}
                <button type="button" onClick={auth.signOut} disabled={auth.signingOut}>
                    <LogOut size={18} aria-hidden="true" />
                    <span>{auth.signingOut ? t("Abmelden …") : t("Abmelden")}</span>
                </button>
            </div>}
        </div>
    </details>;
}
