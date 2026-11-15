import { useTranslation } from '../i18n';
import React from 'react';
import { useData } from '../context/DataContext';
import { usePropertyDossier } from '../hooks/domain/usePropertyDossier';
import { conditionOptions, dossierFields, dossierValues, leaseDossierFields } from '../domain/propertyDossier';
import './DocumentWorkspace.css';

export default function PropertyDossier({ property, title = 'Wohnungsakte', fields = dossierFields.map(([key]) => key), children, areaPending = false }) {
    const { t, locale } = useTranslation();
    const { updateProperty } = useData();
    const form = usePropertyDossier(property, updateProperty, fields);
    const shown = dossierValues(property);
    const selectedFields = fields.map(key => dossierFields.find(field => field[0] === key));
    const locked = key => property.leaseManaged && [...leaseDossierFields, 'occupants', 'status'].includes(key);
    const display = (key, value) => {
        if (value === '' || value == null) return t('Noch nicht erfasst');
        if (['coldRent', 'nebenkosten'].includes(key)) return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value);
        if (key === 'moveInDate') return new Date(`${value}T12:00:00`).toLocaleDateString(locale);
        if (['condition', 'status'].includes(key)) return t(value);
        if (typeof value === 'number') return `${value.toLocaleString(locale)}${key === 'size' ? ' m²' : ''}`;
        return value;
    };
    return <section className="details-card" aria-label={t(title)}>
        <div className="card-header-row">
            <h2 className="card-title">{t(title)}</h2>
            {!form.editing && <button className="btn-outline small" onClick={form.edit}>{t('Bearbeiten')}</button>}
        </div>
        {form.editing ? <form className="dossier-form" onSubmit={e => { e.preventDefault(); form.save(); }}>
            {selectedFields.map(([key, label, type = 'text']) => <label key={key} className={key === 'occupancyNote' ? 'property-wide-field' : undefined}>{t(label)}
                {['select', 'status'].includes(type) ? <select value={form.values[key]} disabled={form.busy || locked(key)} onChange={e => form.change(key, e.target.value)}>
                    {type !== 'status' && <option value="">{t('Noch nicht erfasst')}</option>}
                    {(type === 'status' ? ['Occupied', 'Vacant', 'Maintenance'] : conditionOptions).map(value => <option key={value} value={value}>{t(value)}</option>)}
                </select> : type === 'textarea' ? <textarea rows="4" value={form.values[key]} disabled={form.busy} onChange={e => form.change(key, e.target.value)} />
                    : <input name={key} type={type} required={key === 'name'} disabled={form.busy || locked(key)} min={type === 'number' ? '0' : undefined} step={type === 'number' ? (['coldRent', 'nebenkosten'].includes(key) ? '0.01' : key === 'occupants' ? '1' : 'any') : undefined} value={form.values[key]} onChange={e => form.change(key, e.target.value)} />}
            </label>)}
            <div className="dossier-actions">
                <button className="btn-primary" disabled={form.busy}>{form.busy ? t('Speichert …') : t('Stammdaten speichern')}</button>
                <button type="button" className="btn-outline" disabled={form.busy} onClick={form.cancel}>{t('Cancel')}</button>
            </div>
        </form> : <dl className="property-facts">
            {selectedFields.map(([key, label]) => <div key={key} className={key === 'occupancyNote' ? 'property-wide-field' : undefined}><dt>{t(label)}</dt><dd>{display(key, shown[key])}{key === 'size' && areaPending && <span className="property-pending">{t('Quelle ungeprüft')}</span>}</dd></div>)}
        </dl>}
        {form.message && <p role="status" className="file-status">{t(form.message)}</p>}
        {form.error && <p role="alert" className="file-error">{t(form.error)}</p>}
        {children}
    </section>;
}
