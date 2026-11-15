import { moneyCents, validDate } from './rentals';

export const conditionOptions = ['Good', 'Ok', 'Bad', 'Needs Repair', 'Renovated'];
export const leaseDossierFields = ['tenantName', 'moveInDate', 'coldRent', 'nebenkosten'];

export const dossierFields = [
    ['name', 'Bezeichnung'], ['status', 'Status', 'status'], ['location', 'Lage'],
    ['tenantName', 'Mieter'], ['moveInDate', 'Einzugsdatum', 'date'],
    ['coldRent', 'Kaltmiete (€ / Monat)', 'number'], ['nebenkosten', 'Nebenkosten (€ / Monat)', 'number'],
    ['condition', 'Zustand', 'select'], ['pets', 'Haustiere'],
    ['occupants', 'Bewohner', 'number'],
    ['occupancyNote', 'Belegungstext', 'textarea'],
    ['street', 'Straße und Hausnummer'], ['postalCode', 'Postleitzahl'], ['city', 'Ort'],
    ['floor', 'Etage'], ['size', 'Wohnfläche (m²)', 'number'], ['rooms', 'Zimmer', 'number'],
    ['equipment', 'Ausstattung'], ['heating', 'Heizungsart'],
    ['energyRating', 'Energieklasse'], ['energyDemand', 'Energiekennwert (kWh/m²a)', 'number'],
    ['modernizations', 'Modernisierungen'],
    ['notes', 'Übernommene Notizen', 'textarea'],
];

export function dossierValues(property) {
    const values = Object.fromEntries(dossierFields.map(([key]) => [key, property[key] ?? '']));
    values.tenantName = property.tenantName ?? property.residents?.filter(resident => resident.role === 'Tenant').map(resident => resident.name).join(' & ') ?? '';
    values.occupancyNote = property.occupancyNote ?? (['NonRental', 'Usufruct'].includes(property.occupancyKind)
        ? [property.occupancyKind === 'Usufruct' ? 'Bewohner mit Nießbrauch, kein Mieter' : 'Bewohner, kein Mietverhältnis', ...(property.residents || []).map(resident => resident.name)].join('\n')
        : '');
    return values;
}

export function dossierUpdates(values, property = {}, keys = dossierFields.map(([key]) => key)) {
    return Object.fromEntries(dossierFields.filter(([key]) => keys.includes(key) && (!property.leaseManaged || ![...leaseDossierFields, 'occupants', 'status'].includes(key))).map(([key, , type]) => {
        if (key === 'name' && !String(values[key] || '').trim()) throw new Error('Bitte eine Bezeichnung angeben.');
        if (key === 'status' && !['Occupied', 'Vacant', 'Maintenance'].includes(values[key])) throw new Error('Bitte einen gültigen Status auswählen.');
        if (type === 'date') return [key, validDate(values[key], 'Einzugsdatum', true)];
        if (['coldRent', 'nebenkosten'].includes(key)) return [key, values[key] === '' ? null : moneyCents(values[key], key) / 100];
        if (key === 'condition' && values[key] !== '' && !conditionOptions.includes(values[key])) throw new Error('Bitte einen gültigen Zustand auswählen.');
        if (type === 'number') {
            const value = values[key] === '' ? null : Number(values[key]);
            if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Bitte gültige positive Zahlen eintragen.');
            if (key === 'occupants' && value !== null && !Number.isInteger(value)) throw new Error('Bitte eine ganze Bewohnerzahl eintragen.');
            return [key, value];
        }
        return [key, String(values[key] || '').trim()];
    }));
}
