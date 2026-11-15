import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { api } from '../utils/api';

export function McpConnections() {
    const { t } = useTranslation();
    const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { let active = true;
        api.get('/mcp/connections').then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, []);
    return <section className="assistant-card">
        <h2>{t('KI-Assistenten über MCP')}</h2>
        <p>{t('Verbinde deinen Assistenten mit dieser MCP-Adresse. Du meldest dich mit deinem Domus-Konto an und erlaubst ausschließlich Lesen und Auswerten.')}</p>
        {data && <p><code>{data.url}</code></p>}
        <p className="text-muted">{t('Dabei erhält der KI-Anbieter des verbundenen Assistenten Zugriff auf deine Immobilien-, Mieter- und Dokumentendaten. Änderungen und Versand sind nicht möglich.')}</p>
        {error && <p role="alert">{error}</p>}
        {data && !data.connections.length && <p>{t('Keine Assistenten verbunden.')}</p>}
        {data?.connections.map(connection => <div className="assistant-row" key={connection.id}>
            <span>{connection.name} · {t('Nur Lesen')}</span>
            <button type="button" className="btn-outline" disabled={busy} onClick={async () => {
                setBusy(true); setError('');
                try { await api.delete(`/mcp/connections/${encodeURIComponent(connection.id)}`); setData(await api.get('/mcp/connections')); }
                catch (err) { setError(err.message); }
                finally { setBusy(false); }
            }}>{t('Verbindung trennen')}</button>
        </div>)}
    </section>;
}

export function McpConsent() {
    const { t } = useTranslation();
    const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const query = window.location.search.slice(1);
    useEffect(() => {
        let active = true;
        api.get(`/mcp/consent?oauth_query=${encodeURIComponent(query)}`).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [query]);
    async function decide(accept) {
        setBusy(true); setError('');
        try {
            const response = await fetch('/api/auth/oauth2/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept, oauth_query: query }) });
            const result = await response.json();
            if (!response.ok || !result.redirect || !result.url) throw new Error(t('Die Verbindung konnte nicht freigegeben werden.'));
            window.location.assign(result.url);
        } catch (err) { setError(err.message); setBusy(false); }
    }
    return <main className="cloud-welcome"><section className="cloud-auth">
        <h1>{t('Assistent mit Domus verbinden')}</h1>
        {error && <p role="alert" className="auth-error">{error}</p>}
        {!data && !error && <p role="status">{t('Lädt …')}</p>}
        {data && <>
            <p><strong>{data.name}</strong> ({data.redirectHost})</p>
            <p>{t('Dieser Assistent darf deine Wohnungen, Mietverhältnisse, Mieter, Kosten, Schäden und Dokumente lesen und auswerten. Er darf nichts ändern oder versenden.')}</p>
            <p>{t('Dabei werden auch personenbezogene Mieterdaten und Dokumenteninhalte an den KI-Anbieter des Assistenten übermittelt. Du kannst den Zugriff jederzeit in den Einstellungen widerrufen.')}</p>
            {data.scopes.includes('offline_access') && <p>{t('Die Verbindung bleibt nach deiner Abmeldung bestehen, bis du sie trennst.')}</p>}
            <div className="rental-actions"><button className="btn-primary" disabled={busy} onClick={() => decide(true)}>{t('Lesezugriff erlauben')}</button><button className="btn-outline" disabled={busy} onClick={() => decide(false)}>{t('Ablehnen')}</button></div>
        </>}
    </section></main>;
}
