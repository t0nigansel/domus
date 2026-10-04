import { API_BASE_URL } from '../../utils/api';

export const rentalService = {
    async request(endpoint = '', data, method = 'POST') {
        const response = await fetch(`${API_BASE_URL}/rentals${endpoint}`, data === undefined ? {} : {
            method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Vermietung konnte nicht geladen werden.');
        return result;
    },
};
