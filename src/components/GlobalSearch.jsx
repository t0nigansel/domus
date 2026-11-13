import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useData } from '../context/DataContext';
import './GlobalSearch.css';

const MAX_PER_GROUP = 5;
const matches = (query, ...fields) => fields.some(field => typeof field === 'string' && field.toLowerCase().includes(query));

// Sidebar search across everything the app already holds in memory; no server round trip.
export default function GlobalSearch() {
    const { t } = useTranslation();
    const { properties, tenants, contacts, documents, issues } = useData();
    const [query, setQuery] = useState('');

    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        const propertyName = id => properties.find(p => p.id === id)?.name || '';
        return [
            ['Wohnungen', properties.filter(p => matches(q, p.name, p.address)).map(p => ({ id: p.id, label: p.name, hint: p.address, to: `/properties/${p.id}` }))],
            ['Mieter', tenants.filter(x => matches(q, x.name, x.email, x.phone)).map(x => ({ id: x.id, label: x.name, hint: propertyName(x.propertyId), to: `/tenants/${x.id}` }))],
            ['Weitere Kontakte', contacts.filter(c => matches(q, c.name, c.role, c.email, c.phone, c.description)).map(c => ({ id: c.id, label: c.name, hint: c.role, to: '/contacts?filter=other' }))],
            ['Anliegen', issues.filter(i => matches(q, i.title, i.description)).map(i => ({ id: i.id, label: i.title, hint: propertyName(i.propertyId), to: '/issues' }))],
            ['Dokumente', documents.filter(d => matches(q, d.name)).map(d => ({ id: d.id, label: d.name, hint: propertyName(d.propertyId), to: d.propertyId ? `/properties/${d.propertyId}` : '/documents' }))],
        ].filter(([, items]) => items.length);
    }, [query, properties, tenants, contacts, documents, issues]);

    const open = query.trim().length >= 2;
    return (
        <div className="global-search" onKeyDown={e => { if (e.key === 'Escape') setQuery(''); }}>
            <label className="global-search-field">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Suchen …")} aria-label={t("Suchen …")} />
            </label>
            {open && <div className="global-search-results" role="listbox">
                {!groups.length && <p className="global-search-empty">{t("Keine Treffer.")}</p>}
                {groups.map(([title, items]) => <section key={title}>
                    <h3>{t(title)}</h3>
                    {items.slice(0, MAX_PER_GROUP).map(item => <Link key={item.id} to={item.to} role="option" aria-selected="false" onClick={() => setQuery('')}>
                        <span>{item.label}</span>{item.hint && <small>{item.hint}</small>}
                    </Link>)}
                    {items.length > MAX_PER_GROUP && <p className="global-search-empty">{t('+ {count} weitere', { count: items.length - MAX_PER_GROUP })}</p>}
                </section>)}
            </div>}
        </div>
    );
}
