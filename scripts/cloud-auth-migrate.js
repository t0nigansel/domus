import pg from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from '../server/cloud/auth.js';

// Run explicitly against a dedicated migration connection, never during fetch.
if (!process.env.DOMUS_MIGRATION_DATABASE_URL) throw new Error('DOMUS_MIGRATION_DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DOMUS_MIGRATION_DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
try {
    const options = authOptions({
        ...process.env,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:8787',
    }, pool);
    const migration = await getMigrations(options);
    if (process.argv.includes('--apply')) {
        await migration.runMigrations();
        console.log('Auth schema migrated.');
    } else {
        console.log(await migration.compileMigrations());
        console.log('-- Dry run only. Use --apply with the migration database connection to execute.');
    }
} finally {
    await pool.end();
}
