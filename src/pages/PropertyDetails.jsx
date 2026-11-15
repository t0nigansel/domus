import React, { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useData } from '../context/DataContext';
import { useRentals } from '../hooks/domain/useRentals';
import { propertyOverview } from '../domain/propertyOverview';
import { dossierFields } from '../domain/propertyDossier';
import { fileService } from '../db/services/fileService';
import PropertyDossier from './PropertyDossier';
import PropertyRentalSummary from '../components/PropertyRentalSummary';
import PropertyFiles from '../components/PropertyFiles';
import { RentalWorkspace } from './Rentals';
import { useCloudAuth } from '../context/CloudAuthContext';
import './PropertyDetails.css';

const tabs = [['overview', 'Übersicht'], ['data', 'Wohnungsdaten'], ['rental', 'Vermietung'], ['files', 'Fotos & Dokumente'], ['history', 'Historie']];

export default function PropertyDetails() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { properties } = useData();
    const property = properties.find(item => item.id === id);
    const { t } = useTranslation();
    if (!property) return <div className="property-not-found"><h2>{t('Property Not Found')}</h2><Link to="/properties">{t('Back to Properties')}</Link></div>;
    return <PropertyPage key={`${id}-${searchParams.get('tab')}-${searchParams.get('new')}`} property={property} initialTab={searchParams.get('tab')} startNew={searchParams.get('new') === '1'} />;
}

