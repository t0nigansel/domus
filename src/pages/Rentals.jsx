import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common';
import { useData } from '../context/DataContext';
import { useRentals } from '../hooks/domain/useRentals';
import { RENTAL_PHASES, APPLICATION_STATUSES, LEASE_STATUSES } from '../domain/rentals';
import { rentalForm, leaseForm, newParty, amountLabel, euros } from '../utils/rentalForms';
import { fileService } from '../db/services/fileService';
import './Rentals.css';

function Field({ label, value, onChange, type = 'text', required = false, ...rest }) {
    const { t } = useTranslation();
    return <label>{t(label)}<input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} {...rest} /></label>;
}
function MoneyFields({ values, change, required = false }) {
    const { t } = useTranslation();
    return <>
        <Field label={t("Kaltmiete (€ / Monat)")} type="number" min="0" step="0.01" required={required} value={values.coldRent} onChange={v => change('coldRent', v)} />
        <Field label={t("Nebenkosten (€ / Monat)")} type="number" min="0" step="0.01" required={required} value={values.utilities} onChange={v => change('utilities', v)} />
        <Field label={t("Kaution (€)")} type="number" min="0" step="0.01" required={required} value={values.deposit} onChange={v => change('deposit', v)} />
    </>;
}
function LeaseFields({ values, change }) {
    const { t } = useTranslation();
    return <>
        <fieldset className="rental-wide lease-field-group">
            <legend>{t('Mietzeitraum')}</legend>
            <Field label={t("Mietbeginn")} type="date" required value={values.start} onChange={v => change('start', v)} />
            <label>{t('Mietende (leer = unbefristet)')}<input type="date" min={values.start || undefined} value={values.end} onChange={e => change('end', e.target.value)} /><small className="text-muted">{t('Ein Enddatum zählt als letzter Miettag.')}</small></label>
        </fieldset>
        <fieldset className="rental-wide lease-field-group lease-money-group">
            <legend>{t('Miete und Kaution')}</legend>
            <MoneyFields values={values} change={change} required />
        </fieldset>
        <label className="rental-wide">{t('Mitvermietete Bestandteile')}<input value={values.included} onChange={e => change('included', e.target.value)} /></label>
    </>;
}

export default function Rentals() {
    const { t } = useTranslation();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { properties, tenants, documents, refreshAll } = useData();
    const workflow = useRentals(refreshAll);
    const propertyId = searchParams.get('propertyId') || '';
    const selectedProperty = properties.find(p => p.id === propertyId);
    const rental = workflow.rentals.find(r => r.id === id);
    return <div className="page-container rentals-page">
        <PageHeader title={selectedProperty ? t('Mietverhältnis · {name}', { name: selectedProperty.name }) : 'Vermietung'} />
        {!id && selectedProperty && <Link to={`/properties/${selectedProperty.id}`}>{t("← Zur Wohnung")}{" "}{selectedProperty.name}</Link>}
        {workflow.error && <p role="alert" className="rental-error">{t(workflow.error)}</p>}
        {workflow.message && <p role="status">{t(workflow.message)}</p>}
        {workflow.loading ? <p>{t("Lädt …")}</p> : id ? rental ? <RentalDetail key={rental.id} rental={rental} workflow={workflow} property={properties.find(p => p.id === rental.propertyId)} documents={documents} /> : <p>{t("Vermietung nicht gefunden.")}{" "}<Link to="/rentals">{t("Zur Übersicht")}</Link></p> : <>
            {selectedProperty ? <RentalWorkspace key={`${propertyId}-${searchParams.get('new')}`} property={selectedProperty} tenants={tenants} documents={documents} workflow={workflow} startNew={searchParams.get('new') === '1'} />
                : propertyId ? <p>{t('Wohnung nicht gefunden.')}</p> : <section className="rental-section"><h2>{t('Wohnung auswählen')}</h2>
                    {properties.map(property => {
                        const active = workflow.leases.find(lease => lease.propertyId === property.id && lease.status === 'Active');
                        const running = workflow.rentals.filter(rental => rental.propertyId === property.id && !['Completed', 'Archived'].includes(rental.phase));
                        return <article className="rental-summary" key={property.id}><div><h3>{property.name}</h3><p>{active ? `${active.tenantIds.map(id => tenants.find(tenant => tenant.id === id)?.name || t('Vertragspartei')).join(' & ')} · ${amountLabel(active.coldRentCents + active.utilitiesCents)}` : t('Kein aktiver Mietvertrag erfasst')}{running.length > 0 && ` · ${t('Neuvermietung läuft')}`}</p></div><Link className="btn-outline" to={`/rentals?propertyId=${property.id}`}>{t('Öffnen')}</Link></article>;
                    })}
                    {!properties.length && <p>{t('Noch keine Wohnungen vorhanden.')}</p>}
                </section>}
        </>}
    </div>;
}

