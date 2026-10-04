// @vitest-environment node
import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import db from '../db.js';
import { tenancyView, migrateRentals, moneyCents, validDate } from '../../src/domain/rentals.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const property = { id: 'unit', name: 'Wohnung', status: 'Vacant', occupants: 0, coldRent: 500, nebenkosten: 100 };
const terms = { start: '2035-01-01', end: '', coldRent: '850.25', utilities: '125.50', deposit: '2550.75', included: 'Küche' };
beforeEach(() => {
    db.data = { properties: [structuredClone(property)], tenants: [], rentals: [], leases: [], documents: [], documentFiles: {}, rentalSchemaVersion: 1 };
});
const create = () => request(app).post('/api/rentals').send({ propertyId: 'unit', title: 'Neuvermietung', availableFrom: '2035-01-01', coldRent: '850.25', utilities: '125.50', deposit: '' });
async function preparedRental() {
    const rental = (await create()).body;
    const withApplication = await request(app).post(`/api/rentals/${rental.id}/applications`).send({ parties: [{ name: 'Alex Beispiel' }, { name: 'Kim Beispiel' }], status: 'Interested', inquiry: 'Einzug im Januar' });
    const application = withApplication.body.applications[0];
    await request(app).put(`/api/rentals/${rental.id}`).send({ selectedApplicationId: application.id });
    db.data.documents.push({ id: 'signed', propertyId: 'unit', category: 'Leases', hasFile: true });
    db.data.documentFiles.signed = { hash: 'fictional-test-file-reference' };
    return { rental, application };
}
const complete = id => request(app).post(`/api/rentals/${id}/complete`).send({ ...terms, contractDocumentId: 'signed', confirmSigned: true });

