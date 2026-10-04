import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('full manual rental workflow uses isolated API and keeps future occupancy unchanged', async ({ page }) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'domus-rental-e2e-'));
    await mkdir(path.join(directory, 'raw'));
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
        import app from './server/app.js';
        import db from './server/db.js';
        db.data = { properties: [{ id: 'unit', name: 'Beispielwohnung', location: '1. OG', status: 'Vacant', occupants: 0, coldRent: 500, nebenkosten: 100 }], tenants: [], rentals: [], leases: [], documents: [], issues: [], costs: [], contacts: [] };
        const server = app.listen(0, '127.0.0.1', () => console.log('READY:' + server.address().port));
    `], { cwd: process.cwd(), windowsHide: true, env: { ...process.env, NODE_ENV: 'test', DOMUS_RAW_DIR: path.join(directory, 'raw'), DOMUS_FILES_DIR: path.join(directory, 'files') }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
        const port = await new Promise((resolve, reject) => {
            let output = '';
            const timer = setTimeout(() => reject(new Error('Isolated API did not start')), 10000);
            child.stdout.on('data', chunk => { output += chunk; const match = output.match(/READY:(\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
            child.once('error', error => { clearTimeout(timer); reject(error); });
            child.once('exit', code => { clearTimeout(timer); reject(new Error(`Isolated API exited: ${code}`)); });
        });
        await page.route('http://localhost:3001/api/**', async route => {
            const url = new URL(route.request().url());
            const response = await route.fetch({ url: `http://127.0.0.1:${port}${url.pathname}${url.search}` });
            await route.fulfill({ response });
        });
        await page.goto('/rentals?propertyId=unit');
        await page.getByRole('button', { name: 'Neue Vermietung' }).click();
        await page.getByLabel('Bezeichnung', { exact: true }).fill('Neuvermietung Beispielwohnung');
        await page.getByLabel('Verfügbar ab').fill('2099-01-01');
        await page.getByLabel('Kaltmiete (€ / Monat)').fill('850.25');
        await page.getByLabel('Kaution (€)').fill('2550.75');
        await page.getByRole('button', { name: 'Vorgang speichern' }).click();
        await expect(page).toHaveURL(/\/rentals\/[^/?]+$/);
        const rentalUrl = page.url();
        await page.getByRole('button', { name: 'Bewerbung hinzufügen' }).click();
        await page.getByRole('group', { name: 'Vertragspartei 1' }).getByLabel('Name', { exact: true }).fill('Alex Beispiel');
        await page.getByRole('button', { name: 'Weitere Vertragspartei' }).click();
        await page.getByRole('group', { name: 'Vertragspartei 2' }).getByLabel('Name', { exact: true }).fill('Kim Beispiel');
        await page.getByLabel('Anfrage', { exact: true }).fill('Wir möchten gemeinsam einziehen.');
        await page.getByRole('button', { name: 'Bewerbung speichern' }).click();
        await expect(page.getByRole('heading', { name: 'Alex Beispiel & Kim Beispiel' })).toBeVisible();
        await page.getByRole('button', { name: 'Besichtigung hinzufügen' }).click();
        await page.getByLabel('Datum', { exact: true }).fill('2098-12-01');
        await page.getByLabel('Uhrzeit', { exact: true }).fill('15:30');
        await page.getByRole('button', { name: 'Termin speichern' }).click();
        await expect(page.getByRole('heading', { name: '2098-12-01 · 15:30' })).toBeVisible();
        await page.getByRole('button', { name: 'Für Vertrag auswählen' }).click();
        await expect(page.getByLabel('Unterschriebener Mietvertrag')).toBeVisible();
        await page.goto('/properties/unit');
        await page.getByLabel('Kategorie für neue Dateien').selectOption('Leases');
        await page.getByLabel('Dateien hochladen (bis 20 MB je Datei)').setInputFiles({ name: 'fiktiver-vertrag.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fictional signed contract fixture') });
        await expect(page.getByRole('heading', { name: 'fiktiver-vertrag.pdf' })).toBeVisible();
        await page.goto(rentalUrl);
        await page.getByLabel('Unterschriebener Mietvertrag').selectOption({ label: 'fiktiver-vertrag.pdf' });
        await page.getByLabel('Ich habe die Vertragsdaten geprüft', { exact: false }).check();
        await page.getByRole('button', { name: 'Abschließen und Mietverhältnis anlegen' }).click();
        await expect(page.getByText('Der Abschluss ist gespeichert.', { exact: false })).toBeVisible();
        await page.reload();
        await expect(page.getByText('Der Abschluss ist gespeichert.', { exact: false })).toBeVisible();
        await page.getByRole('link', { name: 'Zur Übersicht und den Mietverhältnissen', exact: false }).click();
        await expect(page.getByRole('heading', { name: 'Beispielwohnung · Geplant' })).toBeVisible();
        await expect(page.getByText('2099-01-01 bis unbefristet', { exact: false })).toBeVisible();
        await page.screenshot({ path: 'test-results/rentals-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        await page.screenshot({ path: 'test-results/rentals-mobile.png', fullPage: true });
        await page.goto('/properties/unit');
        await expect(page.getByText('Vacant', { exact: true })).toBeVisible();
        await expect(page.getByText('No tenants assigned.', { exact: true })).toBeVisible();
    } finally {
        const stopped = new Promise(resolve => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
        child.kill();
        await stopped;
        if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('domus-rental-e2e-')) await rm(directory, { recursive: true, force: true });
    }
});
