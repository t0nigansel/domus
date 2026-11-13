import { useTranslation } from './i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import App from './App';
import { CloudAuthContext } from './context/CloudAuthContext';
import { advanceApiSession } from './utils/api';
import DomusLogo from './components/DomusLogo';
import './CloudApp.css';

const authErrors = {
    INVALID_EMAIL_OR_PASSWORD: 'E-Mail-Adresse oder Passwort stimmen nicht.',
    EMAIL_NOT_VERIFIED: 'Bitte bestätige zuerst deine E-Mail-Adresse. Du kannst den Link unten erneut anfordern.',
    INVALID_TOKEN: 'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.',
    TOKEN_EXPIRED: 'Dieser Link ist abgelaufen. Bitte fordere einen neuen an.',
    PASSWORD_TOO_SHORT: 'Bitte verwende mindestens 12 Zeichen für dein Passwort.',
};

async function authRequest(path, input) {
    const response = await fetch(`/api/auth/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    const result = await response.json();
    if (!response.ok) {
        const message = response.status === 429 ? 'Zu viele Versuche. Bitte versuche es später erneut.'
            : authErrors[result.code] || (response.status === 403 ? 'Die Registrierung ist derzeit nur für freigeschaltete E-Mail-Adressen möglich.' : 'Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es erneut.');
        throw new Error(message);
    }
    return result;
}

export default function CloudApp() {
    const { t } = useTranslation();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const [signingOut, setSigningOut] = useState(false);
    const generation = useRef(0);
    const loadSession = useCallback(async () => {
        const version = generation.current;
        const response = await fetch('/api/session', { cache: 'no-store' });
        if (version !== generation.current) return;
        if (response.status === 401) { advanceApiSession(); setSession(null); return; }
        if (!response.ok) throw new Error('Dein Zugang konnte gerade nicht geladen werden. Bitte versuche es erneut.');
        const result = await response.json();
        if (version === generation.current) setSession(result);
    }, []);

    useEffect(() => {
        let active = true;
        async function start() {
            try {
                const response = await fetch('/api/access', { cache: 'no-store' });
                if (!response.ok) throw new Error('Domus ist gerade nicht erreichbar.');
                const access = await response.json();
                if (!active) return;
                setReady(access.ready);
                if (access.ready) await loadSession();
            } catch (err) { if (active) setError(err.message); }
            finally { if (active) setLoading(false); }
        }
        start();
        return () => { active = false; };
    }, [loadSession]);

    useEffect(() => {
        if (!session) return;
        const expired = () => { generation.current++; advanceApiSession(); setSession(null); };
        const refresh = () => loadSession().catch(err => setError(err.message));
        window.addEventListener('domus:unauthorized', expired);
        window.addEventListener('focus', refresh);
        const timer = window.setInterval(refresh, 60000);
        return () => {
            window.removeEventListener('domus:unauthorized', expired);
            window.removeEventListener('focus', refresh);
            window.clearInterval(timer);
        };
    }, [session, loadSession]);

    async function signOut() {
        setSigningOut(true); setError('');
        try {
            await authRequest('sign-out', {});
            generation.current++;
            advanceApiSession();
            setSession(null);
        } catch (err) { setError(err.message); }
        finally { setSigningOut(false); }
    }

    if (loading) return <main className="cloud-welcome"><p role="status">{t("Domus wird geladen …")}</p></main>;
    if (session) return <CloudAuthContext.Provider value={{ ...session, signOut, signingOut, error }}>
        <App key={`${session.user.id}:${session.account.id}`} />
    </CloudAuthContext.Provider>;
    return <main className="cloud-welcome">
        <section className="cloud-auth" aria-label={t("Domus-Zugang")}>
            <DomusLogo size={48} className="cloud-logo" />
            <p className="cloud-brand">DOMUS</p>
            {ready ? <AuthForm onLogin={async () => { generation.current++; advanceApiSession(); await loadSession(); }} /> : <>
                <h1>{t("Deine Immobilien.")}<br />{t("Alles an einem Ort.")}</h1>
                <p>{t("Der Zugang wird vorbereitet.")}</p>
            </>}
            {error && <p className="auth-error" role="alert">{t(error)}</p>}
            {!ready && error && <button className="btn-outline" onClick={() => window.location.reload()}>{t("Erneut versuchen")}</button>}
        </section>
    </main>;
}

function AuthForm({ onLogin }) {
    const { t } = useTranslation();
    const query = new URLSearchParams(window.location.search);
    const [mode, setMode] = useState(query.get('auth') === 'reset' ? 'reset' : 'login');
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(query.has('error') ? 'Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.' : '');
    const [message, setMessage] = useState(query.get('verified') === '1' ? 'Deine E-Mail-Adresse ist bestätigt. Du kannst dich jetzt anmelden.' : '');
    const titles = { login: 'Bei Domus anmelden', register: 'Zugang erstellen', forgot: 'Passwort zurücksetzen', reset: 'Neues Passwort setzen' };

    function changeMode(next) {
        setMode(next); setError(''); setMessage(''); setPassword('');
        if (mode === 'reset') window.history.replaceState(null, '', window.location.pathname);
    }

    async function perform(action) {
        setBusy(true); setError(''); setMessage('');
        try { await action(); }
        catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }

    function submit(event) {
        event.preventDefault();
        return perform(async () => {
            if (mode === 'login') {
                await authRequest('sign-in/email', { email, password });
                await onLogin();
            } else if (mode === 'register') {
                await authRequest('sign-up/email', { email, password, name, callbackURL: `${window.location.origin}/?verified=1` });
                setMessage('Wenn deine Adresse für den Pilot freigeschaltet ist, erhältst du eine E-Mail. Bitte bestätige den Link und melde dich anschließend an.');
                setPassword('');
            } else if (mode === 'forgot') {
                await authRequest('request-password-reset', { email, redirectTo: `${window.location.origin}/?auth=reset` });
                setMessage('Wenn ein Zugang zu dieser Adresse besteht, erhältst du einen Link zum Zurücksetzen. Bitte prüfe auch den Spamordner.');
            } else {
                const token = query.get('token');
                if (!token) throw new Error('Der Reset-Link ist unvollständig. Bitte fordere einen neuen Link an.');
                await authRequest('reset-password', { token, newPassword: password });
                changeMode('login');
                setMessage('Dein Passwort wurde geändert. Bitte melde dich mit dem neuen Passwort an.');
            }
        });
    }

    return <>
        <h1>{t(titles[mode])}</h1>
        {mode === 'register' && <p>{t("Für eingeladene Pilotnutzer. Dein Verwaltungskonto startet leer.")}</p>}
        <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <label>{t("Name")}<input autoComplete="name" maxLength={200} value={name} onChange={event => setName(event.target.value)} required disabled={busy} /></label>}
            {mode !== 'reset' && <label>{t("E-Mail-Adresse")}<input type="email" autoComplete="username" maxLength={250} value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} /></label>}
            {mode !== 'forgot' && <label>{t("Passwort")}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />{mode !== 'login' && <small>{t("Mindestens 12 Zeichen")}</small>}</label>}
            {error && <p role="alert" className="auth-error">{t(error)}</p>}
            {message && <p role="status" className="auth-message">{t(message)}</p>}
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? t("Bitte warten …") : { login: t("Anmelden"), register: t("Registrieren"), forgot: t("Reset-Link anfordern"), reset: t("Passwort speichern") }[mode]}</button>
        </form>
        <div className="auth-links">
            {mode === 'login' ? <>
                <button onClick={() => changeMode('forgot')} disabled={busy}>{t("Passwort vergessen?")}</button>
                <button onClick={() => changeMode('register')} disabled={busy}>{t("Eingeladen? Zugang erstellen")}</button>
            </> : <button onClick={() => changeMode('login')} disabled={busy}>{t("Zur Anmeldung")}</button>}
            {['login', 'register'].includes(mode) && <button disabled={busy || !email} onClick={() => perform(async () => {
                await authRequest('send-verification-email', { email, callbackURL: `${window.location.origin}/?verified=1` });
                setMessage('Falls deine Adresse noch nicht bestätigt ist, erhältst du einen neuen Bestätigungslink.');
            })}>{t("Bestätigungslink erneut senden")}</button>}
            {mode === 'reset' && <button disabled={busy} onClick={() => changeMode('forgot')}>{t("Neuen Reset-Link anfordern")}</button>}
        </div>
    </>;
}