describe('Rental workflow and leases', () => {
    it('backs up a real legacy fixture before migration and keeps it stable across restarts', async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), 'domus-migration-test-'));
        try {
            const filename = path.join(directory, 'fixture.json');
            const original = JSON.stringify({ properties: [property], tenants: [{ id: 'historical', propertyId: 'unit', leaseEnd: '2021-12-31' }] });
            await writeFile(filename, original);
            const execute = () => promisify(execFile)(process.execPath, ['--input-type=module', '-e', "await import('./server/db.js')"], {
                cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), windowsHide: true,
                env: { ...process.env, NODE_ENV: 'development', DOMUS_DB_FILE: filename },
            });
            await execute();
            expect(await readFile(`${filename}.before-rentals-v1.bak`, 'utf8')).toBe(original);
            const migrated = JSON.parse(await readFile(filename, 'utf8'));
            expect(migrated.rentalSchemaVersion).toBe(1);
            expect(migrated.tenants).toEqual(JSON.parse(original).tenants);
            expect(migrated.leases).toEqual([]);
            await execute();
            expect(JSON.parse(await readFile(filename, 'utf8'))).toEqual(migrated);
            expect(await readFile(`${filename}.before-rentals-v1.bak`, 'utf8')).toBe(original);
        } finally {
            if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('domus-migration-test-')) await rm(directory, { recursive: true, force: true });
        }
    });
    it('migrates additively and repeatedly without inventing contracts or changing historical dates', () => {
        const original = { properties: [property], tenants: [{ id: 'a', propertyId: 'unit', leaseEnd: '2027-01-01' }, { id: 'b', propertyId: 'unit' }] };
        const migrated = migrateRentals(original);
        expect(migrated.tenants).toEqual(original.tenants);
        expect(migrated.leases).toEqual([]);
        expect(migrateRentals(migrated)).toEqual(migrated);
        expect(original).not.toHaveProperty('rentalSchemaVersion');
    });
    it('stores monthly money in cents and rejects invalid dates and amounts', async () => {
        expect(moneyCents('0.29', 'Miete')).toBe(29);
        expect(() => moneyCents('1.001', 'Miete')).toThrow();
        expect(() => validDate('2035-02-30', 'Datum')).toThrow();
        const result = await create();
        expect(result.status).toBe(201);
        expect(result.body.coldRentCents).toBe(85025);
        expect(result.body.depositCents).toBeNull();
        expect((await request(app).post('/api/rentals').send({ title: 'x', propertyId: 'missing' })).status).toBe(404);
    });
    it('keeps inquiries separate from tenants and saves scoped appointments', async () => {
        const { rental, application } = await preparedRental();
        expect(db.data.tenants).toHaveLength(0);
        const result = await request(app).post(`/api/rentals/${rental.id}/viewings`).send({ applicationId: application.id, date: '2034-12-01', time: '15:30', notes: 'Küche besprechen' });
        expect(result.status).toBe(201);
        const viewing = result.body.viewings[0];
        const updated = await request(app).put(`/api/rentals/${rental.id}/viewings/${viewing.id}`).send({ ...viewing, status: 'Done', notes: 'Weiterhin interessiert' });
        expect(updated.body.viewings[0].notes).toBe('Weiterhin interessiert');
        expect((await request(app).post(`/api/rentals/${rental.id}/viewings`).send({ ...viewing, applicationId: 'foreign' })).status).toBe(400);
        expect((await request(app).post(`/api/rentals/${rental.id}/viewings`).send({ ...viewing, time: '28:00' })).status).toBe(400);
    });
    it('requires a matching stored contract and explicit confirmation', async () => {
        const { rental } = await preparedRental();
        const endpoint = `/api/rentals/${rental.id}/complete`;
        expect((await request(app).post(endpoint).send({ ...terms, contractDocumentId: 'signed' })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ ...terms, contractDocumentId: 'missing', confirmSigned: true })).status).toBe(400);
        db.data.documents[0].propertyId = 'other';
        expect((await complete(rental.id)).status).toBe(400);
        expect(db.data.leases).toHaveLength(0);
        expect(db.data.tenants).toHaveLength(0);
    });
    it('completes atomically and idempotently with multiple parties and an open-ended lease', async () => {
        const { rental } = await preparedRental();
        const [first, retry] = await Promise.all([complete(rental.id), complete(rental.id)]);
        expect(first.status).toBe(200);
        expect(retry.status).toBe(200);
        expect(first.body.id).toBe(retry.body.id);
        expect(first.body.end).toBeNull();
        expect(first.body.tenantIds).toHaveLength(2);
        expect(db.data.leases).toHaveLength(1);
        expect(db.data.tenants).toHaveLength(2);
        expect(db.data.rentals[0].phase).toBe('Completed');
        await db.read();
        expect(db.data.leases).toHaveLength(1);
        const before = tenancyView(db.data, '2034-12-31');
        expect(before.properties[0]).toMatchObject(property);
        expect(before.tenants.map(t => t.status)).toEqual(['Pending', 'Pending']);
        const active = tenancyView(db.data, '2035-01-01');
        expect(active.properties[0]).toMatchObject({ status: 'Occupied', occupants: 2, coldRent: 850.25, nebenkosten: 125.50 });
        expect(active.tenants[0].status).toBe('Active');
    });
    it('preserves active tenancy until the replacement starts and protects historical references', async () => {
        db.data.tenants.push({ id: 'old', name: 'Vorheriger Mieter', propertyId: 'unit', status: 'Active' });
        const confirmed = await request(app).post('/api/rentals/leases/confirm').send({ ...terms, start: '2020-01-01', end: '2034-12-31', coldRent: '500', utilities: '100', tenantIds: ['old'], propertyId: 'unit' });
        expect(confirmed.status).toBe(201);
        const { rental } = await preparedRental();
        expect((await complete(rental.id)).status).toBe(200);
        const before = tenancyView(db.data, '2034-12-31');
        expect(before.properties[0]).toMatchObject({ coldRent: 500, occupants: 1 });
        expect(before.tenants.find(t => t.id === 'old').status).toBe('Active');
        const after = tenancyView(db.data, '2035-01-01');
        expect(after.tenants.find(t => t.id === 'old')).toMatchObject({ status: 'Past', propertyId: 'unit' });
        expect(after.properties[0].occupants).toBe(2);
        expect((await request(app).delete('/api/tenants/old')).status).toBe(409);
        expect((await request(app).put('/api/tenants/old').send({ propertyId: null })).status).toBe(409);
        expect((await request(app).put('/api/tenants/old').send({ phone: '123' })).body).toMatchObject({ phone: '123', leaseManaged: true });
        expect((await request(app).delete('/api/properties/unit')).status).toBe(409);
        expect((await request(app).delete('/api/documents/signed')).status).toBe(409);
    });
    it('blocks overlaps without creating tenants, and supports correcting a lease end', async () => {
        db.data.tenants.push({ id: 'old', propertyId: 'unit', status: 'Active' });
        const old = await request(app).post('/api/rentals/leases/confirm').send({ ...terms, start: '2020-01-01', tenantIds: ['old'], propertyId: 'unit' });
        const { rental } = await preparedRental();
        expect((await complete(rental.id)).status).toBe(409);
        expect(db.data.tenants).toHaveLength(1);
        expect(db.data.rentals[0].phase).toBe('Preparation');
        expect((await request(app).put(`/api/rentals/leases/${old.body.id}/end`).send({ end: '2034-12-31' })).status).toBe(200);
        expect((await complete(rental.id)).status).toBe(200);
        expect((await request(app).put(`/api/rentals/leases/${old.body.id}/end`).send({ end: '' })).status).toBe(409);
        expect((await request(app).put(`/api/rentals/leases/${old.body.id}/end`).send({ end: '2019-12-31' })).status).toBe(400);
    });
    it('does not infer shared legacy contracts and requires deliberate selection of co-tenants', async () => {
        db.data.tenants.push({ id: 'a', name: 'A', propertyId: 'unit', status: 'Active' }, { id: 'b', name: 'B', propertyId: 'unit', status: 'Active' });
        const overview = await request(app).get('/api/rentals');
        expect(overview.body.legacyTenants).toHaveLength(2);
        expect(overview.body.leases).toHaveLength(0);
        const payload = { ...terms, start: '2020-01-01', propertyId: 'unit', tenantIds: ['a'] };
        expect((await request(app).post('/api/rentals/leases/confirm').send(payload)).status).toBe(409);
        expect((await request(app).post('/api/rentals/leases/confirm').send({ ...payload, tenantIds: ['a', 'b'] })).status).toBe(201);
        expect((await request(app).get('/api/rentals')).body.legacyTenants).toHaveLength(0);
        expect((await request(app).post('/api/rentals/leases/confirm').send({ ...payload, tenantIds: ['a', 'b'] })).status).toBe(400);
    });
    it('withdrawal clears selection and archived/completed records reject edits', async () => {
        const { rental, application } = await preparedRental();
        const withdrawn = await request(app).put(`/api/rentals/${rental.id}/applications/${application.id}`).send({ ...application, status: 'Withdrawn' });
        expect(withdrawn.body.selectedApplicationId).toBeNull();
        expect((await complete(rental.id)).status).toBe(400);
        expect((await request(app).put(`/api/rentals/${rental.id}`).send({ phase: 'Completed' })).status).toBe(400);
        await request(app).put(`/api/rentals/${rental.id}`).send({ phase: 'Archived' });
        expect((await request(app).post(`/api/rentals/${rental.id}/applications`).send({ parties: [{ name: 'X' }] })).status).toBe(409);
        expect((await complete(rental.id)).status).toBe(409);
    });
});
