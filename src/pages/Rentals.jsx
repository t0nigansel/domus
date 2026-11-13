import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common';
import { useData } from '../context/DataContext';
import { useRentals } from '../hooks/domain/useRentals';
import { RENTAL_PHASES, APPLICATION_STATUSES, LEASE_STATUSES } from '../domain/rentals';
import { rentalForm, leaseForm, newParty, amountLabel } from '../utils/rentalForms';
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
        <Field label={t("Mitvermietete Bestandteile")} value={values.included} onChange={v => change('included', v)} />
    </>;
}
function LeaseFields({ values, change }) {
    const { t } = useTranslation();
    return <><Field label={t("Mietbeginn")} type="date" required value={values.start} onChange={v => change('start', v)} />
        <Field label={t("Mietende (leer = unbefristet)")} type="date" value={values.end} onChange={v => change('end', v)} />
        <MoneyFields values={values} change={change} required /></>;
}

export default function Rentals() {
    const { t } = useTranslation();
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { properties, tenants, documents, refreshAll } = useData();
    const workflow = useRentals(refreshAll);
    const [creating, setCreating] = useState(searchParams.get('new') === '1');
    const navigate = useNavigate();
    const propertyId = searchParams.get('propertyId') || '';
    const selectedProperty = properties.find(p => p.id === propertyId);
    const rental = workflow.rentals.find(r => r.id === id);
    return <div className="page-container rentals-page">
        <PageHeader title="Vermietungen" description="Vorbereiten, Interessenten begleiten und Mietverhältnisse festhalten." onAction={id ? undefined : () => setCreating(!creating)} />
        {!id && selectedProperty && <Link to={`/properties/${selectedProperty.id}`}>{t("← Zur Wohnung")}{" "}{selectedProperty.name}</Link>}
        {workflow.error && <p role="alert" className="rental-error">{t(workflow.error)}</p>}
        {workflow.message && <p role="status">{t(workflow.message)}</p>}
        {workflow.loading ? <p>{t("Lädt …")}</p> : id ? rental ? <RentalDetail key={rental.id} rental={rental} workflow={workflow} property={properties.find(p => p.id === rental.propertyId)} documents={documents} /> : <p>{t("Vermietung nicht gefunden.")}{" "}<Link to="/rentals">{t("Zur Übersicht")}</Link></p> : <>
            <label className="rental-filter">{t("Wohnung filtern")}<select value={propertyId} onChange={e => setSearchParams(e.target.value ? { propertyId: e.target.value } : {})}><option value="">{t("Alle Wohnungen")}</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            {creating && <RentalForm key={propertyId} property={selectedProperty} properties={properties} busy={workflow.busy} onSave={async values => {
                const saved = await workflow.save('', values);
                if (saved) { setCreating(false); navigate(`/rentals/${saved.id}`); }
            }} />}
            <section className="rental-section"><h2>{t("Vorgänge")}</h2>
                {!workflow.rentals.length && <p>{t("Noch keine Vermietung angelegt.")}</p>}
                {workflow.rentals.filter(r => !propertyId || r.propertyId === propertyId).map(r => <article className="rental-summary" key={r.id}>
                    <div><h3><Link to={`/rentals/${r.id}`}>{r.title}</Link></h3><p>{properties.find(p => p.id === r.propertyId)?.name} · {t(RENTAL_PHASES[r.phase])}</p></div>
                    <Link className="btn-outline" to={`/rentals/${r.id}`}>{t("Öffnen")}</Link>
                </article>)}
            </section>
            <LeaseList workflow={workflow} properties={properties} tenants={tenants} propertyId={propertyId} />
            <LegacyConfirmation key={propertyId} workflow={workflow} properties={properties} propertyId={propertyId} />
        </>}
    </div>;
}

