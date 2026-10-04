import React from 'react';
import { useData } from '../context/DataContext';
import { usePropertyDossier } from '../hooks/domain/usePropertyDossier';
import { dossierFields } from '../domain/propertyDossier';
import DocumentWorkspace from './DocumentWorkspace';
import { fileService } from '../db/services/fileService';

export default function PropertyDossier({ property }) {
    const { updateProperty } = useData();
    const form = usePropertyDossier(property, updateProperty);
    return <section className="details-card" style={{ marginTop: 'var(--spacing-lg)' }}>
        <h2>Wohnungsakte</h2>
        {property.residents?.length > 0 && <div>
            <h3>Belegung laut Eigentümer</h3>
            {property.residents.map((resident, index) => <p key={index}>{resident.name} · {resident.role === 'UsufructResident' ? 'Bewohner mit Nießbrauch, kein Mieter' : resident.role === 'Resident' ? 'Bewohner, kein Mietverhältnis' : 'Mieter'} · Stand {resident.confirmedAsOf}</p>)}
        </div>}
        {property.importReview?.length > 0 && <div>
            <h3>Importierte Angaben zur Prüfung</h3>
            {property.importReview.map((item, index) => <p key={index}>
                {item.label}: {item.value} {item.unit} ({item.sourceDate}).
                {item.conflictingOlderValues?.length > 0 && ` Ältere Quellen: ${item.conflictingOlderValues.join(', ')} ${item.unit}.`}
                {' '}<a href={fileService.url(item.sourceDocumentId, true)} target="_blank" rel="noreferrer">Quelle ansehen</a>
                {' '}Nach Prüfung in die Stammdaten übernehmen.
            </p>)}
        </div>}
        <p className="text-muted">Bestätigte Stammdaten deiner Wohnung. Unbekannte Angaben bleiben leer.</p>
        <form className="dossier-form" onSubmit={e => { e.preventDefault(); form.save(); }}>
            {dossierFields.map(([key, label, type = 'text']) => <label key={key}>{label}
                <input type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} value={form.values[key]} onChange={e => form.change(key, e.target.value)} />
            </label>)}
            <div className="dossier-actions">
                <button className="btn-primary" disabled={form.busy}>{form.busy ? 'Speichert …' : 'Stammdaten speichern'}</button>
                {form.message && <span role="status">{form.message}</span>}
                {form.error && <span role="alert" className="file-error">{form.error}</span>}
            </div>
        </form>
        <h2 style={{ marginTop: 32 }}>Fotos, Grundrisse und Dokumente</h2>
        <DocumentWorkspace propertyId={property.id} />
    </section>;
}
