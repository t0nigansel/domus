import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { createCloudApp } from './app.js';
import { createAuth, missingAuthSettings } from './auth.js';
import pg from 'pg';

const app = createCloudApp(env);
app.listen(3000);
const expressHandler = httpServerHandler({ port: 3000 });

export default {
    async fetch(request, bindings, context) {
        const path = new URL(request.url).pathname;
        if (path === '/api/auth' || path.startsWith('/api/auth/')) {
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
                const response = await createAuth(bindings, pool).handler(request);
                const headers = new Headers(response.headers);
                headers.set('Cache-Control', 'no-store');
                headers.set('X-Content-Type-Options', 'nosniff');
                return new Response(response.body, { status: response.status, headers });
            } catch {
                console.error('Authentication request failed');
                return Response.json({ error: 'Anmeldung derzeit nicht verfügbar.' }, {
                    status: 503, headers: { 'Cache-Control': 'no-store' },
                });
            } finally {
                context.waitUntil(pool.end());
            }
        }
        return expressHandler.fetch(request, bindings, context);
    },
};
