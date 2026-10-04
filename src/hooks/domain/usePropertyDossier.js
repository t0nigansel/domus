import { useState } from 'react';
import { dossierUpdates, dossierValues } from '../../domain/propertyDossier';

export function usePropertyDossier(property, updateProperty) {
    const [values, setValues] = useState(() => dossierValues(property));
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    return {
        values, busy, message, error,
        change: (key, value) => { setValues(previous => ({ ...previous, [key]: value })); setMessage(''); },
        save: async () => {
            setBusy(true); setMessage(''); setError('');
            try {
                await updateProperty(property.id, dossierUpdates(values));
                setMessage('Stammdaten gespeichert.');
            } catch (err) { setError(err.message); }
            finally { setBusy(false); }
        },
    };
}
