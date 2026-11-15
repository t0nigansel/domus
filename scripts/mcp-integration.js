import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export async function mcpIntegration({ base, call, post, a, b, property, check }) {
    const resource = `${base}/mcp`;
    const metadata = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json();
    check(metadata.resource, resource, 'MCP resource discovery');
    const discovery = await (await fetch(`${base}/.well-known/oauth-authorization-server/api/auth`)).json();
    assert.ok(discovery.authorization_endpoint && discovery.registration_endpoint);
    check((await fetch(resource, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'MCP rejects anonymous calls');
    check((await fetch(resource, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: a.cookie }, body: '{}' })).status, 401, 'browser session is not an MCP token');
    const registration = await post('/api/auth/oauth2/register', { client_name: 'Isolated MCP client', redirect_uris: ['https://assistant.example/callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: 'domus:read offline_access' });
    check(registration.status, 201, 'MCP dynamic client registration');
    const client = await registration.json();
    const form = body => fetch(discovery.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
    async function authorize(cookie) {
        const verifier = randomBytes(32).toString('base64url');
        const params = new URLSearchParams({ client_id: client.client_id, redirect_uri: 'https://assistant.example/callback', response_type: 'code', scope: 'domus:read offline_access', resource,
            code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: 'test-state' });
        const redirect = await fetch(`${discovery.authorization_endpoint}?${params}`, { headers: { Cookie: cookie, Accept: 'text/html' }, redirect: 'manual' });
        check([200, 302].includes(redirect.status), true, 'MCP authorization asks for consent');
        const location = redirect.status === 302 ? redirect.headers.get('Location') : (await redirect.json()).url;
        const consentUrl = new URL(location, base);
        check(consentUrl.pathname, '/mcp/consent', 'MCP consent page');
        const oauth_query = consentUrl.search.slice(1);
        const info = await call(`/api/mcp/consent?oauth_query=${encodeURIComponent(oauth_query)}`, { cookie });
        check(info.status, 200, 'signed consent query validated');
        check((await info.json()).redirectHost, 'assistant.example', 'consent identifies callback host');
        const altered = await call(`/api/mcp/consent?oauth_query=${encodeURIComponent(oauth_query + '&scope=domus:write')}`, { cookie });
        check(altered.status, 400, 'tampered consent query rejected');
        const accepted = await post('/api/auth/oauth2/consent', { accept: true, oauth_query }, cookie);
        check(accepted.status, 200, 'MCP consent accepted');
        const callback = new URL((await accepted.json()).url);
        const code = callback.searchParams.get('code');
        assert.ok(code);
        const exchanged = await form({ client_id: client.client_id, grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'https://assistant.example/callback', resource });
        check(exchanged.status, 200, 'PKCE token exchange');
        const tokens = await exchanged.json();
        assert.ok(tokens.access_token && tokens.refresh_token);
        check((await form({ client_id: client.client_id, grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'https://assistant.example/callback', resource })).status, 400, 'MCP authorization code cannot be reused');
        return tokens;
    }
    const tokensA = await authorize(a.cookie), tokensB = await authorize(b.cookie);
    async function rpc(token, method, params = {}) {
        const response = await fetch(resource, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
        const text = await response.text();
        const data = response.status === 200 ? JSON.parse(text.startsWith('event:') ? text.split('\n').find(line => line.startsWith('data:')).slice(5) : text) : null;
        return { response, data };
    }
    const listed = await rpc(tokensA.access_token, 'tools/list');
    check(listed.response.status, 200, 'authorized MCP tools/list');
    check(listed.data.result.tools.length, 8, 'eight read-only MCP tools');
    check(listed.data.result.tools.every(tool => tool.annotations.readOnlyHint), true, 'read-only annotations');
    const flatsA = await rpc(tokensA.access_token, 'tools/call', { name: 'list_properties', arguments: {} });
    assert.ok(flatsA.data.result.structuredContent.items.some(item => item.id === property.id));
    const flatsB = await rpc(tokensB.access_token, 'tools/call', { name: 'list_properties', arguments: {} });
    check(flatsB.data.result.structuredContent.items.some(item => item.id === property.id), false, 'MCP account isolation');
    const deniedDossier = await rpc(tokensB.access_token, 'tools/call', { name: 'get_property_dossier', arguments: { propertyId: property.id } });
    check(deniedDossier.data.result.isError, true, 'MCP dossier cannot cross accounts');
    const pdf = await PDFDocument.create(); pdf.addPage().drawText('Synthetic lease: decorative repairs every five years.');
    const upload = new FormData(); upload.append('file', new Blob([await pdf.save()], { type: 'application/pdf' }), 'mcp-test-lease.pdf'); upload.append('propertyId', property.id); upload.append('category', 'Leases');
    const uploaded = await call('/api/files/upload', { method: 'POST', form: upload, cookie: a.cookie });
    check(uploaded.status, 201, 'MCP PDF fixture uploaded');
    const doc = (await uploaded.json()).document;
    const text = await rpc(tokensA.access_token, 'tools/call', { name: 'read_document', arguments: { documentId: doc.id } });
    assert.ok(JSON.stringify(text.data).includes('decorative repairs'), `MCP extracts actual PDF text in Workers: ${JSON.stringify(text.data)}`);
    const deniedDoc = await rpc(tokensB.access_token, 'tools/call', { name: 'read_document', arguments: { documentId: doc.id } });
    check(deniedDoc.data.result.isError, true, 'MCP document cannot cross accounts');
    const connections = await (await call('/api/mcp/connections', { cookie: a.cookie })).json();
    check(connections.connections.length, 1, 'MCP connection shown in settings');
    const id = connections.connections[0].id;
    check((await call(`/api/mcp/connections/${id}`, { method: 'DELETE', cookie: b.cookie })).status, 404, 'MCP connection cannot be revoked by another owner');
    check((await call(`/api/mcp/connections/${id}`, { method: 'DELETE', cookie: a.cookie })).status, 200, 'MCP connection revoked');
    check((await rpc(tokensA.access_token, 'tools/list')).response.status, 401, 'MCP access stops immediately after revocation');
    check((await form({ client_id: client.client_id, grant_type: 'refresh_token', refresh_token: tokensA.refresh_token, resource })).status, 400, 'revoked connection cannot refresh');
    check((await rpc(tokensB.access_token, 'tools/list')).response.status, 200, 'revocation leaves other owner connected');
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.79' } });
        await page.route('https://assistant.example/callback**', route => route.fulfill({ contentType: 'text/html', body: '<p>Connected test client</p>' }));
        const verifier = randomBytes(32).toString('base64url');
        const query = new URLSearchParams({ client_id: client.client_id, redirect_uri: 'https://assistant.example/callback', response_type: 'code', scope: 'domus:read offline_access', resource, prompt: 'consent',
            code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
        await page.goto(`${discovery.authorization_endpoint}?${query}`);
        await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('a@example.invalid');
        await page.getByLabel('Passwort', { exact: true }).fill('isolated-test-password');
        await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
        await page.getByRole('heading', { name: 'Assistent mit Domus verbinden' }).waitFor();
        await page.getByText('Isolated MCP client', { exact: true }).waitFor();
        await mkdir('test-results/cloud', { recursive: true });
        await page.screenshot({ path: 'test-results/cloud/mcp-consent-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'test-results/cloud/mcp-consent-mobile.png', fullPage: true });
        check(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true, 'mobile MCP consent fits viewport');
        await page.getByRole('button', { name: 'Lesezugriff erlauben' }).click();
        await page.waitForURL('https://assistant.example/callback**');
        await page.goto(`${base}/settings`);
        await page.getByRole('heading', { name: 'KI-Assistenten über MCP' }).waitFor();
        const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'KI-Assistenten über MCP' }) });
        await section.getByRole('button', { name: 'Verbindung trennen' }).click();
        await section.getByText('Keine Assistenten verbunden.').waitFor();
        check((await rpc(tokensA.access_token, 'tools/list')).response.status, 401, 'reconnecting does not revive old MCP token');
    } finally { await browser.close(); }
}