function RentalNavigation({ items, value, onChange, label, disabled = false }) {
    const { t } = useTranslation();
    return <nav className="rental-navigation" aria-label={t(label)}>{items.map(([key, title]) => <button type="button" key={key} disabled={disabled} aria-pressed={value === key} onClick={() => onChange(key)}>{t(title)}</button>)}</nav>;
}

export function RentalWorkspace({ property, tenants, documents, workflow, startNew = false }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tab, setTab] = useState(startNew ? 'letting' : 'current');
    const [creating, setCreating] = useState(startNew);
    const leases = workflow.leases.filter(lease => lease.propertyId === property.id).sort((a, b) => b.start.localeCompare(a.start));
    const rentals = workflow.rentals.filter(rental => rental.propertyId === property.id);
    const running = rentals.filter(rental => !['Completed', 'Archived'].includes(rental.phase));
    const candidates = workflow.legacyTenants.filter(tenant => !tenant.propertyId || tenant.propertyId === property.id);
    const leaseCards = items => items.map(lease => <LeaseCard key={lease.id} lease={lease} property={property} tenants={tenants} documents={documents} workflow={workflow} />);
    const rentalCards = items => items.map(rental => <article className="rental-summary" key={rental.id}><div><h3>{rental.title}</h3><p>{t(RENTAL_PHASES[rental.phase])} · {t('{count} Interessenten', { count: rental.applications.length })}</p></div><Link className="btn-outline" to={`/rentals/${rental.id}`}>{t('Öffnen')}</Link></article>);
    return <>
        <RentalNavigation label="Vermietungsbereiche" items={[["current", "Aktuelles Mietverhältnis"], ["letting", "Neuvermietung"], ["history", "Historie"]]} value={tab} onChange={setTab} />
        {tab === 'current' && <>
            {leaseCards(leases.filter(lease => lease.status === 'Active'))}
            {!leases.some(lease => lease.status === 'Active') && <section className="rental-section"><h2>{t('Aktuelles Mietverhältnis')}</h2><p>{t('Kein aktiver Mietvertrag erfasst')}</p>{property.tenantName && <p>{t('Mieter')}: {property.tenantName}</p>}
                {candidates.length > 0 && <details className="rental-capture"><summary>{t('Bestehenden Mietvertrag erfassen')}</summary><LegacyForm property={property} candidates={candidates} workflow={workflow} /></details>}
                {!candidates.length && <button className="btn-primary" onClick={() => { setTab('letting'); setCreating(true); }}>{t('Neuvermietung starten')}</button>}
            </section>}
            {leases.some(lease => lease.status === 'Active') && candidates.length > 0 && <details className="rental-section"><summary>{t('Weiteren Bestandsvertrag erfassen')}</summary><LegacyForm property={property} candidates={candidates} workflow={workflow} /></details>}
            {leases.some(lease => lease.status === 'Planned') && <section className="rental-section"><h2>{t('Kommende Mietverhältnisse')}</h2>{leaseCards(leases.filter(lease => lease.status === 'Planned'))}</section>}
        </>}
        {tab === 'letting' && <section className="rental-section"><div className="rental-heading"><h2>{t('Neuvermietung')}</h2>{!creating && <button className="btn-primary" onClick={() => setCreating(true)}>{t('Neuvermietung starten')}</button>}</div>
            {rentalCards(running)}
            {creating && <RentalForm property={property} busy={workflow.busy} onCancel={() => setCreating(false)} onSave={async values => {
                const saved = await workflow.save('', values);
                if (saved) navigate(`/rentals/${saved.id}`);
            }} />}
        </section>}
        {tab === 'history' && <section className="rental-section"><h2>{t('Historie')}</h2>{leaseCards(leases.filter(lease => lease.status === 'Ended'))}{rentalCards(rentals.filter(rental => ['Completed', 'Archived'].includes(rental.phase)))}
            {!leases.some(lease => lease.status === 'Ended') && !rentals.some(rental => ['Completed', 'Archived'].includes(rental.phase)) && <p>{t('Noch keine abgeschlossenen Mietverhältnisse oder Vermietungen.')}</p>}
        </section>}
    </>;
}

