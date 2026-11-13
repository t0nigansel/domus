import { API_BASE_URL, sessionFetch } from '../../utils/api';

async function request(endpoint, data, method = 'POST') {
    const response = await sessionFetch(`${API_BASE_URL}/files${endpoint}`, data === undefined ? {} : {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Datei konnte nicht verarbeitet werden.');
    return result;
}

export const fileService = {
    listRaw: () => request('/raw-files'),
    importRaw: data => request('/import', data),
    update: (id, data) => request(`/${encodeURIComponent(id)}/metadata`, data, 'PUT'),
    url: (id, preview = false) => `${API_BASE_URL}/files/${encodeURIComponent(id)}/content${preview ? '?preview=1' : ''}`,
    async upload(file, metadata) {
        if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Maximal 20 MB pro Datei; leere Dateien sind nicht möglich.');
        if (import.meta.env.MODE === 'cloud') {
            const form = new FormData();
            form.append('file', file);
            form.append('propertyId', metadata.propertyId || '');
            form.append('category', metadata.category || 'Misc');
            const response = await sessionFetch(`${API_BASE_URL}/files/upload`, { method: 'POST', body: form });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Datei konnte nicht hochgeladen werden.');
            return result;
        }
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
            reader.readAsDataURL(file);
        });
        return request('/upload', { ...metadata, name: file.name, base64 });
    },
};
