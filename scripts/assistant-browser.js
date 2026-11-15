import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

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
    .getByRole("button", { name: "Haus speichern", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Browser Testhaus", exact: true })
    .click();
  const buildingUrl = page.url();
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
      .getByRole("heading", { name: "Hausunterlagen", exact: true })
      .count(),
    1,
    "building documents in UI",
  );
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
