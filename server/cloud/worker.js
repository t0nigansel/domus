import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { createCloudApp } from './app.js';
import { createAuth, missingAuthSettings } from './auth.js';
import pg from 'pg';
import { domainRequest, json } from './domain-api.js';
import { withAccountTransaction, withDatabase } from './database.js';
import { mcpRequest } from './mcp.js';
import { mcpEnabled, mcpAccountRequest } from './mcp-auth.js';

const app = createCloudApp(env);
export { AssistantWorkflow } from './assistant-workflow.js';
app.listen(3000);
const expressHandler = httpServerHandler({ port: 3000 });

export default {
    async fetch(request, bindings, context) {
        const path = new URL(request.url).pathname;
        const metadataPath = path.startsWith('/.well-known/oauth-');
        const mcpPath = path === '/mcp';
        const mcpAccountPath = path.startsWith('/api/mcp/');
        const authPath = path === '/api/auth' || path.startsWith('/api/auth/');
        const domainPath = path.startsWith('/api/') && path !== '/api/health';
        const ready = bindings.DOMUS_DOMAIN_ENABLED === 'true' && missingAuthSettings(bindings).length === 0;
        if (path === '/api/access') return json({ ready });
        if ((mcpPath || mcpAccountPath || metadataPath) && (!ready || !mcpEnabled(bindings))) return json({ error: 'Der MCP-Zugang ist noch nicht freigeschaltet.' }, 503);
        if (authPath || metadataPath || mcpPath || (domainPath && ready)) {
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
                if (authPath || metadataPath) response = await auth.handler(request);
                else if (mcpPath) {
                    const client = await pool.connect();
                    try { response = await mcpRequest(request, bindings, client, auth); }
                    finally { client.release(); }
                }
                else {
                    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
                    if (!session) return json({ error: 'Bitte melde dich an.' }, 401);
                    if (mcpAccountPath) response = await mcpAccountRequest(request, bindings, auth);
                    else {
                        const client = await pool.connect();
                        try { response = await domainRequest(request, bindings, client, session.user, auth); }
                        finally { client.release(); }
                    }
                }
                const headers = new Headers(response.headers);
                headers.set('Cache-Control', 'no-store');
                headers.set('X-Content-Type-Options', 'nosniff');
                if (metadataPath) headers.set('Access-Control-Allow-Origin', '*');
                return new Response(response.body, { status: response.status, headers });
            } catch (error) {
                if(error.body?.code==='INVALID_PASSWORD')return json({error:'Das aktuelle Passwort stimmt nicht.'},400);
                if(Number.isInteger(error.statusCode)&&error.statusCode>=400&&error.statusCode<500)return json({error:'Bitte die Zugangsdaten und Eingaben prüfen.'},error.statusCode);
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
        context.waitUntil(resumeDeletions(bindings));
    },
};

async function resumeDeletions(bindings) {
    if(!bindings.ASSISTANT_WORKFLOW)return;
    await withDatabase(bindings,async client=>{
        // Account IDs are discovered without reading tenant data; each retry re-enters its own RLS context.
        const owners=await client.query('SELECT id FROM "user"');
        for(const owner of owners.rows) {
            const accountId=`domus-${owner.id}`;
            const jobs=await withAccountTransaction(client,accountId,async()=> (await client.query("SELECT j.id FROM assistant_jobs j JOIN domus_accounts a ON a.id=j.account_id WHERE j.account_id=$1 AND a.deleting AND j.kind='delete' AND j.status='failed'",[accountId])).rows);
            for(const job of jobs) {
                try {await (await bindings.ASSISTANT_WORKFLOW.get(job.id)).restart();}
                catch {console.error('Deletion retry pending');}
            }
        }
    });
}

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
                    const archives = await client.query('SELECT id FROM assistant_jobs WHERE account_id=$1 AND object_key=$2', [accountId, object.key]);
                    if (!references.rows.length && (!archives.rows.length || Date.now()-object.uploaded.getTime()>7*86400000)) {
                        await bindings.FILES.delete(object.key);
                        if(archives.rows.length)await client.query('UPDATE assistant_jobs SET object_key=NULL WHERE account_id=$1 AND object_key=$2',[accountId,object.key]);
                    }
                });
            }
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
    });
}