function RentalForm({ rental, property, busy, onSave, onCancel }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(() => rentalForm(rental, property));
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <section className="rental-section"><h2>{rental ? t("Vorbereitung und Inserat") : t("Vermietung anlegen")}</h2>
        <form className="rental-form" onSubmit={e => { e.preventDefault(); onSave(values); }}>
            <Field label={t("Bezeichnung")} required value={values.title} onChange={v => change('title', v)} />
            <Field label={t("Verfügbar ab")} type="date" value={values.availableFrom} onChange={v => change('availableFrom', v)} />
            <Field label="Kaltmiete (€ / Monat)" type="number" min="0" step="0.01" value={values.coldRent} onChange={v => change('coldRent', v)} />
            <Field label="Nebenkosten (€ / Monat)" type="number" min="0" step="0.01" value={values.utilities} onChange={v => change('utilities', v)} />
            <details className="rental-wide"><summary>{t('Weitere Angaben und Inserat')}</summary><div className="rental-form">
            <Field label="Kaution (€)" type="number" min="0" step="0.01" value={values.deposit} onChange={v => change('deposit', v)} />
            <Field label="Mitvermietete Bestandteile" value={values.included} onChange={v => change('included', v)} />
            <label className="rental-wide">{t("Interne Notizen")}<textarea value={values.notes} onChange={e => change('notes', e.target.value)} /></label>
            <label className="rental-wide">{t("Inseratentwurf (manuell)")}<textarea rows="5" value={values.listing} onChange={e => change('listing', e.target.value)} /></label>
            </div></details>
            <div className="rental-wide rental-actions"><button className="btn-primary" disabled={busy}>{t("Vorgang speichern")}</button>{onCancel && <button type="button" className="btn-outline" disabled={busy} onClick={onCancel}>{t('Abbrechen')}</button>}</div>
        </form>
    </section>;
}

