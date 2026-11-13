import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createHash } from 'node:crypto';

const connectionString = process.env.DOMUS_MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error('DOMUS_MIGRATION_DATABASE_URL is required');
const sql = (await readFile(new URL('../server/cloud/migrations/001_domain.sql', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const checksum = createHash('sha256').update(sql).digest('hex');
if (!process.argv.includes('--apply')) {
    console.log(sql);
    console.log('-- Dry run. Use --apply to migrate the selected database.');
} else {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
    try {
        await client.connect();
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('domus-domain-migration', 0))");
        await client.query('CREATE TABLE IF NOT EXISTS domus_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
        const previous = await client.query('SELECT checksum FROM domus_migrations WHERE version = 1');
        if (previous.rows.length) {
            if (previous.rows[0].checksum !== checksum) throw new Error('An applied migration was modified. Add a new migration instead.');
            console.log('Domain schema is already current.');
        } else {
            await client.query(sql);
            await client.query('INSERT INTO domus_migrations (version, checksum) VALUES (1, $1)', [checksum]);
            console.log('Domain schema migrated.');
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Domain migration failed.', { code: error.code || 'MIGRATION_FAILED' });
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}