function RentalForm({ rental, property, properties = [], busy, onSave }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(() => rentalForm(rental, property));
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <section className="rental-section"><h2>{rental ? t("Vorbereitung und Inserat") : t("Vermietung anlegen")}</h2>
        <form className="rental-form" onSubmit={e => { e.preventDefault(); onSave(values); }}>
            {!rental && <label>{t("Wohnung")}<select required value={values.propertyId} onChange={e => change('propertyId', e.target.value)}><option value="">{t("Bitte auswählen")}</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
            <Field label={t("Bezeichnung")} required value={values.title} onChange={v => change('title', v)} />
            <Field label={t("Verfügbar ab")} type="date" value={values.availableFrom} onChange={v => change('availableFrom', v)} />
            <MoneyFields values={values} change={change} />
            <label className="rental-wide">{t("Interne Notizen")}<textarea value={values.notes} onChange={e => change('notes', e.target.value)} /></label>
            <label className="rental-wide">{t("Inseratentwurf (manuell)")}<textarea rows="5" value={values.listing} onChange={e => change('listing', e.target.value)} /></label>
            <div className="rental-wide"><button className="btn-primary" disabled={busy}>{t("Vorgang speichern")}</button></div>
        </form>
    </section>;
}

function RentalDetail({ rental, workflow, property, documents }) {
    const { t } = useTranslation();
    const [editingApplication, setEditingApplication] = useState(null);
    const [addingApplication, setAddingApplication] = useState(false);
    const [editingViewing, setEditingViewing] = useState(null);
    const [addingViewing, setAddingViewing] = useState(false);
    const locked = ['Completed', 'Archived'].includes(rental.phase);
    const selected = rental.applications.find(a => a.id === rental.selectedApplicationId);
    return <>
        <Link to={`/rentals?propertyId=${rental.propertyId}`}>{t("← Zur Übersicht und den Mietverhältnissen")}</Link>
        <section className="rental-section"><h2>{rental.title}</h2><p><Link to={`/properties/${rental.propertyId}`}>{property?.name}</Link> · {t(RENTAL_PHASES[rental.phase])}</p>
            {!locked && <label>{t("Bearbeitungsphase")}<select value={rental.phase} disabled={workflow.busy} onChange={e => workflow.save(`/${rental.id}`, { phase: e.target.value }, 'PUT')}>
                {Object.entries(RENTAL_PHASES).filter(([key]) => !['Completed', 'Archived'].includes(key)).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
            </select></label>}
            {!locked && <details><summary>{t("Vorgang abbrechen")}</summary><p>{t("Der Vorgang bleibt lesbar. Es wird kein Mietverhältnis angelegt.")}</p><button className="btn-outline" disabled={workflow.busy} onClick={() => workflow.save(`/${rental.id}`, { phase: 'Archived' }, 'PUT')}>{t("Vorgang archivieren")}</button></details>}
            {locked && <><p>{rental.phase === 'Completed' ? t("Der Abschluss ist gespeichert. Zeitraum und Status findest du in der Übersicht unter Mietverhältnisse.") : t("Dieser Vorgang wurde archiviert.")}</p><p>{rental.notes}</p><p className="rental-prewrap">{rental.listing}</p></>}
        </section>
        {!locked && <RentalForm rental={rental} property={property} busy={workflow.busy} onSave={values => workflow.save(`/${rental.id}`, values, 'PUT')} />}
        <section className="rental-section"><h2>{t("Interessenten und Vertragsparteien")}</h2>
            {!locked && <button className="btn-outline" onClick={() => { setAddingApplication(true); setEditingApplication(null); }}>{t("Bewerbung hinzufügen")}</button>}
            {rental.applications.length === 0 && <p>{t("Noch keine Interessenten erfasst.")}</p>}
            {rental.applications.map(a => <article className="rental-summary" key={a.id}>
                <div><h3>{a.parties.map(p => p.name).join(' & ')}</h3><p>{t(a.status)}{a.id === rental.selectedApplicationId ? t(" · Ausgewählt") : ''}</p>
                    {a.parties.map((p, i) => <p key={i}>{p.email} {p.phone}</p>)}<p className="rental-prewrap">{a.inquiry}</p><p className="rental-prewrap">{a.notes}</p></div>
                {!locked && <div className="rental-actions"><button className="btn-outline" onClick={() => { setEditingApplication(a); setAddingApplication(false); }}>{t("Bewerbung bearbeiten")}</button>
                    <button className="btn-outline" disabled={workflow.busy || ['Withdrawn', 'Rejected'].includes(a.status)} onClick={() => workflow.save(`/${rental.id}`, { selectedApplicationId: a.id }, 'PUT')}>{t("Für Vertrag auswählen")}</button></div>}
            </article>)}
            {!locked && (addingApplication || editingApplication) && <ApplicationForm key={editingApplication?.id || 'new'} application={editingApplication} busy={workflow.busy} onCancel={() => { setAddingApplication(false); setEditingApplication(null); }} onSave={async values => {
                const result = await workflow.save(`/${rental.id}/applications${editingApplication ? `/${editingApplication.id}` : ''}`, values, editingApplication ? 'PUT' : 'POST');
                if (result) { setAddingApplication(false); setEditingApplication(null); }
            }} />}
        </section>
        <section className="rental-section"><h2>{t("Besichtigungen")}</h2><p>{t("Datum und Uhrzeit gelten am Ort der Wohnung.")}</p>
            {!locked && <button className="btn-outline" disabled={!rental.applications.length} onClick={() => { setAddingViewing(true); setEditingViewing(null); }}>{t("Besichtigung hinzufügen")}</button>}
            {rental.viewings.map(v => <article className="rental-summary" key={v.id}><div><h3>{v.date} · {v.time}</h3><p>{rental.applications.find(a => a.id === v.applicationId)?.parties.map(p => p.name).join(' & ')} · {{ Scheduled: t("Geplant"), Done: t("Durchgeführt"), Cancelled: t("Abgesagt") }[v.status]}</p><p className="rental-prewrap">{v.notes}</p></div>
                {!locked && <button className="btn-outline" onClick={() => { setEditingViewing(v); setAddingViewing(false); }}>{t("Termin bearbeiten")}</button>}</article>)}
            {!locked && (addingViewing || editingViewing) && <ViewingForm key={editingViewing?.id || 'new'} viewing={editingViewing} applications={rental.applications} busy={workflow.busy} onCancel={() => { setAddingViewing(false); setEditingViewing(null); }} onSave={async values => {
                const result = await workflow.save(`/${rental.id}/viewings${editingViewing ? `/${editingViewing.id}` : ''}`, values, editingViewing ? 'PUT' : 'POST');
                if (result) { setAddingViewing(false); setEditingViewing(null); }
            }} />}
        </section>
        {!locked && <section className="rental-section"><h2>{t("Mietverhältnis übernehmen")}</h2><p>{t("Nach externer Unterzeichnung: Vertrag in der Wohnungsakte als „Mietverträge“ hochladen und hier zuordnen. Eine Vertragsgenerierung folgt in einem späteren Schritt.")}</p>
            {selected ? <CompletionForm key={`${rental.id}-${selected.id}`} rental={rental} selected={selected} documents={documents.filter(d => d.propertyId === rental.propertyId && d.category === 'Leases' && d.hasFile)} busy={workflow.busy} onSave={values => workflow.save(`/${rental.id}/complete`, values)} /> : <p>{t("Zuerst eine Bewerbung für den Vertrag auswählen.")}</p>}
        </section>}
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
        <Field label={t("Uhrzeit")} type="time" required value={values.time} onChange={v => change('time', v)} />
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
function LeaseList({ workflow, properties, tenants, propertyId }) {
    const { t } = useTranslation();
    return <section className="rental-section"><h2>{t("Mietverhältnisse")}</h2><p>{t("Beginn und Ende bestimmen den Status automatisch. Ein Enddatum zählt als letzter Miettag.")}</p>
        {!workflow.leases.length && <p>{t("Noch keine Mietverhältnisse bestätigt.")}</p>}
        {workflow.leases.filter(l => !propertyId || l.propertyId === propertyId).map(lease => <article className="lease-card" key={lease.id}>
            <h3>{properties.find(p => p.id === lease.propertyId)?.name} · {t(LEASE_STATUSES[lease.status])}</h3>
            <p>{lease.tenantIds.map(id => tenants.find(tenant => tenant.id === id)?.name || 'Vertragspartei').join(' & ')}</p>
            <p>{lease.start}{" "}{t("bis")}{" "}{lease.end || t("unbefristet")}{" "}{t("· Kaltmiete")}{" "}{amountLabel(lease.coldRentCents)}{" "}{t("· Nebenkosten")}{" "}{amountLabel(lease.utilitiesCents)}</p>
            {lease.contractDocumentId && <a className="btn-outline" href={fileService.url(lease.contractDocumentId)}>{t("Vertrag herunterladen")}</a>}
            <details><summary>{t("Mietende festlegen oder korrigieren")}</summary><LeaseEndForm key={`${lease.id}-${lease.end}`} lease={lease} busy={workflow.busy} onSave={values => workflow.save(`/leases/${lease.id}/end`, values, 'PUT')} /></details>
        </article>)}
    </section>;
}
function LeaseEndForm({ lease, busy, onSave }) {
    const { t } = useTranslation();
    const [end, setEnd] = useState(lease.end || '');
    return <form className="rental-form" onSubmit={e => { e.preventDefault(); onSave({ end }); }}><Field label={t("Letzter Miettag (leer = unbefristet)")} type="date" value={end} onChange={setEnd} /><button className="btn-primary" disabled={busy}>{t("Mietende speichern")}</button></form>;
}
function LegacyConfirmation({ workflow, properties, propertyId }) {
    const { t } = useTranslation();
    const [target, setTarget] = useState(propertyId);
    const property = properties.find(p => p.id === target);
    const candidates = workflow.legacyTenants.filter(tenant => !tenant.propertyId || tenant.propertyId === target);
    return <section className="rental-section"><h2>{t("Bestandsmieter prüfen")}</h2><p>{t("Vorhandene Zuordnungen bleiben erhalten. Wähle ausdrücklich die Personen aus, die denselben Vertrag unterschrieben haben, und bestätige Zeitraum und Konditionen. Früher vorbelegte Enddaten bitte am Vertrag prüfen.")}</p>
        <label>{t("Wohnung für Bestandsvertrag")}<select value={target} onChange={e => setTarget(e.target.value)}><option value="">{t("Bitte auswählen")}</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        {target && <LegacyForm key={`${target}-${candidates.map(tenant => tenant.id).join(',')}`} property={property} candidates={candidates} workflow={workflow} />}
    </section>;
}
function LegacyForm({ property, candidates, workflow }) {
    const { t } = useTranslation();
    const [values, setValues] = useState(() => ({ ...leaseForm(null, property), propertyId: property.id, tenantIds: [] }));
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    if (!candidates.length) return <p>{t("Keine ungeprüften Bestandsmieter für diese Wohnung.")}</p>;
    return <form className="rental-form" onSubmit={e => { e.preventDefault(); workflow.save('/leases/confirm', values); }}>
        <fieldset className="rental-wide"><legend>{t("Gemeinsame Vertragsparteien auswählen")}</legend>{candidates.map(tenant => <label className="rental-check" key={tenant.id}><input type="checkbox" checked={values.tenantIds.includes(tenant.id)} onChange={e => change('tenantIds', e.target.checked ? [...values.tenantIds, tenant.id] : values.tenantIds.filter(id => id !== tenant.id))} />{tenant.name}{" "}{t("· bisher")}{" "}{tenant.leaseStart || t("Beginn unbekannt")}{" "}{t("bis")}{" "}{tenant.leaseEnd || t("kein Ende angegeben")} ({t(tenant.status)})</label>)}</fieldset>
        <LeaseFields values={values} change={change} />
        <button className="btn-primary" disabled={workflow.busy || !values.tenantIds.length}>{t("Bestandsvertrag bestätigen")}</button>
    </form>;
}