function RentalDetail({ rental, workflow, property, documents }) {
    const { t } = useTranslation();
    const [editingApplication, setEditingApplication] = useState(null);
    const [addingApplication, setAddingApplication] = useState(false);
    const [editingViewing, setEditingViewing] = useState(null);
    const [addingViewing, setAddingViewing] = useState(false);
    const [editingPreparation, setEditingPreparation] = useState(false);
    const steps = [['Preparation', 'Vorbereitung'], ['Inquiries', 'Interessenten'], ['Viewings', 'Besichtigungen'], ['Contract', 'Vertrag']];
    const [step, setStep] = useState(() => ({ Preparation: 0, Listing: 0, Inquiries: 1, Viewings: 2, Selection: 1, Contract: 3, Completed: 3, Archived: 0 }[rental.phase] ?? 0));
    const locked = ['Completed', 'Archived'].includes(rental.phase);
    const selected = rental.applications.find(a => a.id === rental.selectedApplicationId);
    const next = async () => {
        const nextStep = Math.min(step + 1, steps.length - 1);
        if (await workflow.save(`/${rental.id}`, { phase: steps[nextStep][0] }, 'PUT')) setStep(nextStep);
    };
    return <>
        <Link to={`/properties/${rental.propertyId}?tab=rental`}>{t("← Zur Übersicht und den Mietverhältnissen")}</Link>
        <section className="rental-section"><h2>{rental.title}</h2><p><Link to={`/properties/${rental.propertyId}`}>{property?.name}</Link> · {t(RENTAL_PHASES[rental.phase])}</p>
            <RentalNavigation label="Vermietungsschritte" items={steps.map(([, label], index) => [index, `${index + 1}. ${t(label)}`])} value={step} onChange={setStep} disabled={workflow.busy || editingPreparation || addingApplication || !!editingApplication || addingViewing || !!editingViewing} />
            {!locked && <details><summary>{t('Weitere Aktionen')}</summary><button className="btn-outline" disabled={workflow.busy} onClick={() => workflow.save(`/${rental.id}`, { phase: 'Archived' }, 'PUT')}>{t("Vorgang archivieren")}</button></details>}
            {locked && <p>{t(rental.phase === 'Completed' ? 'Vermietung abgeschlossen.' : 'Dieser Vorgang wurde archiviert.')}</p>}
        </section>
        {step === 0 && <section className="rental-section"><div className="rental-heading"><h2>{t('Vorbereitung')}</h2>{!locked && !editingPreparation && <button className="btn-outline" onClick={() => setEditingPreparation(true)}>{t('Bearbeiten')}</button>}</div>
            {editingPreparation && !locked ? <RentalForm rental={rental} property={property} busy={workflow.busy} onCancel={() => setEditingPreparation(false)} onSave={async values => { if (await workflow.save(`/${rental.id}`, values, 'PUT')) setEditingPreparation(false); }} /> : <>
                <dl className="lease-details"><div><dt>{t('Verfügbar ab')}</dt><dd>{rental.availableFrom || t('Noch nicht erfasst')}</dd></div><div><dt>{t('Kaltmiete')}</dt><dd>{amountLabel(rental.coldRentCents)}</dd></div><div><dt>{t('Nebenkosten')}</dt><dd>{amountLabel(rental.utilitiesCents)}</dd></div></dl>
                <details><summary>{t('Weitere Angaben und Inserat')}</summary><p>{t('Kaution (€)')}: {amountLabel(rental.depositCents)}</p><p>{rental.included}</p><p className="rental-prewrap">{rental.notes}</p><p className="rental-prewrap">{rental.listing}</p></details>
            </>}
        </section>}
        {step === 1 && <section className="rental-section"><h2>{t("Interessenten")}</h2>
            {!locked && <button className="btn-outline" onClick={() => { setAddingApplication(true); setEditingApplication(null); }}>{t("Bewerbung hinzufügen")}</button>}
            {rental.applications.length === 0 && <p>{t("Noch keine Interessenten erfasst.")}</p>}
            {rental.applications.map(a => <article className="rental-summary" key={a.id}>
                <div><h3>{a.parties.map(p => p.name).join(' & ')}</h3><p>{t(a.status)}{a.id === rental.selectedApplicationId ? t(" · Ausgewählt") : ''}</p>
                    <details><summary>{t('Details')}</summary>{a.parties.map((p, i) => <p key={i}>{p.email} {p.phone}</p>)}<p className="rental-prewrap">{a.inquiry}</p><p className="rental-prewrap">{a.notes}</p></details></div>
                {!locked && <div className="rental-actions"><button className="btn-outline" onClick={() => { setEditingApplication(a); setAddingApplication(false); }}>{t("Bewerbung bearbeiten")}</button>
                    <button className="btn-outline" disabled={workflow.busy || ['Withdrawn', 'Rejected'].includes(a.status)} onClick={() => workflow.save(`/${rental.id}`, { selectedApplicationId: a.id }, 'PUT')}>{t("Für Vertrag auswählen")}</button></div>}
            </article>)}
            {!locked && (addingApplication || editingApplication) && <ApplicationForm key={editingApplication?.id || 'new'} application={editingApplication} busy={workflow.busy} onCancel={() => { setAddingApplication(false); setEditingApplication(null); }} onSave={async values => {
                const result = await workflow.save(`/${rental.id}/applications${editingApplication ? `/${editingApplication.id}` : ''}`, values, editingApplication ? 'PUT' : 'POST');
                if (result) { setAddingApplication(false); setEditingApplication(null); }
            }} />}
        </section>}
        {step === 2 && <section className="rental-section"><h2>{t("Besichtigungen")}</h2>
            {!locked && <button className="btn-outline" disabled={!rental.applications.length} onClick={() => { setAddingViewing(true); setEditingViewing(null); }}>{t("Besichtigung hinzufügen")}</button>}
            {rental.viewings.map(v => <article className="rental-summary" key={v.id}><div><h3>{v.date} · {v.time}</h3><p>{rental.applications.find(a => a.id === v.applicationId)?.parties.map(p => p.name).join(' & ')} · {{ Scheduled: t("Geplant"), Done: t("Durchgeführt"), Cancelled: t("Abgesagt") }[v.status]}</p><p className="rental-prewrap">{v.notes}</p></div>
                {!locked && <button className="btn-outline" onClick={() => { setEditingViewing(v); setAddingViewing(false); }}>{t("Termin bearbeiten")}</button>}</article>)}
            {!locked && (addingViewing || editingViewing) && <ViewingForm key={editingViewing?.id || 'new'} viewing={editingViewing} applications={rental.applications} busy={workflow.busy} onCancel={() => { setAddingViewing(false); setEditingViewing(null); }} onSave={async values => {
                const result = await workflow.save(`/${rental.id}/viewings${editingViewing ? `/${editingViewing.id}` : ''}`, values, editingViewing ? 'PUT' : 'POST');
                if (result) { setAddingViewing(false); setEditingViewing(null); }
            }} />}
        </section>}
        {step === 3 && <section className="rental-section"><h2>{t("Vertrag")}</h2>
            {locked ? <Link className="btn-outline" to={`/properties/${rental.propertyId}?tab=rental`}>{t('Mietverhältnis ansehen')}</Link> : selected ? <>
                <p>{t('Unterschriebenen Mietvertrag auswählen und die Vertragsdaten bestätigen.')}</p>
                <Link to={`/properties/${rental.propertyId}?tab=files`}>{t('Vertrag bei der Wohnung hochladen')}</Link>
                <CompletionForm key={`${rental.id}-${selected.id}`} rental={rental} selected={selected} documents={documents.filter(d => d.propertyId === rental.propertyId && d.category === 'Leases' && d.hasFile)} busy={workflow.busy} onSave={values => workflow.save(`/${rental.id}/complete`, values)} />
            </> : <p>{t("Zuerst eine Bewerbung für den Vertrag auswählen.")}</p>}
        </section>}
        {!locked && step < 3 && <div className="rental-next"><button className="btn-primary" disabled={workflow.busy || editingPreparation || addingApplication || !!editingApplication || addingViewing || !!editingViewing || (step === 1 && !rental.applications.length) || (step === 2 && !selected)} onClick={next}>{t('Weiter zu {step}', { step: t(steps[step + 1][1]) })}</button>{step === 2 && !selected && <p className="text-muted">{t('Für den Vertrag zuerst einen Interessenten auswählen.')} <button className="btn-text" onClick={() => setStep(1)}>{t('Zu den Interessenten')}</button></p>}</div>}
    </>;
}

