// Same-origin by default; in development Vite proxies /api to the API server.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

let sessionVersion = 0;
export function advanceApiSession() { sessionVersion++; }

export async function sessionFetch(...args) {
    const version = sessionVersion;
    const response = await fetch(...args);
    if (version === sessionVersion && response.status === 401) window.dispatchEvent(new Event('domus:unauthorized'));
    return response;
}

async function responseError(response) {
    try {
        const result = await response.json();
        if (result.error) return new Error(result.error);
    } catch { /* Fall back to the HTTP status for non-JSON responses. */ }
    return new Error(`API call failed: ${response.statusText}`);
}

export const api = {
    get: async (endpoint) => {
        const response = await sessionFetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw await responseError(response);
        }
        return response.json();
    },

    post: async (endpoint, data) => {
        const response = await sessionFetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw await responseError(response);
        }
        return response.json();
    },

    put: async (endpoint, data) => {
        const response = await sessionFetch(`${API_BASE_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw await responseError(response);
        }
        return response.json();
    },

    delete: async (endpoint) => {
        const response = await sessionFetch(`${API_BASE_URL}${endpoint}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw await responseError(response);
        }
        return response.json();
    }
};
