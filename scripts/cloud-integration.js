import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { unstable_dev } from 'wrangler';
import { authOptions } from '../server/cloud/auth.js';
import { chromium } from '@playwright/test';

const container = `domus-cloud-test-${randomUUID().slice(0, 8)}`;
let admin;
let worker;
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
try {
    execFileSync('docker', ['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=domus-isolated-test', '-p', '127.0.0.1::5432', 'postgres:17-alpine'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const port = execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' }).trim().split(':').at(-1);
    const adminUrl = `postgres://postgres:domus-isolated-test@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 60; attempt++) {
        const probe = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 1000 });
        try { await probe.connect(); await probe.end(); break; }
        catch { await probe.end().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query("CREATE ROLE domus_runtime LOGIN PASSWORD 'domus-runtime-isolated-test'");
    const pool = new pg.Pool({ connectionString: adminUrl, max: 1 });
    try {
        const migration = await getMigrations(authOptions({ BETTER_AUTH_URL: 'http://localhost:8787' }, pool));
        await migration.runMigrations();
    } finally { await pool.end(); }
    await admin.query(await readFile(new URL('../server/cloud/migrations/001_domain.sql', import.meta.url), 'utf8'));
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON "user", session, account, verification, organization, member, invitation, "rateLimit" TO domus_runtime');
    const runtimeUrl = `postgres://domus_runtime:domus-runtime-isolated-test@127.0.0.1:${port}/postgres`;
    await mkdir('.wrangler', { recursive: true });
    await writeFile('.wrangler/integration.json', JSON.stringify({
        name: 'domus-local-integration', main: '../server/tests/cloud-integration.worker.js',
        compatibility_date: '2026-11-11', compatibility_flags: ['nodejs_compat'],
        assets: { directory: '../dist-cloud', binding: 'ASSETS', not_found_handling: 'single-page-application', run_worker_first: ['/api', '/api/*', '/__test/*'] },
        r2_buckets: [{ binding: 'FILES', bucket_name: 'domus-isolated-test-files' }],
        vars: { DOMUS_ENV: 'test', DOMUS_DOMAIN_ENABLED: 'true', DATABASE_URL: runtimeUrl,
            BETTER_AUTH_SECRET: 'domus-isolated-integration-auth-secret-32-characters',
            MAIL_FROM: 'test@example.invalid', PILOT_EMAILS: 'a@example.invalid,b@example.invalid' },
    }));
    worker = await unstable_dev('server/tests/cloud-integration.worker.js', {
        config: '.wrangler/integration.json', local: true, persist: false, port: 0, envFiles: [], logLevel: 'error',
        experimental: { disableExperimentalWarning: true, disableDevRegistry: true },
    });
    const base = `http://127.0.0.1:${worker.port}`;
    async function call(path, { method = 'GET', body, cookie, form, origin = base } = {}) {
        const response = await fetch(base + path, {
            method, redirect: 'manual', headers: { 'CF-Connecting-IP': body?.email === 'a@example.invalid' ? '192.0.2.1' : '192.0.2.2', ...(cookie ? { Cookie: cookie } : {}), ...(method === 'GET' ? {} : { Origin: origin }), ...(body ? { 'Content-Type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}), ...(form ? { body: form } : {}),
        });
        return response;
    }
    const post = (path, body, cookie) => call(path, { method: 'POST', body, cookie });
    check((await call('/api/properties')).status, 401, 'anonymous domain access');
    check((await post('/api/auth/sign-up/email', { email: 'outsider@example.invalid', name: 'Outside', password: 'outside-test-password' })).status, 403, 'pilot allowlist');
    const sessions = [];
    for (const letter of ['a', 'b']) {
        const email = `${letter}@example.invalid`;
        const signup = await post('/api/auth/sign-up/email', { email, name: `Test ${letter}`, password: 'isolated-test-password', callbackURL: `${base}/?verified=1` });
        check(signup.status, 200, 'signup');
        check((await post('/api/auth/sign-in/email', { email, password: 'isolated-test-password' })).status, 403, 'unverified login');
        const mails = await (await call('/__test/mail')).json();
        const verificationUrl = mails.find(mail => mail.to === email).text.match(/https?:\/\/\S+/)[0];
        const verified = await call(new URL(verificationUrl).pathname + new URL(verificationUrl).search);
        check(verified.status, 302, 'email verification');
        const login = await post('/api/auth/sign-in/email', { email, password: 'isolated-test-password' });
        check(login.status, 200, 'verified login');
        const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
        assert.ok(cookie);
        const simultaneous = await Promise.all([call('/api/session', { cookie }), call('/api/session', { cookie })]);
        const session = await simultaneous[0].json();
        check(session.account.id, (await simultaneous[1].json()).account.id, 'idempotent concurrent onboarding');
        check(await (await call('/api/properties', { cookie })).json(), [], 'empty new account');
        sessions.push({ cookie, ...session });
    }
    const [a, b] = sessions;
    const importBuffer = Buffer.from('historical-format-import-fixture');
    const importHash = createHash('sha256').update(importBuffer).digest('hex');
    await mkdir('.wrangler/import-fixture-files', { recursive: true });
    await writeFile(`.wrangler/import-fixture-files/${importHash}`, importBuffer);
    await writeFile('.wrangler/import-fixture.json', JSON.stringify({
        properties: [{ id: 'legacy-property', name: 'Legacy import', coldRent: 10, nebenkosten: 5 }],
        documents: [{ id: 'legacy-document', name: 'historical.zip', propertyId: 'legacy-property', hasFile: true }],
        documentFiles: { 'legacy-document': { name: 'historical.zip', hash: importHash, mime: 'application/zip' } },
    }));
    const importResult = execFileSync(process.execPath, ['scripts/cloud-import.js', '--environment', 'preview', '--email', 'a@example.invalid'], {
        encoding: 'utf8', env: { ...process.env, DOMUS_MIGRATION_DATABASE_URL: adminUrl, DOMUS_DB_FILE: '.wrangler/import-fixture.json', DOMUS_FILES_DIR: '.wrangler/import-fixture-files' },
    });
    check(importResult.includes('Dry run passed.'), true, 'legacy import preflight');
    check(await (await call('/api/properties', { cookie: a.cookie })).json(), [], 'import dry run rolls back');
    const propertyResponse = await post('/api/properties', { name: 'Isolated flat', coldRent: 700, nebenkosten: 100, accountId: b.account.id }, a.cookie);
    check(propertyResponse.status, 400, 'account id injection');
    const property = await (await post('/api/properties', { id: 'browser-id', name: 'Isolated flat', coldRent: 700, nebenkosten: 100 }, a.cookie)).json();
    assert.notEqual(property.id, 'browser-id'); checks++;
    check((await call(`/api/properties/${property.id}`, { cookie: b.cookie })).status, 404, 'cross-account read');
    check((await call(`/api/properties/${property.id}`, { method: 'PUT', body: { name: 'Injected' }, cookie: b.cookie })).status, 404, 'cross-account update');
    check((await call(`/api/properties/${property.id}`, { method: 'DELETE', cookie: b.cookie })).status, 404, 'cross-account delete');
    check((await post('/api/issues', { title: 'Cross reference', propertyId: property.id }, b.cookie)).status, 404, 'cross-account relation');
    check((await call(`/api/properties/${property.id}`, { method: 'PUT', body: { name: 'CSRF' }, cookie: a.cookie, origin: 'https://evil.invalid' })).status, 403, 'write origin');
    for (const [name, input] of [['tenants', { name: 'Tenant' }], ['issues', { title: 'Issue', propertyId: property.id }], ['costs', { name: 'Cost', amount: 12.34 }], ['contacts', { name: 'Contact' }]]) {
        check((await post(`/api/${name}`, input, a.cookie)).status, 201, `${name} create`);
        check(await (await call(`/api/${name}`, { cookie: b.cookie })).json(), [], `${name} isolation`);
    }
    const form = () => {
        const data = new FormData();
        data.append('file', new Blob(['%PDF-1.7\nDomus synthetic test\n%%EOF'], { type: 'application/pdf' }), 'contract.pdf');
        data.append('propertyId', property.id); data.append('category', 'Leases');
        return data;
    };
    const recurringCost = await (await post('/api/costs', { name: 'Monthly insurance', amount: 12.34, dueDate: '2026-12-01', recurrence: 'monthly' }, a.cookie)).json();
    check(recurringCost.recurrence, 'monthly', 'cost recurrence saved');
    check((await (await call(`/api/costs/${recurringCost.id}`, { method: 'PUT', body: { description: 'Preserve recurrence' }, cookie: a.cookie })).json()).recurrence, 'monthly', 'partial cost update preserves recurrence');
    check((await (await call(`/api/costs/${recurringCost.id}`, { method: 'PUT', body: { recurrence: 'yearly' }, cookie: a.cookie })).json()).recurrence, 'yearly', 'cost recurrence can change');
    check((await post('/api/costs', { name: 'Invalid recurrence', amount: 12.34, recurrence: 'daily' }, a.cookie)).status, 400, 'unsupported recurrence rejected');
    check((await call(`/api/costs/${recurringCost.id}`, { method: 'PUT', body: { recurrence: null }, cookie: a.cookie })).status, 400, 'invalid recurrence update rejected');
    check((await (await post('/api/costs', { name: 'One-off', amount: 1 }, a.cookie)).json()).recurrence, 'none', 'existing clients default to one-off');
    const uploaded = await call('/api/files/upload', { method: 'POST', form: form(), cookie: a.cookie });
    check(uploaded.status, 201, 'multipart upload');
    const document = (await uploaded.json()).document;
    check((await (await call('/api/files/upload', { method: 'POST', form: form(), cookie: a.cookie })).json()).duplicate, true, 'duplicate upload');
    check((await call(`/api/files/${document.id}/content`, { cookie: b.cookie })).status, 404, 'cross-account download');
    check((await call(`/api/files/${document.id}/content`, { cookie: a.cookie })).status, 200, 'private download');
    const spoof = new FormData(); spoof.append('file', new Blob(['<html>bad</html>']), 'spoof.pdf');
    check((await call('/api/files/upload', { method: 'POST', form: spoof, cookie: a.cookie })).status, 400, 'file signature');
    const large = Buffer.alloc(20 * 1024 * 1024);
    large.write('%PDF-1.7\n');
    const largeForm = new FormData(); largeForm.append('file', new Blob([large]), 'maximum.pdf');
    check((await call('/api/files/upload', { method: 'POST', form: largeForm, cookie: a.cookie })).status, 201, '20 MB upload in Workers');
    const excessiveForm = new FormData(); excessiveForm.append('file', new Blob([large, Buffer.from('x')]), 'too-large.pdf');
    check((await call('/api/files/upload', { method: 'POST', form: excessiveForm, cookie: a.cookie })).status, 413, 'upload byte limit');
    const rental = await (await post('/api/rentals', { propertyId: property.id, title: 'Rental' }, a.cookie)).json();
    const applied = await (await post(`/api/rentals/${rental.id}/applications`, { parties: [{ name: 'New Tenant' }] }, a.cookie)).json();
    check((await call(`/api/rentals/${rental.id}`, { method: 'PUT', body: { selectedApplicationId: applied.applications[0].id }, cookie: a.cookie })).status, 200, 'select application');
    const completion = { confirmSigned: true, contractDocumentId: document.id, start: '2027-01-01', coldRent: 700, utilities: 100, deposit: 2100 };
    const completed = await Promise.all([post(`/api/rentals/${rental.id}/complete`, completion, a.cookie), post(`/api/rentals/${rental.id}/complete`, completion, a.cookie)]);
    check(completed.map(response => response.status), [200, 200], 'concurrent completion');
    check((await completed[0].json()).id, (await completed[1].json()).id, 'single stable lease');
    check((await call('/api/rentals', { cookie: b.cookie })).status, 200, 'other account rentals');
    check((await (await call('/api/rentals', { cookie: b.cookie })).json()).leases, [], 'lease isolation');
    const runtime = new pg.Client({ connectionString: runtimeUrl });
    try {
        await runtime.connect();
        check((await runtime.query('SELECT * FROM properties')).rows, [], 'RLS without context');
        await runtime.query('BEGIN');
        await runtime.query("SELECT set_config('app.account_id', $1, true)", [b.account.id]);
        check((await runtime.query('SELECT * FROM properties')).rows, [], 'RLS with other account context');
        await runtime.query('ROLLBACK');
        check((await runtime.query('SELECT * FROM properties')).rows, [], 'context reset');
    } finally { await runtime.end(); }
    check((await post('/api/auth/request-password-reset', { email: 'a@example.invalid', redirectTo: `${base}/?auth=reset` })).status, 200, 'request password reset');
    const resetMail = (await (await call('/__test/mail')).json()).findLast(mail => mail.to === 'a@example.invalid');
    const resetLink = new URL(resetMail.text.match(/https?:\/\/\S+/)[0]);
    const token = resetLink.pathname.split('/').at(-1);
    check((await post('/api/auth/reset-password', { token, newPassword: 'changed-isolated-password' })).status, 200, 'reset password');
    check((await call('/api/session', { cookie: a.cookie })).status, 401, 'reset revokes old sessions');
    check((await post('/api/auth/reset-password', { token, newPassword: 'another-isolated-password' })).status, 400, 'reset token single use');
    check((await post('/api/auth/sign-out', {}, b.cookie)).status, 200, 'logout');
    check((await call('/api/session', { cookie: b.cookie })).status, 401, 'logout revokes session');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ extraHTTPHeaders: { 'CF-Connecting-IP': '192.0.2.50' } });
        await page.addInitScript(() => {
            if (!localStorage.getItem('domus-theme')) localStorage.setItem('domus-theme', 'dark');
        });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const legalRequests = [];
        const captureLegalRequest = request => { if (new URL(request.url()).pathname.startsWith('/api/')) legalRequests.push(request.url()); };
        page.on('request', captureLegalRequest);
        await page.goto(`${base}/impressum.html`);
        await page.getByRole('heading', { name: 'Impressum', exact: true }).waitFor();
        check(await page.getByText('Toni Gansel', { exact: true }).count(), 1, 'operator details from current Faktio checkout');
        const version = await page.locator('.release-version').textContent();
        check(/^Version [a-f0-9]{8}$/.test(version), true, 'build version in footer');
        await page.getByRole('contentinfo').getByRole('link', { name: 'Datenschutzerklärung', exact: true }).click();
        await page.getByRole('heading', { name: 'Datenschutzerklärung', exact: true }).waitFor();
        check(await page.locator('.release-version').textContent(), version, 'consistent legal page version');
        check(legalRequests, [], 'legal pages work without an auth or domain request');
        page.off('request', captureLegalRequest);
        await page.setViewportSize({ width: 390, height: 844 });
        check(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true, 'mobile privacy layout');
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(base);
        await page.getByRole('heading', { name: 'Bei Domus anmelden' }).waitFor();
        await mkdir('test-results/cloud', { recursive: true });
        await page.screenshot({ path: 'test-results/cloud/login-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'test-results/cloud/login-mobile.png', fullPage: true });
        check(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true, 'mobile auth layout');
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('b@example.invalid');
        await page.getByLabel('Passwort', { exact: true }).fill('isolated-test-password');
        await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
        await page.getByRole('link', { name: 'Wohnungen', exact: true }).waitFor();
        await page.getByRole('link', { name: 'Wohnungen', exact: true }).click();
        await page.getByRole('heading', { name: 'Wohnungen', exact: true }).waitFor();
        check(await page.getByRole('contentinfo').getByRole('link').count(), 2, 'footer in signed-in application');
        const accountTrigger = page.locator('.account-menu-trigger');
        check(await page.locator('.sidebar-footer summary').count(), 1, 'one permanent account entry');
        check(await page.locator('.sidebar-footer button:visible, .sidebar-footer select:visible').count(), 0, 'account actions start collapsed');
        await accountTrigger.click();
        check(await page.locator('.account-menu-email').textContent(), 'b@example.invalid', 'account details in popover');
        check(await page.getByLabel('Darstellung', { exact: true }).inputValue(), 'dark', 'previous theme preference preserved');
        await page.screenshot({ path: 'test-results/cloud/account-menu-desktop.png', fullPage: true });
        await page.getByLabel('Darstellung', { exact: true }).selectOption('light');
        await page.waitForFunction(() => globalThis.document.documentElement.dataset.theme === 'light');
        check(await page.evaluate(() => localStorage.getItem('domus-theme')), 'light', 'theme selection persisted');
        await page.reload();
        await accountTrigger.click();
        check(await page.getByLabel('Darstellung', { exact: true }).inputValue(), 'light', 'theme survives reload');
        await page.getByLabel('Darstellung', { exact: true }).selectOption('system');
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForFunction(() => globalThis.document.documentElement.dataset.theme === 'dark');
        await page.emulateMedia({ colorScheme: 'light' });
        await page.waitForFunction(() => globalThis.document.documentElement.dataset.theme === 'light');
        check(await page.evaluate(() => localStorage.getItem('domus-theme')), 'system', 'system appearance follows OS changes');
        await page.keyboard.press('Escape');
        check(await page.locator('.account-menu').getAttribute('open'), null, 'Escape closes account menu');
        check(await accountTrigger.evaluate(element => element === globalThis.document.activeElement), true, 'Escape returns focus to account entry');
        await accountTrigger.click();
        await page.getByRole('heading', { name: 'Wohnungen', exact: true }).click();
        check(await page.locator('.account-menu').getAttribute('open'), null, 'outside click closes account menu');
        await page.setViewportSize({ width: 390, height: 844 });
        await accountTrigger.click();
        const bounds = await page.locator('.account-menu-panel').boundingBox();
        check(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844, true, 'mobile account menu fits viewport');
        await page.screenshot({ path: 'test-results/cloud/account-menu-mobile.png', fullPage: true });
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 1280, height: 900 });
        check(await page.locator('main a[href^="/properties/"]').count(), 0, 'UI account starts empty');
        await accountTrigger.click();
        await page.getByLabel('Sprache', { exact: true }).selectOption('en');
        await page.getByRole('heading', { name: 'Properties', exact: true }).waitFor();
        check(await page.locator('.account-menu-label').textContent(), b.account.name, 'account name is preserved when translating');
        check(await page.evaluate(() => localStorage.getItem('domus-language')), 'en', 'language selection persisted');
        await page.reload();
        await page.getByRole('heading', { name: 'Properties', exact: true }).waitFor();
        check(await page.locator('html').getAttribute('lang'), 'en', 'language survives reload');
        await accountTrigger.click();
        check(await page.getByLabel('Language', { exact: true }).inputValue(), 'en', 'English account menu');
        await page.getByLabel('Language', { exact: true }).selectOption('de');
        await page.keyboard.press('Escape');
        await page.screenshot({ path: 'test-results/cloud/empty-properties.png', fullPage: true });
        await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
        await page.getByPlaceholder('z. B. Wohnung 4, Haus am Park').fill('Browser-created flat');
        await page.getByPlaceholder('Adresse oder Lage').fill('Synthetic location');
        await accountTrigger.click();
        await page.getByLabel('Sprache', { exact: true }).selectOption('en');
        check(await page.getByPlaceholder('e.g. Sunset Apartments, Apt 4').inputValue(), 'Browser-created flat', 'changing language preserves unsaved input');
        check(await page.getByPlaceholder('Address or Area').inputValue(), 'Synthetic location', 'form state stays intact');
        await page.screenshot({ path: 'test-results/cloud/language-form-en.png', fullPage: true });
        await page.getByLabel('Language', { exact: true }).selectOption('de');
        await page.keyboard.press('Escape');
        await page.locator('form select').nth(1).selectOption('Renovated');
        await page.getByRole('button', { name: 'Wohnung speichern', exact: true }).click();
        await page.getByRole('heading', { name: 'Browser-created flat', exact: true }).waitFor();
        await page.reload();
        await page.getByRole('heading', { name: 'Browser-created flat', exact: true }).waitFor();
        check(await page.locator('main a[href^="/properties/"]').count(), 1, 'UI creation persists');
        await page.getByRole('link', { name: 'Dokumente', exact: true }).click();
        await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
        await page.getByLabel('Dateien hochladen (bis 20 MB je Datei)').setInputFiles({ name: 'browser.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nBrowser test\n%%EOF') });
        await page.getByRole('heading', { name: 'browser.pdf', exact: true }).waitFor();
        const download = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Herunterladen', exact: true }).click();
        check((await download).suggestedFilename(), 'browser.pdf', 'UI private download');
        const pages = [
            ['Übersicht', 'Übersicht', 'Dashboard', 'Dashboard'],
            ['Wohnungen', 'Wohnungen', 'Properties', 'Properties'],
            ['Anliegen', 'Anliegen und Anfragen', 'Issues', 'Issues & Requests'],
            ['Dokumente', 'Dokumente', 'Documents', 'Documents'],
            ['Kosten', 'Kosten', 'Costs', 'Costs'],
            ['Kontakte', 'Kontakte', 'Contacts', 'Contacts'],
        ];
        for (const language of ['de', 'en']) {
            await accountTrigger.click();
            await page.getByLabel('Sprache', { exact: true }).selectOption(language);
            await page.keyboard.press('Escape');
            for (const names of pages) {
                const offset = language === 'de' ? 0 : 2;
                await page.getByRole('navigation').first().getByRole('link', { name: names[offset], exact: true }).click();
                await page.getByRole('heading', { name: names[offset + 1], exact: true }).first().waitFor();
                check(await page.locator('html').getAttribute('lang'), language, `${names[offset]} language`);
            }
            await accountTrigger.click();
            await page.screenshot({ path: `test-results/cloud/language-${language}.png`, fullPage: true });
            await page.keyboard.press('Escape');
            for (const width of [1280, 1920, 390]) {
                await page.setViewportSize({ width, height: 900 });
                let reference;
                for (const names of pages.slice(1)) {
                    const offset = language === 'de' ? 0 : 2;
                    await page.getByRole('navigation').first().getByRole('link', { name: names[offset], exact: true }).click();
                    await page.getByRole('heading', { name: names[offset + 1], exact: true }).first().waitFor();
                    await page.evaluate(() => document.defaultView.scrollTo(0, 0));
                    const button = await page.locator('.page-header > .btn-primary').boundingBox();
                    assert.ok(button, `${names[offset]} has an add button`);
                    reference ??= button;
                    for (const dimension of ['x', 'y', 'width', 'height']) {
                        check(Math.abs(button[dimension] - reference[dimension]) <= 1, true,
                            `${names[offset]} add button ${dimension} stays aligned at ${width}px (${language})`);
                    }
                    check(await page.evaluate(() => document.documentElement.scrollWidth <= document.defaultView.innerWidth), true,
                        `${names[offset]} fits viewport at ${width}px (${language})`);
                }
            }
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.getByRole('navigation').first().getByRole('link', { name: language === 'de' ? 'Wohnungen' : 'Properties', exact: true }).click();
            await page.locator('main a[href^="/properties/"]').first().click();
            await page.locator('a[href^="/rentals?propertyId="]').last().click();
            await page.getByRole('heading', { name: language === 'de' ? 'Vermietungen' : 'Rentals', exact: true }).waitFor();
            check(await page.locator('.sidebar-nav .nav-item.active').getAttribute('href'), '/properties', 'rentals belong to properties');
            await page.goto(`${base}/tenants`);
            await page.getByRole('heading', { name: language === 'de' ? 'Kontakte' : 'Contacts', exact: true }).waitFor();
            check(new URL(page.url()).searchParams.get('filter'), 'tenants', 'legacy tenant route opens combined contacts');
            check(await page.getByRole('group', { name: 'Filter', exact: true }).getByRole('button', { name: language === 'de' ? /^Mieter/ : /^Tenant/ }).getAttribute('aria-pressed'), 'true', 'tenant filter selected');
        }
        await page.getByRole('navigation').first().getByRole('link', { name: 'Costs', exact: true }).click();
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        const costForm = page.locator('main form').first();
        await costForm.locator('input[type="text"]').first().fill('Recurring insurance');
        await costForm.locator('input[type="number"]').fill('24.50');
        await costForm.locator('input[type="date"]').first().fill('2026-12-01');
        check(await page.getByLabel('Recurrence', { exact: true }).inputValue(), 'none', 'new UI cost defaults to one-off');
        await page.getByLabel('Recurrence', { exact: true }).selectOption('monthly');
        const costCreated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/costs' && response.request().method() === 'POST');
        await page.getByRole('button', { name: 'Save Cost', exact: true }).click();
        const createdCostResponse = await costCreated;
        check(createdCostResponse.status(), 201, 'UI cost creation succeeds');
        check((await createdCostResponse.json()).name, 'Recurring insurance', 'UI cost name saved');
        const costRow = page.locator('.list-row').filter({ hasText: 'Recurring insurance' });
        await page.getByRole('heading', { name: 'Recurring insurance', exact: true }).waitFor({ timeout: 5000 }).catch(async error => {
            await page.screenshot({ path: 'test-results/cloud/cost-create-failure.png', fullPage: true, animations: 'disabled' });
            console.error('Cost creation browser diagnostics:', JSON.stringify({ errors, text: await page.locator('body').innerText() }));
            throw error;
        });
        check((await costRow.locator('.list-badge.strong').textContent()).trim().endsWith('/ month'), true, 'monthly amount shown in shared list');
        await page.reload();
        await costRow.getByRole('heading', { name: 'Recurring insurance', exact: true }).click();
        check(await page.getByLabel('Recurrence', { exact: true }).inputValue(), 'monthly', 'monthly cost survives reload');
        check(await costRow.locator('input[name="amount"]').inputValue(), '24.5', 'amount remains per occurrence');
        await page.getByLabel('Recurrence', { exact: true }).selectOption('yearly');
        await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
        await page.getByRole('button', { name: 'Save Changes', exact: true }).waitFor({ state: 'detached' });
        check((await costRow.locator('.list-badge.strong').textContent()).trim().endsWith('/ year'), true, 'yearly amount shown in shared list');
        await accountTrigger.click();
        await page.getByLabel('Language', { exact: true }).selectOption('de');
        await page.keyboard.press('Escape');
        await costRow.getByRole('heading', { name: 'Recurring insurance', exact: true }).click();
        check(await page.getByLabel('Wiederholung', { exact: true }).inputValue(), 'yearly', 'German recurrence edit');
        await page.setViewportSize({ width: 390, height: 900 });
        await page.screenshot({ path: 'test-results/cloud/recurring-cost-mobile.png', fullPage: true, animations: 'disabled' });
        await page.getByLabel('Wiederholung', { exact: true }).selectOption('none');
        await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
        await page.reload();
        await costRow.getByRole('heading', { name: 'Recurring insurance', exact: true }).click();
        check(await page.getByLabel('Wiederholung', { exact: true }).inputValue(), 'none', 'recurrence can be removed permanently');
        await page.setViewportSize({ width: 1280, height: 900 });
        await accountTrigger.click();
        await page.getByLabel('Sprache', { exact: true }).selectOption('en');
        await page.keyboard.press('Escape');
        await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy policy', exact: true }).click();
        await page.getByRole('heading', { name: 'Privacy policy', exact: true }).waitFor();
        check(await page.getByRole('heading', { name: '5. Cookies and browser storage', exact: true }).count(), 1, 'English privacy policy');
        await page.getByRole('link', { name: '← Back to Domus', exact: true }).click();
        await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
        await page.getByRole('navigation').first().getByRole('link', { name: 'Documents', exact: true }).click();
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await page.getByLabel('Upload files (up to 20 MB each)').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid-file-content') });
        await page.getByRole('alert').filter({ hasText: 'The file content does not match its type.' }).waitFor();
        checks++;
        await accountTrigger.click();
        await page.getByLabel('Language', { exact: true }).selectOption('de');
        await page.keyboard.press('Escape');
        await page.getByRole('alert').filter({ hasText: 'Dateiinhalt und Dateityp passen nicht zusammen.' }).waitFor();
        checks++;
        await accountTrigger.click();
        await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
        await page.getByRole('heading', { name: 'Bei Domus anmelden' }).waitFor();
        await page.getByRole('button', { name: 'Passwort vergessen?' }).click();
        await page.getByRole('heading', { name: 'Passwort zurücksetzen' }).waitFor();
        check(errors, [], 'browser runtime errors');
        checks += 2;
    } finally { await browser.close(); }
    console.log(`Cloud integration passed: ${checks} checks against isolated PostgreSQL, actual Workers runtime, local R2 and browser login/logout.`);
} finally {
    if (worker) await worker.stop();
    if (admin) await admin.end();
    try { execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' }); } catch { /* Container creation may have failed. */ }
}
