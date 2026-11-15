import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { createHash } from 'node:crypto';

const directory = new URL('../server/cloud/migrations/', import.meta.url);
const migrations = await Promise.all((await readdir(directory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort().map(async name => {
    const sql = (await readFile(new URL(name, directory), 'utf8')).replace(/\r\n/g, '\n');
    return { version: Number(name.split('_')[0]), sql, checksum: createHash('sha256').update(sql).digest('hex') };
}));
if (!process.argv.includes('--apply')) {
    for (const migration of migrations) console.log(`-- Version ${migration.version}\n${migration.sql}`);
    console.log('-- Dry run. Use --apply to migrate the selected database.');
} else {
    if (!process.env.DOMUS_MIGRATION_DATABASE_URL) throw new Error('DOMUS_MIGRATION_DATABASE_URL is required');
    const client = new pg.Client({ connectionString: process.env.DOMUS_MIGRATION_DATABASE_URL, connectionTimeoutMillis: 10000 });
    try {
        await client.connect();
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('domus-domain-migration', 0))");
        await client.query('CREATE TABLE IF NOT EXISTS domus_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
        for (const migration of migrations) {
            const previous = await client.query('SELECT checksum FROM domus_migrations WHERE version=$1', [migration.version]);
            if (previous.rows.length) {
                if (previous.rows[0].checksum !== migration.checksum) throw new Error('An applied migration was modified. Add a new migration instead.');
                continue;
            }
            await client.query(migration.sql);
            await client.query('INSERT INTO domus_migrations(version,checksum) VALUES($1,$2)', [migration.version, migration.checksum]);
        }
        console.log('Domain schema is current.');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Domain migration failed.', { code: error.code || 'MIGRATION_FAILED' });
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}
