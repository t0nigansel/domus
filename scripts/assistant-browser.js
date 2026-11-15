import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { PDFDocument } from 'pdf-lib';

export async function assistantBrowser({ page, base, check, call }) {
  await page.goto(`${base}/properties`);
  await page.getByRole("button", { name: "Haus anlegen", exact: true }).click();
  await page
    .getByLabel("Hausbezeichnung", { exact: true })
    .fill("Browser Testhaus");
  await page
    .getByLabel("Straße und Hausnummer", { exact: true })
    .fill("Musterstrasse 1");
  await page.getByLabel("Postleitzahl", { exact: true }).fill("10115");
  await page.getByLabel("Ort", { exact: true }).fill("Berlin");
  await page
    .getByRole("button", { name: "Speichern", exact: true })
    .click();
  const overview = page.locator('main > .page-container');
  const overviewBefore = await overview.boundingBox();
  await page.getByRole('heading', { name: 'Browser Testhaus', exact: true }).click();
  await page.getByRole('button', { name: 'Hausdaten bearbeiten', exact: true }).waitFor();
  const overviewAfter = await overview.boundingBox();
  check(overviewAfter.x, overviewBefore.x, 'opening a house preserves overview alignment');
  check(overviewAfter.width, overviewBefore.width, 'opening a house preserves overview width');
  check(await page.getByRole('heading', { name: 'Wohnungen', exact: true, level: 1 }).count(), 1, 'house stays in the apartment overview');
  check(await page.getByText('Wohnung nicht gefunden.', { exact: true }).count(), 0, 'house route is distinct from apartment route');
  const buildingUrl = page.url();
  await page.getByRole('button', { name: 'Zuordnung verwalten', exact: true }).click();
  await page
    .getByRole("button", { name: "Diesem Haus zuordnen", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Zuordnung entfernen", exact: true })
    .first()
    .waitFor();
  check(
    await page
      .getByRole("heading", { name: /^Fotos & Dokumente/ })
      .count(),
    1,
    "building documents in UI",
  );
  await page.getByRole('button',{name:'Dateien hinzufügen',exact:true}).click();
  await page.getByLabel('Kategorie für neue Dateien',{exact:true}).selectOption('Photos');
  await page.getByLabel('Dateien hochladen (bis 20 MB je Datei)').setInputFiles({name:'Hausfront.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5l8F8AAAAASUVORK5CYII=','base64')});
  await page.getByRole('img',{name:'Hausfront.png',exact:true}).waitFor();
  const photo=page.locator('.property-photo').filter({has:page.getByRole('img',{name:'Hausfront.png',exact:true})});
  await photo.getByRole('button',{name:'Bearbeiten',exact:true}).click();
  check(await photo.getByLabel('Wohnungszuordnung',{exact:true}).count(),0,'house photo cannot accidentally lose its building assignment');
  await photo.getByLabel('Raum / Beschreibung',{exact:true}).fill('Vorderansicht Testhaus');
  await photo.getByLabel('Als Titelbild verwenden',{exact:true}).check();
  await photo.getByRole('button',{name:'Speichern',exact:true}).click();
  await page.getByRole('img',{name:'Vorderansicht Testhaus',exact:true}).first().waitFor();
  const pdf=await PDFDocument.create();pdf.addPage().drawText('Synthetic building document');
  await page.getByLabel('Kategorie für neue Dateien',{exact:true}).selectOption('Invoices');
  await page.getByLabel('Dateien hochladen (bis 20 MB je Datei)').setInputFiles({name:'Hausunterlage.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await page.getByRole('heading',{name:'Hausunterlage.pdf',exact:true}).waitFor();
  await page.reload();
  await page.getByRole('img',{name:'Vorderansicht Testhaus',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Hausunterlage.pdf',exact:true}).waitFor();
  const houseFiles=(await(await page.request.get(base+'/api/documents')).json()).filter(doc=>['Hausfront.png','Hausunterlage.pdf'].includes(doc.name));
  check(houseFiles.length,2,'house photo and PDF survive reload');
  check(houseFiles.every(doc=>doc.buildingId===buildingUrl.split('/').at(-1)&&!doc.propertyId),true,'uploads stay scoped to the building');
  const pdfRow=page.locator('.document-workspace .list-row').filter({has:page.getByRole('heading',{name:'Hausunterlage.pdf',exact:true})});
  const download=await page.request.get(new URL(await pdfRow.getByRole('link',{name:'Herunterladen',exact:true}).getAttribute('href'),base).href);
  check((await download.body()).subarray(0,5).toString(),'%PDF-','house PDF can be downloaded');
  await page.getByRole('searchbox',{name:/Dateien suchen/}).fill('Hausunterlage');
  check(await page.getByRole('img',{name:'Vorderansicht Testhaus',exact:true}).count(),0,'house search filters photo gallery');
  await page.getByRole('searchbox',{name:/Dateien suchen/}).fill('');
  const filesSection=page.getByRole('region',{name:'Fotos & Dokumente',exact:true});
  await filesSection.screenshot({path:'test-results/cloud/building-files-desktop.png'});
  await page.setViewportSize({width:390,height:900});
  check(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth<=globalThis.innerWidth),true,'building photos and documents fit mobile layout');
  await filesSection.screenshot({path:'test-results/cloud/building-files-mobile.png'});
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:'test-results/cloud/building-inline-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:'test-results/cloud/building-inline-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.locator(".account-menu-trigger").click();
  await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
  await page
    .getByLabel("Name / Firma", { exact: true })
    .fill("Browser Testvermieter");
  await page
    .getByLabel("Anschrift", { exact: true })
    .fill("Musterstrasse 1, 10115 Berlin");
  await page
    .getByRole("button", { name: "Einstellungen speichern", exact: true })
    .click();
  await page.getByText("Einstellungen gespeichert.", { exact: true }).waitFor();
  await page
    .getByLabel("API-Schlüssel", { exact: true })
    .fill("fake-browser-test-key");
  await page.getByLabel("Modell", { exact: true }).fill("test-model");
  await page
    .getByRole("button", {
      name: "Verbindung speichern / ersetzen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Verbindung prüfen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Für Assistenten verwenden", exact: true })
    .click();
  await page.getByRole("button", { name: "Ausgewählt", exact: true }).waitFor();
  check(
    await page.getByLabel("API-Schlüssel", { exact: true }).inputValue(),
    "",
    "key input cleared after saving",
  );
  await mkdir("test-results/cloud", { recursive: true });
  await page.screenshot({
    path: "test-results/cloud/settings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  check(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
    true,
    "settings mobile layout",
  );
  await page.screenshot({
    path: "test-results/cloud/settings-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(buildingUrl);
  await page
    .getByRole("link", { name: "Browser-created flat", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Exposé erstellen", exact: true })
    .click();
  await page.getByRole("button", { name: "Neues Exposé", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: /Ich bestätige die Verarbeitung der ausgewählten/,
    })
    .check();
  await page
    .getByRole("button", { name: "KI-Entwurf erstellen", exact: true })
    .click();
  await page
    .getByText(
      "Simulation: Dieser Entwurf enthält keine echte Webrecherche und wird im PDF als Simulation gekennzeichnet.",
      { exact: true },
    )
    .waitFor();
  await page.screenshot({
    path: "test-results/cloud/expose-draft-before-check.png",
    fullPage: true,
  });
  assert.match(
    await page.getByLabel("Kurzbeschreibung", { exact: true }).inputValue(),
    /SIMULATION/,
  );
  await page.screenshot({
    path: "test-results/cloud/expose-draft.png",
    fullPage: true,
  });
  await page.goto(`${buildingUrl}/statements`);
  await page
    .getByRole("button", { name: "Abrechnung anlegen", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Berechnungsvorschau", exact: true })
    .waitFor();
  check(
    await page
      .getByRole("button", {
        name: "Abrechnungen freigeben und PDFs erstellen",
        exact: true,
      })
      .isDisabled(),
    true,
    "unreviewed statement cannot finalize",
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "test-results/cloud/statement-mobile-before-check.png",
    fullPage: true,
  });
  check(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
    true,
    "statement mobile layout",
  );
  await page.screenshot({
    path: "test-results/cloud/statement-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/settings`);
  await page
    .getByLabel("Aktuelles Passwort", { exact: true })
    .first()
    .fill("isolated-test-password");
  await page
    .getByLabel("Neues Passwort", { exact: true })
    .fill("new-browser-test-password");
  await page
    .getByRole("button", { name: "Passwort ändern", exact: true })
    .click();
  await page
    .getByText("Passwort geändert. Andere Sitzungen wurden beendet.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel("Aktuelles Passwort", { exact: true })
    .first()
    .fill("new-browser-test-password");
  await page
    .getByLabel("Neue E-Mail-Adresse", { exact: true })
    .fill("updated-b@example.invalid");
  await page
    .getByRole("button", { name: "E-Mail-Adresse ändern", exact: true })
    .click();
  await page
    .getByText(
      "Bitte bestätige die Änderung zuerst über die bisherige und anschließend über die neue E-Mail-Adresse.",
      { exact: true },
    )
    .waitFor();
  let mails = await (await call("/__test/mail")).json();
  const confirmation = mails.findLast(
    (mail) => mail.to === "b@example.invalid",
  );
  assert.ok(confirmation.text.includes("E-Mail-Adresse"));
  await page.goto(confirmation.text.match(/https?:\/\/\S+/)[0]);
  mails = await (await call("/__test/mail")).json();
  const verification = mails.findLast(
    (mail) => mail.to === "updated-b@example.invalid",
  );
  assert.ok(verification);
  await page.goto(verification.text.match(/https?:\/\/\S+/)[0]);
  await page
    .getByRole("heading", { name: "Einstellungen", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Zugang und Sicherheit", exact: true })
    .waitFor();
  check(
    await page
      .locator("main")
      .getByText("updated-b@example.invalid", { exact: true })
      .count(),
    1,
    "verified email change keeps account data",
  );
}
