import { requireMcpAuth } from '@better-auth/mcp';
import { extractText, getDocumentProxy } from 'unpdf';
import { createDomusMcp } from '../mcp/tools.js';
import { domainRequest, json } from './domain-api.js';
import { mcpIdentity, mcpResource, MCP_SCOPE } from './mcp-auth.js';
import { localToday } from '../rentalOperations.js';
import { rentalError } from '../../src/domain/rentals.js';
import { documentParts } from './assistant-documents.js';

const allowedReads = new Set(['/properties', '/tenants', '/rentals', '/costs', '/issues', '/documents', '/buildings']);

export async function mcpRequest(request, env, client, auth) {
    const origin = new URL(env.BETTER_AUTH_URL).origin;
    if (request.headers.has('Origin') && request.headers.get('Origin') !== origin) return json({ error: 'Ungültiger Ursprung.' }, 403);
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    return requireMcpAuth(auth, async (request, claims) => {
        let user;
        try { user = await mcpIdentity(auth, claims); }
        catch (error) {
            if (error.status !== 401) throw error;
            return Response.json({ error: 'MCP-Verbindung ungültig oder getrennt.' }, { status: 401, headers: {
                'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
            } });
        }
        const get = async path => {
            // Caller-controlled URLs, methods and credentials never enter the internal reader.
            const response = await domainRequest(new Request(`${origin}/api${path}`), env, client, user, auth);
            if (!response.ok) throw rentalError('Der Datensatz konnte nicht gelesen werden.', response.status);
            return response;
        };
        const read = async path => {
            if (!allowedReads.has(path)) throw rentalError('Diese Funktion ist nicht freigegeben.', 403);
            return (await get(path)).json();
        };
        const readDocument = async (id, { query, offset, limit }) => {
            const doc = (await read('/documents')).find(doc => doc.id === id);
            if (!doc) throw rentalError('Dokument nicht gefunden.', 404);
            if (!doc.hasFile) return { documentId: id, name: doc.name, pages: [], warning: 'Keine Originaldatei vorhanden.' };
            const file = await get(`/files/${encodeURIComponent(id)}/content`);
            const mime = file.headers.get('Content-Type');
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (bytes.length > 20 * 1024 * 1024) throw rentalError('Dokument ist zu groß.');
            let texts;
            if (mime === 'application/pdf') {
                const pdf = await getDocumentProxy(bytes);
                try {
                    if (pdf.numPages > 100) throw rentalError('Dokument hat mehr als 100 Seiten.');
                    texts = (await extractText(pdf)).text;
                } finally { await pdf.loadingTask.destroy(); }
            } else if (mime?.endsWith('wordprocessingml.document')) {
                texts = (await documentParts({ mime, name: doc.name }, bytes)).map(part => part.text);
            } else return { documentId: id, name: doc.name, pages: [], warning: 'Kein auslesbarer PDF-/DOCX-Text. Bilder und Scans benötigen OCR.' };
            const pages = texts.map((text, index) => ({ page: index + 1, text })).filter(page => !query || page.text.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de')));
            const selected = pages.slice(offset, offset + limit).map(page => {
                const position = query ? Math.max(0, page.text.toLocaleLowerCase('de').indexOf(query.toLocaleLowerCase('de')) - 300) : 0;
                return { page: page.page, text: page.text.slice(position, position + 8000), truncated: position > 0 || page.text.length > position + 8000 };
            });
            return { documentId: id, name: doc.name, untrusted: true, sourceType: mime === 'application/pdf' ? 'pdf-page' : 'docx-section', pages: selected, totalPages: texts.length, matchedPages: pages.length,
                nextOffset: offset + limit < pages.length ? offset + limit : null,
                ...(!texts.some(text => text.trim()) ? { warning: 'Kein Text auslesbar. Ein Scan benötigt OCR; daraus ist keine Aussage über den Inhalt möglich.' } : {}) };
        };
        const handler = createDomusMcp({ read, readDocument, today: localToday() });
        const response = await handler.fetch(request);
        // Legacy SDK responses may stream while tools still use this request's database client.
        // Finish the read before the Worker releases the client back to the pool.
        return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
    }, { resource: mcpResource(env), requiredScopes: [MCP_SCOPE] })(request);
}
