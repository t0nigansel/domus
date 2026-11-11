import assert from 'node:assert/strict';
import { unstable_dev, getPlatformProxy } from 'wrangler';

// Uses only local emulated resources; never connects to a production bucket/DB.
const worker = await unstable_dev('server/cloud/worker.js', {
    config: 'wrangler.jsonc', local: true, persist: false, port: 0,
    logLevel: 'error', envFiles: [],
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
});
try {
    const health = await worker.fetch('/api/health');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, 'domus');
    for (const [path, method] of [['/api/properties', 'GET'], ['/api/files/upload', 'POST'], ['/api/auth/sign-up/email', 'POST'], ['/api/not-a-route', 'GET']]) {
        const response = await worker.fetch(path, { method });
        assert.equal(response.status, 503, `${method} ${path} must stay closed during setup`);
        assert.match(response.headers.get('Content-Type'), /application\/json/);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal((await worker.fetch('/api-docs')).status, 404);
    for (const path of ['/', '/properties/test-direct-navigation']) {
        const response = await worker.fetch(path, { headers: { Accept: 'text/html' } });
        assert.equal(response.status, 200, `SPA fallback: ${path}`);
        assert.match(await response.text(), /<div id="root"><\/div>/);
    }
} finally {
    await worker.stop();
}

const proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', persist: false, envFiles: [] });
try {
    const key = '__tests__/cloud-smoke';
    await proxy.env.FILES.put(key, 'domus-local-smoke');
    assert.equal(await (await proxy.env.FILES.get(key)).text(), 'domus-local-smoke');
    await proxy.env.FILES.delete(key);
    assert.equal(await proxy.env.FILES.get(key), null);
} finally {
    await proxy.dispose();
}
console.log('Cloud smoke passed: Express, closed API/auth, SPA routing, local R2 roundtrip.');

const authWorker = await unstable_dev('server/tests/cloud-auth.worker.js', {
    config: 'wrangler.jsonc', local: true, persist: false, port: 0,
    logLevel: 'error', envFiles: [],
    experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
});
try {
    const signup = email => authWorker.fetch('/api/auth/sign-up/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' },
        body: JSON.stringify({ email, name: 'Pilot Test', password: 'a-long-test-password-345' }),
    });
    assert.equal((await signup('outsider@example.invalid')).status, 403);
    const invited = await signup('invited@example.invalid');
    assert.equal(invited.status, 200, 'Better Auth must support hashing and verification tokens inside Workers');
    assert.equal(invited.headers.get('set-cookie'), null, 'Verification required before login');
    const login = await authWorker.fetch('/api/auth/sign-in/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' },
        body: JSON.stringify({ email: 'invited@example.invalid', password: 'a-long-test-password-345' }),
    });
    assert.equal(login.status, 403, 'Unverified users must not receive a session');
    console.log('Cloud auth smoke passed: hashing, email-verification tokens and pilot restriction in Workers.');
} finally {
    await authWorker.stop();
}