export function PropertyPage({ property, initialTab, startNew, embedded = false }) {
    const { t, locale } = useTranslation();
    const auth = useCloudAuth();
    const { tenants, documents, issues, refreshAll } = useData();
    const workflow = useRentals(refreshAll);
    const [tab, setTab] = useState(tabs.some(([key]) => key === initialTab) ? initialTab : 'overview');
    const overview = propertyOverview(property, tenants, workflow.leases);
    const { facts, nonRental, missing, areaReview } = overview;
    const openIssues = issues.filter(issue => issue.propertyId === property.id && issue.status !== 'Closed');
    const address = [property.street, [property.postalCode, property.city].filter(Boolean).join(' '), property.floor || t(property.location)].filter(Boolean).join(' · ');
    const total = Number.isFinite(facts.coldRent) && Number.isFinite(facts.nebenkosten) ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(facts.coldRent + facts.nebenkosten) : t('Noch nicht erfasst');
    const overviewFields = nonRental ? ['size', 'rooms', 'condition', 'pets', 'occupants', 'occupancyNote'] : ['tenantName', 'moveInDate', 'size', 'rooms', 'coldRent', 'nebenkosten', 'condition', 'pets', 'occupants'];
    const selectTab = next => setTab(next);
    return <div className={`property-details-container${embedded ? ' property-details-inline' : ''}`}>
        {!embedded && <div className="details-header-nav"><Link className="back-link" to="/properties"><ArrowLeft size={18} />{t('Back to Properties')}</Link></div>}
        <header className="details-header">
            <div><div className="title-row">{!embedded && <h1 className="details-title">{property.name}</h1>}<span className={`property-status status-${property.status.toLowerCase()}`}>{t(property.status)}</span></div>
                <p className="address-row text-muted"><MapPin size={16} aria-hidden="true" />{address || t('Noch nicht erfasst')}</p>
            </div>
        </header>
        {auth && <div className="assistant-actions"><Link className="btn-outline" to={`/properties/${property.id}/exposes`}>{t('Exposé erstellen')}</Link>{property.buildingId && <><Link className="btn-outline" to={`/buildings/${property.buildingId}`}>{t('Hausakte')}</Link><Link className="btn-outline" to={`/buildings/${property.buildingId}/statements`}>{t('Nebenkostenabrechnungen')}</Link></>}</div>}
        <div className="property-tabs" role="tablist" aria-label={t('Wohnungsbereiche')}>
            {tabs.map(([key, label]) => <button key={key} id={`tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)} onKeyDown={e => {
                const index = tabs.findIndex(([value]) => value === key);
                const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
                if (next !== null) { e.preventDefault(); selectTab(tabs[next][0]); document.getElementById(`tab-${tabs[next][0]}`).focus(); }
            }}>{t(label)}{key === 'overview' && openIssues.length > 0 && <span className="property-count">{openIssues.length}</span>}</button>)}
        </div>
        {workflow.error && <p role="alert" className="file-error">{t(workflow.error)}</p>}
        {workflow.message && <p role="status">{t(workflow.message)}</p>}
        {tabs.map(([key]) => <div key={key} role="tabpanel" id={`panel-${key}`} aria-labelledby={`tab-${key}`} hidden={tab !== key}>
            {key === 'overview' && <>
                <PropertyDossier property={facts} title={nonRental ? 'Belegung und Eckdaten' : 'Belegung und Miete'} fields={overviewFields} areaPending={!!areaReview}>
                    {!nonRental && <div className="property-section-footer">
                        <p className="property-total"><span>{t('Monatliche Gesamtmiete')}</span><strong>{total}</strong></p>
                        <p className="text-muted">{workflow.loading ? t('Lädt …') : overview.activeLease ? t('Mietvertrag zugeordnet') : facts.tenantName ? t('Mieter erfasst · Mietvertrag noch nicht zugeordnet') : t('Kein Mieter erfasst')}</p>
                        {property.leaseManaged && <p className="text-muted">{t('Mieter und Mietbeträge werden über das verknüpfte Mietverhältnis verwaltet.')}</p>}
                        <div className="property-links"><button className="btn-outline" onClick={() => selectTab('rental')}>{t('Mietverhältnis verwalten')}</button>{overview.parties.map(party => <Link key={party.id} to={`/tenants/${party.id}`}>{t('Kontaktdaten')}: {party.name}</Link>)}</div>
                    </div>}
                </PropertyDossier>
                <section className="details-card" aria-label={t('Handlungsbedarf')}>
                    <h2 className="card-title">{t('Handlungsbedarf')}</h2>
                    {missing.length > 0 && <p className="property-notice">{t('Fehlende Angaben')}: {missing.map(key => t(dossierFields.find(field => field[0] === key)[1])).join(', ')}</p>}
                    {areaReview && <p className="property-notice">{t('Wohnfläche: Quelle noch zu prüfen.')} <button className="btn-text" onClick={() => selectTab('history')}>{t('Quelle und ältere Angaben ansehen')}</button></p>}
                    <PropertyIssues key={property.id} property={property} issues={openIssues} />
                </section>
                {workflow.rentals.filter(rental => rental.propertyId === property.id && !['Completed', 'Archived'].includes(rental.phase)).map(rental => <p className="property-notice" key={rental.id}><Link to={`/rentals/${rental.id}`}>{t('Laufende Vermietung')}: {rental.title}</Link></p>)}
            </>}
            {key === 'data' && <>
                <PropertyDossier property={property} title="Bezeichnung und Adresse" fields={['name', 'status', 'location', 'street', 'postalCode', 'city', 'floor']} />
                <PropertyDossier property={property} title="Ausstattung und Modernisierungen" fields={['equipment', 'modernizations']} />
                <PropertyDossier property={property} title="Heizung und Energie" fields={['heating', 'energyRating', 'energyDemand']} />
            </>}
            {key === 'rental' && tab === 'rental' && (workflow.loading ? <p>{t('Lädt …')}</p> : <RentalWorkspace property={property} tenants={tenants} documents={documents} workflow={workflow} startNew={startNew} />)}
            {key === 'files' && tab === 'files' && <PropertyFiles property={property} />}
            {key === 'history' && <>
                <PropertyRentalSummary property={property} workflow={workflow} />
                <section className="details-card"><h2 className="card-title">{t('Quellen und Importangaben')}</h2>
                    <p className="text-muted">{t('Historische Angaben dienen als Nachweis. Die aktuellen Werte stehen in der Übersicht.')}</p>
                    {!property.importReview?.length && !overview.residents.length && <p>{t('Keine älteren Angaben vorhanden.')}</p>}
                    {overview.residents.map((resident, index) => <p className="property-source" key={`resident-${index}`}>{resident.name} · {t(resident.role === 'Tenant' ? 'Mieter' : resident.role === 'UsufructResident' ? 'Bewohner mit Nießbrauch, kein Mieter' : 'Bewohner, kein Mietverhältnis')} · {resident.confirmedAsOf}</p>)}
                    {property.importReview?.map((item, index) => <article className="property-source" key={index}><h3>{t(item.label)}</h3><p>{item.value} {item.unit} · {item.sourceDate}</p>{item.conflictingOlderValues?.length > 0 && <p>{t('Ältere Quellen: {values} {unit}.', { values: item.conflictingOlderValues.join(', '), unit: item.unit })}</p>}<a href={fileService.url(item.sourceDocumentId, true)} target="_blank" rel="noreferrer">{t('Quelle ansehen')}</a></article>)}
                </section>
                <PropertyDossier property={property} title="Übernommene Notizen" fields={['notes']} />
                <section className="details-card"><h2 className="card-title">{t('Erledigte Anliegen')}</h2>{issues.filter(issue => issue.propertyId === property.id && issue.status === 'Closed').map(issue => <p key={issue.id}>{issue.title}</p>)}</section>
            </>}
        </div>)}
    </div>;
}

function PropertyIssues({ property, issues }) {
    const { t } = useTranslation();
    const { addIssue, resolveIssue } = useData();
    const [adding, setAdding] = useState(false);
    const [values, setValues] = useState({ title: '', description: '', priority: 'Medium' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const run = async action => {
        setBusy(true); setError('');
        try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); }
    };
    return <div className="property-issues">
        <div className="card-header-row"><h3>{t('Offene Anliegen')} ({issues.length})</h3><button className="btn-outline small" onClick={() => setAdding(!adding)}>{t('Anliegen melden')}</button></div>
        {error && <p role="alert" className="file-error">{t(error)}</p>}
        {adding && <form className="dossier-form" onSubmit={e => { e.preventDefault(); run(async () => { await addIssue({ ...values, propertyId: property.id }); setAdding(false); setValues({ title: '', description: '', priority: 'Medium' }); }); }}>
            <label>{t('Issue Title')}<input required value={values.title} onChange={e => setValues({ ...values, title: e.target.value })} /></label>
            <label>{t('Description')}<textarea value={values.description} onChange={e => setValues({ ...values, description: e.target.value })} /></label>
            <label>{t('Priority')}<select value={values.priority} onChange={e => setValues({ ...values, priority: e.target.value })}>{['Low', 'Medium', 'High'].map(priority => <option key={priority} value={priority}>{t(priority)}</option>)}</select></label>
            <div className="dossier-actions"><button className="btn-primary" disabled={busy}>{t('Save Issue')}</button><button type="button" className="btn-outline" disabled={busy} onClick={() => setAdding(false)}>{t('Cancel')}</button></div>
        </form>}
        {!issues.length && <p className="text-muted">{t('Keine offenen Anliegen für diese Wohnung.')}</p>}
        {issues.map(issue => <article className="issue-card" key={issue.id}><div className="issue-header-row"><h3>{issue.title}</h3><span className={`priority-badge ${issue.priority.toLowerCase()}`}>{t(issue.priority)}</span></div><p className="text-muted">{issue.description}</p><div className="issue-footer-row"><span>{t(issue.status)}{issue.dueDate && ` · ${issue.dueDate}`}</span><button className="btn-outline small" disabled={busy} onClick={() => run(() => resolveIssue(issue.id))}>{t('Mark Resolved')}</button></div></article>)}
    </div>;
}
