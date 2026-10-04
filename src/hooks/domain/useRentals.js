import { useCallback, useEffect, useState } from 'react';
import { rentalService } from '../../db/services/rentalService';

export function useRentals(refreshAll) {
    const [data, setData] = useState({ rentals: [], leases: [], legacyTenants: [] });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const refresh = useCallback(async () => {
        const result = await rentalService.request();
        setData(result);
    }, []);
    useEffect(() => {
        refresh().catch(err => setError(err.message)).finally(() => setLoading(false));
    }, [refresh]);
    async function save(endpoint, input, method = 'POST') {
        setBusy(true); setError(''); setMessage('');
        try {
            const result = await rentalService.request(endpoint, input, method);
            await refresh();
            await refreshAll();
            setMessage('Gespeichert.');
            return result;
        } catch (err) { setError(err.message); return null; }
        finally { setBusy(false); }
    }
    return { ...data, loading, busy, error, message, save, refresh };
}
