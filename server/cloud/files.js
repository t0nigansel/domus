import { createHash, randomUUID } from 'node:crypto';
import { rentalError } from '../../src/domain/rentals.js';
import { categories } from './entities.js';

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCOUNT_FILE_BYTES = 1024 * 1024 * 1024;
const formats = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function fileMime(name, buffer) {
    // eslint-disable-next-line no-control-regex
    if (typeof name !== 'string' || !name || name.length > 240 || /[\\/\x00-\x1f\x7f]/.test(name)) throw rentalError('Ungültiger Dateiname.');
    const extension = name.split('.').at(-1).toLowerCase();
    const mime = formats[extension];
    const matches = {
        pdf: () => buffer.subarray(0, 5).toString() === '%PDF-',
        jpg: () => buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
        jpeg: () => buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
        png: () => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        webp: () => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP',
        doc: () => buffer.subarray(0, 8).equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225])),
        docx: () => buffer.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])) && buffer.includes(Buffer.from('[Content_Types].xml')) && buffer.includes(Buffer.from('word/document.xml')),
    };
    if (!mime || !matches[extension]()) throw rentalError('Dateiinhalt und Dateityp passen nicht zusammen. Unterstützt werden PDF, Word, JPG, PNG und WebP.');
    return mime;
}

export function fileMetadata(input, data) {
    const propertyId = input.propertyId || null;
    if (propertyId !== null && !data.properties.some(property => property.id === propertyId)) throw rentalError('Wohnung nicht gefunden.', 404);
    const category = input.category || 'Misc';
    if (!categories.includes(category)) throw rentalError('Unbekannte Kategorie.');
    if (input.caption !== undefined && (typeof input.caption !== 'string' || input.caption.length > 2000)) throw rentalError('Beschreibung ist zu lang.');
    for (const key of ['published', 'cover']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw rentalError('Ungültige Freigabe.');
    if (input.position !== undefined && (!Number.isInteger(input.position) || input.position < 0)) throw rentalError('Ungültige Reihenfolge.');
    return { propertyId, category, caption: input.caption || '', published: input.published === true, position: input.position || 0, cover: input.cover === true };
}

export async function storeCloudFile(env, accountId, data, input, buffer) {
    if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw rentalError('Maximal 20 MB pro Datei. Leere Dateien sind nicht möglich.', 413);
    const mime = fileMime(input.name, buffer);
    const metadata = fileMetadata(input, data);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const duplicate = data.documents.find(document => (document.propertyId || null) === metadata.propertyId && data.documentFiles[document.id]?.hash === hash);
    if (duplicate) return { document: duplicate, duplicate: true };
    const used = Object.values(data.documentFiles).reduce((sum, file) => sum + file.bytes, 0);
    if (used + buffer.length > ACCOUNT_FILE_BYTES) throw rentalError('Das Speicherkontingent von 1 GB ist erreicht.', 413);
    const id = randomUUID();
    const key = `${accountId}/${hash}/${id}`;
    // Unique object keys prevent failed/late uploads from replacing an existing file.
    // A scheduled sweep removes objects left by a rollback or interrupted response.
    await env.FILES.put(key, buffer, { httpMetadata: { contentType: mime } });
    const document = { id, name: input.name, ...metadata,
        type: mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'document',
        size: `${(buffer.length / 1024).toFixed(1)} KB`, bytes: buffer.length,
        date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), hasFile: true, version: 1,
    };
    data.documents.push(document);
    data.documentFiles[id] = { hash, mime, name: input.name, bytes: buffer.length, key };
    if (metadata.cover) clearOtherCovers(data, document);
    return { document, duplicate: false };
}

export function clearOtherCovers(data, document) {
    for (const other of data.documents) {
        if (other.id !== document.id && other.propertyId === document.propertyId) other.cover = false;
    }
}

export async function limitedBody(request, maxBytes) {
    if (Number(request.headers.get('Content-Length')) > maxBytes) throw rentalError('Die Anfrage ist zu groß.', 413);
    const chunks = [];
    let size = 0;
    const reader = request.body?.getReader();
    if (!reader) return Buffer.alloc(0);
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > maxBytes) {
                await reader.cancel();
                throw rentalError('Die Anfrage ist zu groß.', 413);
            }
            chunks.push(Buffer.from(value));
        }
        return Buffer.concat(chunks, size);
    } finally {
        reader.releaseLock();
    }
}

export async function readJson(request) {
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw rentalError('Content-Type muss application/json sein.', 415);
    try {
        const data = JSON.parse((await limitedBody(request, 256 * 1024)).toString());
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw rentalError('Ein JSON-Objekt ist erforderlich.');
        return data;
    } catch (error) {
        if (error.status) throw error;
        throw rentalError('Ungültiges JSON.');
    }
}
