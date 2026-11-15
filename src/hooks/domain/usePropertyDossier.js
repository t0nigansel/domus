import { useState } from 'react';
import { dossierUpdates, dossierValues } from '../../domain/propertyDossier';

export function usePropertyDossier(property, updateProperty, keys) {
    const [values, setValues] = useState(() => dossierValues(property));
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [editing, setEditing] = useState(false);
    return {
        values, busy, message, error, editing,
        edit: () => { setValues(dossierValues(property)); setMessage(''); setError(''); setEditing(true); },
        cancel: () => { setEditing(false); setError(''); },
        change: (key, value) => { setValues(previous => ({ ...previous, [key]: value })); setMessage(''); },
        save: async () => {
            setBusy(true); setMessage(''); setError('');
            try {
                const updated = await updateProperty(property.id, dossierUpdates(values, property, keys));
                setValues(dossierValues(updated));
                setEditing(false);
                setMessage('Stammdaten gespeichert.');
            } catch (err) { setError(err.message); }
            finally { setBusy(false); }
        },
    };
}
