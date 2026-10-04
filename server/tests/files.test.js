// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import app from '../app.js';
import db from '../db.js';

let directory;
beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'domus-files-test-'));
    vi.stubEnv('DOMUS_RAW_DIR', path.join(directory, 'raw'));
    vi.stubEnv('DOMUS_FILES_DIR', path.join(directory, 'files'));
    await mkdir(path.join(directory, 'raw'));
    db.data.documents = [];
    db.data.documentFiles = {};
    db.data.properties = [{ id: 'test-unit' }, { id: 'other-unit' }];
});
afterEach(async () => {
    vi.unstubAllEnvs();
    // Only remove the freshly-created isolated temporary test directory.
    if (directory && path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('domus-files-test-')) await rm(directory, { recursive: true, force: true });
});
const upload = (overrides = {}) => request(app).post('/api/files/upload').send({
    name: 'example.pdf', propertyId: 'test-unit', category: 'FloorPlans',
    base64: Buffer.from('%PDF-1.4\nfictional example').toString('base64'), ...overrides,
});

describe('Managed files', () => {
    it('stores bytes outside metadata and downloads after database reload', async () => {
        const result = await upload();
        expect(result.status).toBe(201);
        const id = result.body.document.id;
        expect(result.body.document).not.toHaveProperty('base64');
        await db.read();
        const download = await request(app).get(`/api/files/${id}/content`);
        expect(download.status).toBe(200);
        expect(download.headers['content-disposition']).toContain('attachment');
        expect(download.body.toString()).toBe('%PDF-1.4\nfictional example');
        expect(download.headers['x-content-type-options']).toBe('nosniff');
    });
    it('deduplicates within a property but supports assigning the same bytes elsewhere', async () => {
        const first = await upload();
        const second = await upload();
        expect(second.status).toBe(200);
        expect(second.body.duplicate).toBe(true);
        expect(second.body.document.id).toBe(first.body.document.id);
        expect((await upload({ propertyId: 'other-unit' })).status).toBe(201);
        expect(db.data.documents).toHaveLength(2);
    });
    it('imports without modifying originals and retains changed versions', async () => {
        const original = path.join(directory, 'raw', 'plan.pdf');
        await writeFile(original, '%PDF original');
        const payload = { path: 'plan.pdf', propertyId: 'test-unit', category: 'FloorPlans' };
        const first = await request(app).post('/api/files/import').send(payload);
        expect(first.status).toBe(201);
        expect(await readFile(original, 'utf8')).toBe('%PDF original');
        await writeFile(original, '%PDF changed');
        const second = await request(app).post('/api/files/import').send(payload);
        expect(second.body.document.version).toBe(2);
        expect(db.data.documents).toHaveLength(2);
        const oldFile = await request(app).get(`/api/files/${first.body.document.id}/content`);
        expect(oldFile.body.toString()).toBe('%PDF original');
    });
    it('lists supported files recursively and excludes the source notes', async () => {
        await mkdir(path.join(directory, 'raw', 'unit'));
        await writeFile(path.join(directory, 'raw', 'unit', 'photo.jpg'), 'image');
        await writeFile(path.join(directory, 'raw', 'informationsquellen.md'), 'notes');
        const result = await request(app).get('/api/files/raw-files');
        expect(result.body.map(file => file.path)).toEqual(['unit/photo.jpg']);
    });
    it('rejects traversal, absolute paths and directory junction escapes', async () => {
        await writeFile(path.join(directory, 'outside.pdf'), 'outside');
        expect((await request(app).post('/api/files/import').send({ path: '../outside.pdf' })).status).toBe(403);
        expect((await request(app).post('/api/files/import').send({ path: path.join(directory, 'outside.pdf') })).status).toBe(400);
        await mkdir(path.join(directory, 'external'));
        await writeFile(path.join(directory, 'external', 'private.pdf'), 'private');
        await symlink(path.join(directory, 'external'), path.join(directory, 'raw', 'link'), process.platform === 'win32' ? 'junction' : 'dir');
        expect((await request(app).post('/api/files/import').send({ path: 'link/private.pdf' })).status).toBe(403);
        expect((await request(app).get('/api/files/raw-files')).body).toEqual([]);
    });
    it('validates uploads and does not expose fake legacy storage references', async () => {
        expect((await upload({ name: '../bad.pdf' })).status).toBe(400);
        expect((await upload({ name: 'script.html' })).status).toBe(400);
        expect((await upload({ base64: 'invalid' })).status).toBe(400);
        expect((await upload({ propertyId: 'missing' })).status).toBe(400);
        expect((await upload({ base64: '' })).status).toBe(413);
        const forged = await request(app).post('/api/documents').send({ name: 'fake.pdf', hasFile: true, path: 'server/db.json' });
        expect((await request(app).get(`/api/files/${forged.body.id}/content`)).status).toBe(404);
    });
    it('edits allowed metadata without changing original filename or content', async () => {
        const result = await upload();
        const id = result.body.document.id;
        const updated = await request(app).put(`/api/files/${id}/metadata`).send({ caption: 'Grundriss', published: true, name: 'changed.pdf', hash: 'bad' });
        expect(updated.status).toBe(200);
        expect(updated.body.caption).toBe('Grundriss');
        expect(updated.body.name).toBe('example.pdf');
        expect((await request(app).get(`/api/files/${id}/content`)).body.toString()).toContain('fictional');
    });
    it('rejects oversized files and non-JSON writes', async () => {
        const result = await upload({ base64: Buffer.alloc(20 * 1024 * 1024 + 1, 42).toString('base64') });
        expect(result.status).toBe(413);
        expect((await request(app).post('/api/files/import').type('text/plain').send('{}')).status).toBe(415);
    });
});
