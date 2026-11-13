import express from 'express';
import db from './db.js';
import { importRawFile, listRawFiles, storeFile, storedFile, validateMetadata } from './fileStore.js';
import { renameDocument } from '../src/domain/documents.js';

export const fileRouter = express.Router();
fileRouter.use((req, res, next) => {
    if (['POST', 'PUT'].includes(req.method) && !req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' });
    next();
});
fileRouter.use(express.json({ limit: '28mb' }));
fileRouter.get('/raw-files', async (_req, res) => res.json(await listRawFiles()));
fileRouter.post('/import', async (req, res) => {
    const result = await importRawFile(req.body || {});
    res.status(result.duplicate ? 200 : 201).json(result);
});
fileRouter.post('/upload', async (req, res) => {
    const input = req.body || {};
    if (typeof input.base64 !== 'string') return res.status(400).json({ error: 'Ungültiger Dateiinhalt.' });
    const buffer = Buffer.from(input.base64, 'base64');
    if (buffer.toString('base64') !== input.base64) return res.status(400).json({ error: 'Ungültiger Dateiinhalt.' });
    const result = await storeFile(input, buffer);
    res.status(result.duplicate ? 200 : 201).json(result);
});
fileRouter.get('/:id/content', (req, res, next) => {
    const file = storedFile(req.params.id);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "sandbox; default-src 'none'");
    res.set('Cache-Control', 'no-store');
    if (req.query.preview === '1' && (file.mime.startsWith('image/') || file.mime === 'application/pdf')) {
        res.type(file.mime).sendFile(file.path, error => { if (error) next(error); });
    } else {
        // Download unter dem aktuellen (ggf. umbenannten) Dokumentnamen.
        const name = db.data.documents.find(d => d.id === req.params.id)?.name || file.name;
        res.download(file.path, name, error => { if (error) next(error); });
    }
});
fileRouter.put('/:id/metadata', async (req, res) => {
    const document = db.data.documents.find(d => d.id === req.params.id);
    if (!document) return res.status(404).json({ error: 'Dokument nicht gefunden.' });
    const metadata = validateMetadata({ ...document, ...req.body });
    if (req.body?.name !== undefined) metadata.name = renameDocument(req.body.name, db.data.documentFiles?.[document.id]?.name || document.name);
    await db.update(data => {
        Object.assign(data.documents.find(d => d.id === req.params.id), metadata);
        if (metadata.cover) {
            for (const other of data.documents) {
                if (other.id !== document.id && other.propertyId === metadata.propertyId) other.cover = false;
            }
        }
    });
    res.json(document);
});
fileRouter.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
    res.status(status).json({ error: status === 500 ? 'Datei konnte nicht verarbeitet werden.' : error.message });
});
