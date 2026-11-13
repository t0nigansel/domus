import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import pg from 'pg';
import { getPlatformProxy } from 'wrangler';
import { emptyData, entities, loadData, saveData } from '../server/cloud/store.js';
import { withAccountTransaction } from '../server/cloud/database.js';
import { overlaps } from '../src/domain/rentals.js';

const args = process.argv.slice(2);
const argument = name => args[args.indexOf(name) + 1];
const environment = argument('--environment');
const email = argument('--email');
if (!args.includes('--environment') || !['preview', 'production'].includes(environment) || !args.includes('--email') || !email?.includes('@')) throw new Error('Use --environment preview|production --email owner@example.com [--apply]');
if (!process.env.DOMUS_MIGRATION_DATABASE_URL) throw new Error('DOMUS_MIGRATION_DATABASE_URL is required');
const sourceFile = path.resolve(process.env.DOMUS_DB_FILE || 'server/db.json');
const filesRoot = path.resolve(process.env.DOMUS_FILES_DIR || 'data/files');
const source = await readFile(sourceFile);
const data = { ...emptyData(), ...JSON.parse(source) };
const sourceHash = createHash('sha256').update(source).digest('hex');
const manifest = { sourceHash, entities: Object.fromEntries(entities.map(name => [name, data[name].length])), files: [], bytes: 0 };
let proxy;
const client = new pg.Client({ connectionString: process.env.DOMUS_MIGRATION_DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
    for (const name of entities) {
        const ids = data[name].map(row => row.id);
        if (ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_:-]{1,160}$/.test(id)) || new Set(ids).size !== ids.length) throw new Error(`Invalid or duplicate IDs in ${name}`);
    }
    for (const [id, file] of Object.entries(data.documentFiles)) {
        if (!/^[a-f0-9]{64}$/.test(file.hash) || !data.documents.some(document => document.id === id)) throw new Error('Invalid file reference');
        const buffer = await readFile(path.join(filesRoot, file.hash));
        if (createHash('sha256').update(buffer).digest('hex') !== file.hash) throw new Error('Local file checksum mismatch');
        file.bytes = buffer.length;
        manifest.files.push({ id, hash: file.hash, bytes: buffer.length });
        manifest.bytes += buffer.length;
    }
    for (const lease of data.leases) {
        if (data.leases.some(other => other.id !== lease.id && (other.propertyId === lease.propertyId || other.tenantIds.some(id => lease.tenantIds.includes(id))) && overlaps(lease, other))) throw new Error('Overlapping source leases require correction before import');
    }
    await client.connect();
    const users = await client.query('SELECT id, "emailVerified" FROM "user" WHERE lower(email) = lower($1)', [email]);
    if (users.rows.length !== 1 || !users.rows[0].emailVerified) throw new Error('The target user must register and verify their email first');
    const userId = users.rows[0].id;
    const accountId = `domus-${userId}`;
    const accounts = await withAccountTransaction(client, accountId, () => client.query('SELECT id FROM domus_accounts WHERE id = $1 AND owner_user_id = $2', [accountId, userId]));
    if (!accounts.rows.length) throw new Error('The verified user must open Domus once before importing');
    manifest.accountId = accountId;
    console.log(JSON.stringify({ environment, entities: manifest.entities, files: manifest.files.length, bytes: manifest.bytes, apply: args.includes('--apply') }));
    // Validate all relational references in a rolled-back database transaction before any upload.
    const preflight = await withAccountTransaction(client, accountId, async () => {
        await client.query('SELECT id FROM domus_accounts WHERE id = $1 FOR UPDATE', [accountId]);
        const imported = await client.query('SELECT source_hash FROM domus_imports WHERE account_id = $1 AND source_hash = $2', [accountId, sourceHash]);
        if (imported.rows.length) return { imported: true };
        const current = await loadData(client, accountId);
        for (const name of entities) {
            if (data[name].some(row => current[name].some(existing => existing.id === row.id))) throw new Error(`Existing ${name} IDs conflict with this source. Existing records were preserved.`);
        }
        for (const [id, file] of Object.entries(data.documentFiles)) file.key = `${accountId}/${file.hash}/${id}`;
        const combined = { ...data, ...Object.fromEntries(entities.map(name => [name, [...current[name], ...data[name]]])), documentFiles: { ...current.documentFiles, ...data.documentFiles } };
        await client.query('SAVEPOINT import_validation');
        await saveData(client, accountId, current, combined);
        await client.query('SET CONSTRAINTS ALL IMMEDIATE');
        await client.query('ROLLBACK TO SAVEPOINT import_validation');
        return { imported: false };
    });
    if (preflight.imported) console.log('This source has already been imported. Existing data was preserved.');
    else if (!args.includes('--apply')) console.log('Dry run passed. All local hashes and database relationships are valid.');
    else {
        await mkdir('data', { recursive: true });
        await copyFile(sourceFile, `data/before-cloud-import-${environment}-${sourceHash.slice(0, 12)}.json`);
        const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
        const binding = config.env[environment].r2_buckets[0];
        const proxyConfig = `.wrangler/import-${environment}.json`;
        await mkdir('.wrangler', { recursive: true });
        await writeFile(proxyConfig, JSON.stringify({ name: 'domus-private-import', account_id: config.account_id,
            compatibility_date: config.compatibility_date, r2_buckets: [{ ...binding, remote: true }] }));
        proxy = await getPlatformProxy({ configPath: proxyConfig, envFiles: [], persist: false, remoteBindings: true });
        let completed = 0;
        for (const [id, file] of Object.entries(data.documentFiles)) {
            const buffer = await readFile(path.join(filesRoot, file.hash));
            await withAccountTransaction(client, accountId, async () => {
                await client.query('SELECT id FROM domus_accounts WHERE id = $1 FOR UPDATE', [accountId]);
                const existing = await proxy.env.FILES.head(file.key);
                if (!existing || existing.size !== buffer.length || existing.customMetadata?.sha256 !== file.hash || Date.now() - existing.uploaded.getTime() > 12 * 60 * 60 * 1000) {
                    await proxy.env.FILES.put(file.key, buffer, { httpMetadata: { contentType: file.mime }, customMetadata: { sha256: file.hash } });
                }
                const stored = await proxy.env.FILES.get(file.key);
                if (!stored || createHash('sha256').update(Buffer.from(await stored.arrayBuffer())).digest('hex') !== file.hash) throw new Error('Remote file checksum mismatch');
            });
            data.documentFiles[id].key = file.key;
            completed++;
            if (completed % 20 === 0 || completed === manifest.files.length) console.log(`Verified ${completed}/${manifest.files.length} files.`);
        }
        await withAccountTransaction(client, accountId, async () => {
            await client.query('SELECT id FROM domus_accounts WHERE id = $1 FOR UPDATE', [accountId]);
            const imported = await client.query('SELECT source_hash FROM domus_imports WHERE account_id = $1 AND source_hash = $2', [accountId, sourceHash]);
            if (imported.rows.length) return;
            const current = await loadData(client, accountId);
            for (const name of entities) if (data[name].some(row => current[name].some(existing => existing.id === row.id))) throw new Error('Concurrent data conflicts with import. Retry after reviewing the target account.');
            const combined = { ...data, ...Object.fromEntries(entities.map(name => [name, [...current[name], ...data[name]]])), documentFiles: { ...current.documentFiles, ...data.documentFiles } };
            await saveData(client, accountId, current, combined);
            await client.query('INSERT INTO domus_imports (account_id, source_hash, manifest) VALUES ($1, $2, $3)', [accountId, sourceHash, JSON.stringify(manifest)]);
            await client.query('INSERT INTO audit_log (account_id, id, user_id, action, entity) VALUES ($1, $2, $3, \'IMPORT\', \'legacy\')', [accountId, randomUUID(), userId]);
        });
        await writeFile(`data/cloud-import-${environment}-${sourceHash.slice(0, 12)}.json`, JSON.stringify(manifest, null, 2));
        console.log('Import committed. Every transferred file was read back and its SHA-256 verified.');
    }
} catch (error) {
    // Provider/driver errors may contain private connection details.
    console.error(error.code ? `Import failed (${error.code}).` : error.message);
    process.exitCode = 1;
} finally {
    if (proxy) await proxy.dispose();
    await client.end();
}
