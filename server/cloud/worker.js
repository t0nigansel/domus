import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { createCloudApp } from './app.js';
import { createAuth, missingAuthSettings } from './auth.js';
import pg from 'pg';
import { domainRequest, json } from './domain-api.js';
import { withAccountTransaction, withDatabase } from './database.js';

const app = createCloudApp(env);
app.listen(3000);
const expressHandler = httpServerHandler({ port: 3000 });

export default {
    async fetch(request, bindings, context) {
        const path = new URL(request.url).pathname;
        const authPath = path === '/api/auth' || path.startsWith('/api/auth/');
        const domainPath = path.startsWith('/api/') && path !== '/api/health';
        const ready = bindings.DOMUS_DOMAIN_ENABLED === 'true' && missingAuthSettings(bindings).length === 0;
        if (path === '/api/access') return json({ ready });
        if (authPath || (domainPath && ready)) {
            if (missingAuthSettings(bindings).length) {
                return Response.json({ error: 'Der Zugang wird vorbereitet.', code: 'AUTH_SETUP_PENDING' }, {
                    status: 503, headers: { 'Cache-Control': 'no-store' },
                });
            }
            const pool = new pg.Pool({
                connectionString: bindings.HYPERDRIVE?.connectionString || bindings.DATABASE_URL,
                max: 2, connectionTimeoutMillis: 5000,
            });
            try {
                const auth = createAuth(bindings, pool);
                let response;
                if (authPath) response = await auth.handler(request);
                else {
                    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
                    if (!session) return json({ error: 'Bitte melde dich an.' }, 401);
                    const client = await pool.connect();
                    try { response = await domainRequest(request, bindings, client, session.user); }
                    finally { client.release(); }
                }
                const headers = new Headers(response.headers);
                headers.set('Cache-Control', 'no-store');
                headers.set('X-Content-Type-Options', 'nosniff');
                return new Response(response.body, { status: response.status, headers });
            } catch (error) {
                if (error.status >= 400 && error.status < 500) return json({ error: error.message }, error.status);
                if (error.code === '23503') return json({ error: 'Der Eintrag ist noch mit anderen Daten verknüpft.' }, 409);
                if (error.code === '23505') return json({ error: 'Der Eintrag ist bereits vorhanden.' }, 409);
                console.error('Cloud request failed', { code: error.code || 'INTERNAL_ERROR' });
                return json({ error: 'Die Anfrage konnte gerade nicht verarbeitet werden. Bitte erneut versuchen.' }, 503);
            } finally {
                context.waitUntil(pool.end());
            }
        }
        return expressHandler.fetch(request, bindings, context);
    },
    async scheduled(_event, bindings, context) {
        if (bindings.DOMUS_DOMAIN_ENABLED !== 'true') return;
        context.waitUntil(removeOrphanedFiles(bindings));
    },
};

async function removeOrphanedFiles(bindings) {
    await withDatabase(bindings, async client => {
        let cursor;
        do {
            const page = await bindings.FILES.list({ limit: 500, cursor });
            for (const object of page.objects) {
                if (Date.now() - object.uploaded.getTime() < 24 * 60 * 60 * 1000) continue;
                const accountId = object.key.split('/')[0];
                await withAccountTransaction(client, accountId, async () => {
                    await client.query('SELECT id FROM domus_accounts WHERE id = $1 FOR UPDATE', [accountId]);
                    const current = await bindings.FILES.head(object.key);
                    if (!current || Date.now() - current.uploaded.getTime() < 24 * 60 * 60 * 1000) return;
                    const references = await client.query('SELECT id FROM document_files WHERE account_id = $1 AND object_key = $2', [accountId, object.key]);
                    if (!references.rows.length) await bindings.FILES.delete(object.key);
                });
            }
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
    });
}
