import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, realpath, readFile, stat, writeFile } from 'node:fs/promises';
import db from './db.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const formats = {
    '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
};
export const categories = ['Leases', 'Invoices', 'Insurance', 'Misc', 'Photos', 'FloorPlans', 'Energy'];
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const rawRoot = () => path.resolve(process.env.DOMUS_RAW_DIR || path.join(projectRoot, 'rohdaten'));
const fileRoot = () => {
    if (process.env.NODE_ENV === 'test' && !process.env.DOMUS_FILES_DIR) {
        throw failure('Tests require an isolated file directory.', 500);
    }
    return path.resolve(process.env.DOMUS_FILES_DIR || path.join(projectRoot, 'data', 'files'));
};
const inside = (root, target) => {
    const relative = path.relative(root, target);
    return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
};

function fileFormat(name) {
    // Control characters are rejected on purpose: they are never valid in stored file names.
    // eslint-disable-next-line no-control-regex
    if (typeof name !== 'string' || !name || name.length > 240 || /[\\/\x00-\x1f]/.test(name)) {
        throw failure('Ungültiger Dateiname.');
    }
    const mime = formats[path.extname(name).toLowerCase()];
    if (!mime) throw failure('Unterstützt werden PDF, Word, JPG, PNG und WebP.');
    return mime;
}

export function validateMetadata(input) {
    const propertyId = input.propertyId || null;
    if (propertyId !== null && !db.data.properties.some(p => p.id === propertyId)) throw failure('Wohnung nicht gefunden.');
    const category = input.category || 'Misc';
    if (!categories.includes(category)) throw failure('Unbekannte Kategorie.');
    if (input.caption !== undefined && (typeof input.caption !== 'string' || input.caption.length > 2000)) throw failure('Beschreibung ist zu lang.');
    if (input.published !== undefined && typeof input.published !== 'boolean') throw failure('Ungültige Freigabe.');
    if (input.position !== undefined && (!Number.isInteger(input.position) || input.position < 0)) throw failure('Ungültige Reihenfolge.');
    if (input.cover !== undefined && typeof input.cover !== 'boolean') throw failure('Ungültiges Titelbild.');
    return { propertyId, category, caption: input.caption || '', published: input.published === true, position: input.position || 0, cover: input.cover === true };
}

export async function listRawFiles() {
    const result = [];
    let root;
    try { root = await realpath(rawRoot()); } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) continue;
            const full = path.join(directory, entry.name);
            const resolved = await realpath(full);
            if (!inside(root, resolved)) continue;
            if (entry.isDirectory()) await visit(full);
            else if (entry.isFile() && formats[path.extname(entry.name).toLowerCase()]) {
                const info = await stat(full);
                result.push({ path: path.relative(root, full).split(path.sep).join('/'), name: entry.name, bytes: info.size });
            }
        }
    }
    await visit(root);
    return result.sort((a, b) => a.path.localeCompare(b.path));
}

export async function importRawFile(input) {
    if (typeof input.path !== 'string' || path.isAbsolute(input.path) || input.path.includes('\0')) throw failure('Ungültiger Rohdatenpfad.');
    const root = await realpath(rawRoot());
    const requested = path.resolve(root, input.path);
    if (!inside(root, requested)) throw failure('Datei liegt außerhalb des Rohdatenordners.', 403);
    const resolved = await realpath(requested);
    if (!inside(root, resolved)) throw failure('Datei liegt außerhalb des Rohdatenordners.', 403);
    const info = await stat(resolved);
    if (!info.isFile()) throw failure('Keine Datei.');
    if (info.size > MAX_FILE_BYTES) throw failure('Maximal 20 MB pro Datei.', 413);
    fileFormat(path.basename(resolved));
    return storeFile({ ...input, name: path.basename(resolved) }, await readFile(resolved), path.relative(root, requested).split(path.sep).join('/'));
}

export async function storeFile(input, buffer, sourcePath = null) {
    const mime = fileFormat(input.name);
    const metadata = validateMetadata(input);
    if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw failure('Datei muss zwischen 1 Byte und 20 MB groß sein.', 413);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const directory = fileRoot();
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, hash), buffer, { flag: 'wx' }).catch(error => {
        if (error.code !== 'EEXIST') throw error;
    });
    let document;
    let duplicate = false;
    await db.update(data => {
        data.documentFiles ||= {};
        data.documents ||= [];
        document = data.documents.find(d => d.propertyId === metadata.propertyId && data.documentFiles[d.id]?.hash === hash);
        if (document) { duplicate = true; return; }
        const previous = sourcePath ? data.documents.filter(d => d.propertyId === metadata.propertyId && d.sourcePath === sourcePath) : [];
        document = {
            id: randomUUID(), name: input.name, ...metadata,
            type: mime.startsWith('image/') ? 'image' : mime === 'application/pdf' ? 'pdf' : 'document',
            size: `${(buffer.length / 1024).toFixed(1)} KB`, bytes: buffer.length,
            date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
            hasFile: true, sourcePath, version: previous.reduce((max, d) => Math.max(max, d.version || 1), 0) + 1,
        };
        // Storage references are private to this service, never accepted from document CRUD.
        data.documentFiles[document.id] = { hash, mime, name: input.name };
        data.documents.push(document);
    });
    return { document, duplicate };
}

export function storedFile(id) {
    const record = db.data.documentFiles?.[id];
    if (!db.data.documents.some(d => d.id === id) || !record || !/^[a-f0-9]{64}$/.test(record.hash)) throw failure('Keine gespeicherte Datei vorhanden.', 404);
    return { ...record, path: path.join(fileRoot(), record.hash) };
}
