import { jwt } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { rentalError } from '../../src/domain/rentals.js';

export const MCP_SCOPE = 'domus:read';
export const mcpResource = env => `${new URL(env.BETTER_AUTH_URL).origin}/mcp`;
export const mcpEnabled = env => env.DOMUS_MCP_ENABLED === 'true';

export function mcpPlugins(env, database) {
    if (!mcpEnabled(env)) return [];
    return [jwt({ disableSettingJwtHeader: true }), mcp({
        resource: mcpResource(env), loginPage: '/mcp/consent', consentPage: '/mcp/consent',
        scopes: [MCP_SCOPE, 'offline_access'], grantTypes: ['authorization_code', 'refresh_token'],
        allowDynamicClientRegistration: true, allowUnauthenticatedClientRegistration: true,
        clientRegistrationDefaultApplicationType: 'infer',
        clientRegistrationDefaultScopes: [MCP_SCOPE, 'offline_access'],
        accessTokenExpiresIn: 900, refreshTokenReuseInterval: 0,
        // Bind tokens to specific grants so reconnecting cannot revive a revoked token.
        customAccessTokenClaims: async ({ user }) => ({ domusConsents: user ?
            (await database.query('SELECT id FROM "oauthConsent" WHERE "userId"=$1', [user.id])).rows.map(row => row.id) : [] }),
    })];
}

// Authentication records use Better Auth's adapter. Domain data is read only via domainRequest.
export async function mcpIdentity(auth, claims) {
    const context = await auth.$context;
    if (!claims.sub || !claims.azp || !Array.isArray(claims.domusConsents)) throw rentalError('MCP-Verbindung ungültig.', 401);
    const grant = await context.adapter.findOne({ model: 'oauthConsent', where: [
        { field: 'userId', value: claims.sub }, { field: 'clientId', value: claims.azp },
    ] });
    const client = await context.adapter.findOne({ model: 'oauthClient', where: [{ field: 'clientId', value: claims.azp }] });
    if (!grant || !client || client.disabled || !claims.domusConsents.includes(grant.id) || !grant.scopes.includes(MCP_SCOPE)) throw rentalError('MCP-Verbindung wurde getrennt.', 401);
    const user = await context.internalAdapter.findUserById(claims.sub);
    if (!user?.emailVerified) throw rentalError('Kein Zugriff.', 403);
    return user;
}

export async function mcpAccountRequest(request, env, auth) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/mcp/consent') {
        const query = url.searchParams.get('oauth_query') || '';
        const context = await auth.$context;
        if (!await verifyOAuthQueryParams(query, context.secret)) throw rentalError('Die Verbindungsanfrage ist ungültig oder abgelaufen.', 400);
        const params = new URLSearchParams(query);
        const client = await auth.api.getOAuthClientPublic({ headers: request.headers, query: { client_id: params.get('client_id') } });
        return Response.json({ name: client.client_name || 'MCP-Assistent', redirectHost: new URL(params.get('redirect_uri')).host,
            scopes: (params.get('scope') || '').split(' ').filter(Boolean) });
    }
    if (request.method === 'GET' && url.pathname === '/api/mcp/connections') {
        const grants = await auth.api.getOAuthConsents({ headers: request.headers });
        const connections = [];
        for (const grant of grants) {
            if (!grant.scopes.includes(MCP_SCOPE)) continue;
            const client = await auth.api.getOAuthClientPublic({ headers: request.headers, query: { client_id: grant.clientId } });
            connections.push({ id: grant.id, name: client.client_name || 'MCP-Assistent', scopes: grant.scopes, createdAt: grant.createdAt });
        }
        return Response.json({ url: mcpResource(env), connections });
    }
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/mcp/connections/')) {
        if (request.headers.get('Origin') !== new URL(env.BETTER_AUTH_URL).origin) throw rentalError('Ungültiger Ursprung.', 403);
        const id = decodeURIComponent(url.pathname.split('/').at(-1));
        const grants = await auth.api.getOAuthConsents({ headers: request.headers });
        const grant = grants.find(grant => grant.id === id && grant.scopes.includes(MCP_SCOPE));
        if (!grant) throw rentalError('Verbindung nicht gefunden.', 404);
        await auth.api.deleteOAuthConsent({ headers: request.headers, body: { id } });
        const context = await auth.$context;
        for (const model of ['oauthAccessToken', 'oauthRefreshToken']) await context.adapter.deleteMany({ model, where: [
            { field: 'userId', value: grant.userId }, { field: 'clientId', value: grant.clientId },
        ] });
        return Response.json({ disconnected: true });
    }
    throw rentalError('Nicht gefunden.', 404);
}