function ApplicationForm({ application, busy, onSave, onCancel }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(() => application ? structuredClone(application) : { parties: [newParty()], inquiry: '', notes: '', status: 'New' });
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <form className="rental-form inset-form" onSubmit={e => { e.preventDefault(); onSave(values); }}>
        {values.parties.map((party, index) => <fieldset className="rental-wide rental-form" key={index}><legend>{t("Vertragspartei")}{" "}{index + 1}</legend>
            {['name', 'email', 'phone'].map(key => <Field key={key} label={{ name: t("Name"), email: t("E-Mail"), phone: t("Telefon") }[key]} type={key === 'email' ? 'email' : 'text'} required={key === 'name'} value={party[key]} onChange={value => change('parties', values.parties.map((p, i) => i === index ? { ...p, [key]: value } : p))} />)}
            {values.parties.length > 1 && <button type="button" className="btn-outline" onClick={() => change('parties', values.parties.filter((_, i) => i !== index))}>{t("Partei entfernen")}</button>}
        </fieldset>)}
        <div className="rental-wide"><button type="button" className="btn-outline" disabled={values.parties.length >= 10} onClick={() => change('parties', [...values.parties, newParty()])}>{t("Weitere Vertragspartei")}</button></div>
        <label>{t("Status")}<select value={values.status} onChange={e => change('status', e.target.value)}>{Object.keys(APPLICATION_STATUSES).map(key => <option key={key} value={key}>{t(key)}</option>)}</select></label>
        <label className="rental-wide">{t("Anfrage")}<textarea value={values.inquiry} onChange={e => change('inquiry', e.target.value)} /></label>
        <label className="rental-wide">{t("Notizen und offene Fragen")}<textarea value={values.notes} onChange={e => change('notes', e.target.value)} /></label>
        <div className="rental-wide rental-actions"><button className="btn-primary" disabled={busy}>{t("Bewerbung speichern")}</button><button type="button" className="btn-outline" onClick={onCancel}>{t("Abbrechen")}</button></div>
    </form>;
}
function ViewingForm({ viewing, applications, busy, onSave, onCancel }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(viewing || { applicationId: applications[0]?.id || '', date: '', time: '', status: 'Scheduled', notes: '' });
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <form className="rental-form inset-form" onSubmit={e => { e.preventDefault(); onSave(values); }}>
        <label>{t("Bewerbung")}<select required value={values.applicationId} onChange={e => change('applicationId', e.target.value)}>{applications.map(a => <option key={a.id} value={a.id}>{a.parties.map(p => p.name).join(' & ')}</option>)}</select></label>
        <Field label={t("Datum")} type="date" required value={values.date} onChange={v => change('date', v)} />
        <label>{t('Uhrzeit')}<input type="time" required value={values.time} onChange={e => change('time', e.target.value)} /><small className="text-muted">{t('Ortszeit der Wohnung')}</small></label>
        <label>{t("Terminstatus")}<select value={values.status} onChange={e => change('status', e.target.value)}><option value="Scheduled">{t("Geplant")}</option><option value="Done">{t("Durchgeführt")}</option><option value="Cancelled">{t("Abgesagt")}</option></select></label>
        <label className="rental-wide">{t("Ergebnis und offene Fragen")}<textarea value={values.notes} onChange={e => change('notes', e.target.value)} /></label>
        <div className="rental-wide rental-actions"><button className="btn-primary" disabled={busy}>{t("Termin speichern")}</button><button type="button" className="btn-outline" onClick={onCancel}>{t("Abbrechen")}</button></div>
    </form>;
}
function CompletionForm({ rental, selected, documents, busy, onSave }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(() => ({ ...leaseForm(rental), contractDocumentId: '', confirmSigned: false }));
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <form className="rental-form" onSubmit={e => { e.preventDefault(); onSave(values); }}>
        <p className="rental-wide">{t("Vertragsparteien:")}{" "}<strong>{selected.parties.map(p => p.name).join(' & ')}</strong></p>
        <LeaseFields values={values} change={change} />
        <label className="rental-wide">{t("Unterschriebener Mietvertrag")}<select required value={values.contractDocumentId} onChange={e => change('contractDocumentId', e.target.value)}><option value="">{t("Bitte auswählen")}</option>{documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="rental-wide rental-check"><input type="checkbox" required checked={values.confirmSigned} onChange={e => change('confirmSigned', e.target.checked)} />{t("Ich habe die Vertragsdaten geprüft und die ausgewählte Datei enthält den unterschriebenen Vertrag.")}</label>
        <button className="btn-primary" disabled={busy || !documents.length}>{t("Abschließen und Mietverhältnis anlegen")}</button>
    </form>;
}
function LeaseCard({ lease, property, tenants, documents, workflow }) {
    const { t, locale } = useTranslation();
    const [editing, setEditing] = useState(false);
    const date = value => new Date(value + 'T12:00:00').toLocaleDateString(locale);
    return <article className="rental-section lease-overview" aria-label={t('Mietvertrag')}>
        <div className="rental-heading"><h2>{lease.tenantIds.map(id => tenants.find(tenant => tenant.id === id)?.name || t('Vertragspartei')).join(' & ')}</h2><span className="rental-status">{t(LEASE_STATUSES[lease.status])}</span></div>
        <p>{t(lease.status === 'Planned' ? 'Ab' : 'Seit')} {date(lease.start)} · {lease.end ? t('Bis {date}', { date: date(lease.end) }) : t('unbefristet')}</p>
        <div className="lease-amounts"><div><span>{t('Kaltmiete')}</span><strong>{amountLabel(lease.coldRentCents)}</strong></div><div><span>{t('Nebenkosten')}</span><strong>{amountLabel(lease.utilitiesCents)}</strong></div><div><span>{t('Gesamtmiete / Monat')}</span><strong>{amountLabel(lease.coldRentCents + lease.utilitiesCents)}</strong></div></div>
        {!editing && <div className="rental-actions"><button className="btn-primary" onClick={() => setEditing(true)}>{t('Vertragsdaten bearbeiten')}</button>{lease.contractDocumentId && <a className="btn-outline" href={fileService.url(lease.contractDocumentId, true)} target="_blank" rel="noreferrer">{t('Mietvertrag ansehen')}</a>}</div>}
        {editing && <LeaseEditForm key={lease.id + '-' + lease.start + '-' + lease.coldRentCents + '-' + lease.utilitiesCents + '-' + lease.end} lease={lease} documents={documents.filter(document => document.propertyId === property.id && document.category === 'Leases' && document.hasFile)} busy={workflow.busy} onCancel={() => setEditing(false)} onSave={async values => {
            if (await workflow.save('/leases/' + lease.id, values, 'PUT')) setEditing(false);
        }} />}
        <details><summary>{t('Details')}</summary><dl className="lease-details"><div><dt>{t('Kaution (€)')}</dt><dd>{amountLabel(lease.depositCents)}</dd></div><div><dt>{t('Mitvermietete Bestandteile')}</dt><dd>{lease.included || t('Noch nicht erfasst')}</dd></div></dl>
            <div className="rental-actions">{lease.tenantIds.map(id => <Link key={id} to={'/tenants/' + id}>{t('Kontaktdaten')}: {tenants.find(tenant => tenant.id === id)?.name || t('Vertragspartei')}</Link>)}</div>
        </details>
        <details><summary>{t('Weitere Aktionen')}</summary><details><summary>{t('Mietende festlegen oder korrigieren')}</summary><LeaseEndForm key={lease.id + '-' + lease.end} lease={lease} busy={workflow.busy} onSave={values => workflow.save('/leases/' + lease.id + '/end', values, 'PUT')} /></details></details>
    </article>;
}
function LeaseEditForm({ lease, documents, busy, onSave, onCancel }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(() => ({ start: lease.start, end: lease.end || '', coldRent: euros(lease.coldRentCents), utilities: euros(lease.utilitiesCents), deposit: euros(lease.depositCents), included: lease.included || '', contractDocumentId: lease.contractDocumentId || '' }));
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <form className="rental-form" onSubmit={e => { e.preventDefault(); onSave(values); }}>
        <LeaseFields values={values} change={change} />
        <label className="rental-wide">{t('Mietvertrag')}<select value={values.contractDocumentId} onChange={e => change('contractDocumentId', e.target.value)}><option value="">{t('Noch nicht zugeordnet')}</option>{documents.map(document => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label>
        <div className="rental-wide rental-actions"><button className="btn-primary" disabled={busy}>{t('Vertragsdaten speichern')}</button><button type="button" className="btn-outline" disabled={busy} onClick={onCancel}>{t('Abbrechen')}</button></div>
    </form>;
}
function LeaseEndForm({ lease, busy, onSave }) {
    const { t } = useTranslation();
    const [end, setEnd] = useState(lease.end || '');
    return <form className="rental-form" onSubmit={e => { e.preventDefault(); onSave({ end }); }}><Field label={t("Letzter Miettag (leer = unbefristet)")} type="date" value={end} onChange={setEnd} /><button className="btn-primary" disabled={busy}>{t("Mietende speichern")}</button></form>;
}
function LegacyForm({ property, candidates, workflow }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(() => ({ ...leaseForm(null, property), start: property.moveInDate || (candidates.length === 1 ? candidates[0].leaseStart || '' : ''), propertyId: property.id, tenantIds: candidates.length === 1 ? [candidates[0].id] : [] }));
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    if (!candidates.length) return <p>{t("Keine ungeprüften Bestandsmieter für diese Wohnung.")}</p>;
    return <form className="rental-form" onSubmit={e => { e.preventDefault(); workflow.save('/leases/confirm', values); }}>
        <fieldset className="rental-wide"><legend>{t("Gemeinsame Vertragsparteien auswählen")}</legend>{candidates.map(tenant => <label className="rental-check" key={tenant.id}><input type="checkbox" checked={values.tenantIds.includes(tenant.id)} onChange={e => change('tenantIds', e.target.checked ? [...values.tenantIds, tenant.id] : values.tenantIds.filter(id => id !== tenant.id))} />{tenant.name}</label>)}</fieldset>
        <LeaseFields values={values} change={change} />
        <button className="btn-primary" disabled={workflow.busy || !values.tenantIds.length}>{t("Bestandsvertrag bestätigen")}</button>
    </form>;
}
