import { test, expect } from '@playwright/test';

test('Wohnungsakte saves details, imports a plan and keeps publication opt-in', async ({ page }) => {
    let property = { id: 'demo', name: 'Testwohnung', location: 'Top Left', status: 'Vacant', condition: 'Good', coldRent: 800, nebenkosten: 100, occupants: 0 };
    let documents = [];
    await page.route('**/api/**', async route => {
        const req = route.request();
        const endpoint = new URL(req.url()).pathname;
        let body = [];
        if (endpoint === '/api/properties') body = [property];
        else if (endpoint === '/api/properties/demo') {
            property = { ...property, ...req.postDataJSON() };
            body = property;
        } else if (endpoint === '/api/documents') body = documents;
        else if (endpoint === '/api/files/raw-files') body = [{ path: 'demo/plan.pdf', name: 'plan.pdf', bytes: 128 }];
        else if (endpoint === '/api/files/import') {
            const input = req.postDataJSON();
            const document = { id: 'plan', name: 'plan.pdf', propertyId: input.propertyId, category: input.category, type: 'pdf', size: '1 KB', hasFile: true, published: false };
            documents.push(document);
            body = { document, duplicate: false };
        } else if (endpoint === '/api/files/plan/metadata') {
            documents = documents.map(d => ({ ...d, ...req.postDataJSON() }));
            body = documents[0];
        }
        await route.fulfill({ json: body });
    });
    await page.goto('/properties/demo');
    await expect(page.getByRole('heading', { name: 'Wohnungsakte', exact: true })).toBeVisible();
    await page.getByLabel('Straße und Hausnummer').fill('Beispielstraße 12');
    await page.getByLabel('Wohnfläche (m²)').fill('72.5');
    await page.getByLabel('Zimmer', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Stammdaten speichern' }).click();
    await expect(page.getByText('Stammdaten gespeichert.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Wohnfläche (m²)')).toHaveValue('72.5');
    await page.getByLabel('Kategorie für neue Dateien').selectOption('FloorPlans');
    await page.getByRole('button', { name: 'Rohdaten einlesen' }).click();
    await page.getByRole('button', { name: 'Importieren', exact: true }).click();
    const card = page.locator('.managed-file');
    await expect(card.getByRole('heading', { name: 'plan.pdf' })).toBeVisible();
    await expect(card.getByText('Intern', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Herunterladen' })).toHaveAttribute('href', /\/api\/files\/plan\/content$/);
    await card.getByRole('button', { name: 'Angaben bearbeiten' }).click();
    await card.getByLabel('Raum / Beschreibung').fill('Grundriss der Wohnung');
    await card.getByLabel('Für Inserate freigegeben').check();
    await card.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByText('Dokumentangaben gespeichert.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Grundriss der Wohnung', { exact: true })).toBeVisible();
    await expect(page.getByText('Für Inserate freigegeben', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Wohnungsakte', exact: true })).toBeVisible();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/dossier-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: 'test-results/dossier-desktop.png', fullPage: true });
});
