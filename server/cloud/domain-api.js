import { createRentalService } from '../rentalOperations.js';
import { rentalError } from '../../src/domain/rentals.js';
import { accountAction, ensureAccount } from './store.js';
import { changeEntity, readEntities } from './entities.js';
import { clearOtherCovers, fileMetadata, limitedBody, MAX_FILE_BYTES, readJson, storeCloudFile } from './files.js';
import { renameDocument } from '../../src/domain/documents.js';

export function json(data, status = 200) {
    return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function domainRequest(request, env, client, user) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent).slice(1);
    const [resource, id, operation, childId] = parts;
    const method = request.method;
    const write = !['GET', 'HEAD'].includes(method);
    if (write && request.headers.get('Origin') !== new URL(env.BETTER_AUTH_URL).origin) throw rentalError('Ungültiger Ursprung der Anfrage.', 403);
    const account = await ensureAccount(client, user);
    if (resource === 'session' && method === 'GET') return json({ user: { id: user.id, name: user.name, email: user.email }, account });

    let input;
    let upload;
    if (write && method !== 'DELETE') {
        if (resource === 'files' && id === 'upload') {
            if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data')) throw rentalError('Bitte eine Datei als Multipart-Upload senden.', 415);
            const body = await limitedBody(request, MAX_FILE_BYTES + 64 * 1024);
            let form;
            try { form = await new Response(body, { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData(); }
            catch { throw rentalError('Ungültiger Upload.'); }
            const file = form.get('file');
            if (!file || typeof file.arrayBuffer !== 'function') throw rentalError('Bitte eine Datei auswählen.');
            input = { name: file.name, propertyId: form.get('propertyId') || null, category: form.get('category') || 'Misc' };
            upload = Buffer.from(await file.arrayBuffer());
        } else input = await readJson(request);
    }
    const audit = write ? { action: method, entity: resource } : null;
    return accountAction(client, account, user.id, async data => {
        if (resource === 'files') {
            if (method === 'POST' && id === 'upload' && parts.length === 2) {
                const recent = await client.query("SELECT count(*)::int AS count FROM audit_log WHERE account_id = $1 AND entity = 'files' AND action = 'POST' AND created_at > now() - interval '1 hour'", [account.id]);
                if (recent.rows[0].count >= 100) throw rentalError('Upload-Limit erreicht. Bitte später erneut versuchen.', 429);
                const result = await storeCloudFile(env, account.id, data, input, upload);
                return json(result, result.duplicate ? 200 : 201);
            }
            if (method === 'GET' && operation === 'content' && parts.length === 3) {
                const file = data.documentFiles[id];
                const document = data.documents.find(document => document.id === id);
                if (!file || !document) throw rentalError('Datei nicht gefunden.', 404);
                const object = await env.FILES.get(file.key);
                if (!object) throw rentalError('Datei nicht gefunden.', 404);
                const inline = url.searchParams.get('preview') === '1' && (file.mime.startsWith('image/') || file.mime === 'application/pdf');
                return new Response(object.body, { headers: {
                    'Content-Type': file.mime, 'Content-Length': String(object.size), 'Cache-Control': 'no-store',
                    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'",
                    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(document.name || file.name).replace(/'/g, '%27')}`,
                } });
            }
            if (method === 'PUT' && operation === 'metadata' && parts.length === 3) {
                const document = data.documents.find(document => document.id === id);
                if (!document) throw rentalError('Dokument nicht gefunden.', 404);
                const metadata = fileMetadata({ ...document, ...input }, data);
                if (input.name !== undefined) metadata.name = renameDocument(input.name, data.documentFiles[id]?.name || document.name);
                if (data.leases.some(lease => lease.contractDocumentId === id) && (metadata.propertyId !== document.propertyId || metadata.category !== 'Leases')) throw rentalError('Ein zugeordneter Mietvertrag muss bei seinem Mietverhältnis bleiben.', 409);
                Object.assign(document, metadata);
                if (metadata.cover) clearOtherCovers(data, document);
                return json(document);
            }
            throw rentalError('Dateifunktion nicht gefunden.', 404);
        }

        if (resource === 'rentals') {
            const service = createRentalService({ data, update: async action => action(data) });
            if (method === 'GET' && parts.length === 1) return json(service.overview());
            if (method === 'POST' && parts.length === 1) return json(await service.createRental(input), 201);
            if (method === 'POST' && id === 'leases' && operation === 'confirm' && parts.length === 3) return json(await service.confirmLegacyLease(input), 201);
            if (method === 'PUT' && id === 'leases' && childId === 'end' && parts.length === 4) return json(await service.updateLease(operation, input));
            if (method === 'PUT' && parts.length === 2) return json(await service.updateRental(id, input));
            if (method === 'POST' && operation === 'complete' && parts.length === 3) return json(await service.completeRental(id, input));
            if (['POST', 'PUT'].includes(method) && ['applications', 'viewings'].includes(operation) && parts.length === (method === 'POST' ? 3 : 4)) {
                const action = operation === 'applications' ? service.saveApplication : service.saveViewing;
                return json(await action(id, method === 'PUT' ? childId : null, input), method === 'POST' ? 201 : 200);
            }
            throw rentalError('Vermietungsfunktion nicht gefunden.', 404);
        }

        if (['properties', 'tenants', 'documents', 'issues', 'costs', 'contacts'].includes(resource) && parts.length <= 2) {
            if (method === 'GET') {
                const rows = readEntities(data, resource);
                if (!id) return json(rows);
                const row = rows.find(item => item.id === id);
                if (!row) throw rentalError('Eintrag nicht gefunden.', 404);
                return json(row);
            }
            if ((method === 'POST' && !id) || (['PUT', 'DELETE'].includes(method) && id)) {
                return json(changeEntity(data, resource, method, id, input), method === 'POST' ? 201 : 200);
            }
        }
        throw rentalError('Funktion nicht gefunden.', 404);
    }, audit);
}
