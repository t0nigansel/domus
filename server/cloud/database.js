import pg from 'pg';

// Hyperdrive owns the shared connection pool. Connections live within one request.
export async function withDatabase(env, action) {
    const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
    if (!connectionString) throw new Error('PostgreSQL is not configured');
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    try {
        await client.connect();
        return await action(client);
    } finally {
        await client.end();
    }
}

export async function withAccountTransaction(client, accountId, action) {
    if (typeof accountId !== 'string' || !accountId.trim()) throw new Error('Account ID is required');
    await client.query('BEGIN');
    try {
        await client.query("SELECT set_config('app.account_id', $1, true)", [accountId]);
        const result = await action(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}
