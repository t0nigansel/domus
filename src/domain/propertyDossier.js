export const dossierFields = [
    ['street', 'Straße und Hausnummer'], ['postalCode', 'Postleitzahl'], ['city', 'Ort'],
    ['floor', 'Etage'], ['size', 'Wohnfläche (m²)', 'number'], ['rooms', 'Zimmer', 'number'],
    ['equipment', 'Ausstattung'], ['heating', 'Heizungsart'],
    ['energyRating', 'Energieklasse'], ['energyDemand', 'Energiekennwert (kWh/m²a)', 'number'],
    ['modernizations', 'Modernisierungen'],
];

export function dossierValues(property) {
    return Object.fromEntries(dossierFields.map(([key]) => [key, property[key] ?? '']));
}

export function dossierUpdates(values) {
    return Object.fromEntries(dossierFields.map(([key, , type]) => {
        if (type === 'number') {
            const value = values[key] === '' ? null : Number(values[key]);
            if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Bitte gültige positive Zahlen eintragen.');
            return [key, value];
        }
        return [key, String(values[key] || '').trim()];
    }));
}
