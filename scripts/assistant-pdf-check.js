import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import assert from "node:assert/strict";
import {
  pdfHtml,
  exposeHtml,
  statementHtml,
} from "../server/cloud/assistant-documents.js";

const output = "test-results/assistant-pdfs";
await mkdir(output, { recursive: true });
const sender = {
  name: "Muster Immobilien",
  address: "Musterstrasse 1\n10115 Berlin",
  email: "test@example.invalid",
  phone: "+49 30 000000",
};
const expose = {
  title: "Helle Wohnung mit Balkon",
  intro:
    "Diese helle Wohnung bietet Platz für den Alltag. Alle Angaben in diesem Test sind synthetisch.",
  features:
    "Drei Zimmer, Balkon und eine moderne Küche.\nDie Ausstattung ist vor Veröffentlichung zu prüfen.",
  building: "Gepflegtes Mehrfamilienhaus mit gemeinsamer Hausakte.",
  location: "Eine sachliche Lagebeschreibung mit überprüfbaren Quellen.",
  terms: "Kaltmiete 800 EUR, Nebenkosten 180 EUR. Verfügbar nach Vereinbarung.",
  contact: "Muster Immobilien · test@example.invalid",
  facts: {
    name: "Wohnung 4",
    street: "Musterstrasse 1",
    postalCode: "10115",
    city: "Berlin",
    size: 75.5,
    rooms: 3,
    coldRent: 800,
    nebenkosten: 180,
    heating: "Fernwärme",
  },
  sources: [
    {
      title: "Synthetische Beispielquelle",
      url: "https://example.invalid/quelle",
      accessedAt: "2026-11-15",
    },
  ],
};
const documents = Array.from({ length: 45 }, (_, index) => ({
  id: `doc-${index}`,
  name: `Beleg ${index + 1} – Versicherung und laufende Betriebskosten.pdf`,
}));
const statement = {
  start: "2025-01-01",
  end: "2025-12-31",
  building: { street: "Musterstrasse 1", postalCode: "10115", city: "Berlin" },
  documents,
  advances: [
    {
      leaseId: "lease",
      date: "2025-01-02",
      amount: "2160.00",
      reference:
        "Bestätigte tatsächliche Vorauszahlungen, synthetischer Zahlungsnachweis",
    },
  ],
};
const row = {
  leaseId: "lease",
  name: "Synthetische Mietpartei",
  unit: "Wohnung 4",
  start: "2025-01-01",
  end: "2025-12-31",
  totalCents: 225000,
  advanceCents: 216000,
  balanceCents: 9000,
  lines: documents.map((doc, index) => ({
    name: `Kostenposition ${index + 1}: dokumentierte laufende Betriebskosten mit ausführlicher Beschreibung`,
    category: "Betriebskosten",
    totalCents: 100000,
    periodCents: 100000,
    allocation: "area",
    numerator: 755000,
    denominator: 15100000,
    cents: 5000,
    documentId: doc.id,
    page: "Seite 1, Position 1",
    start: "2025-01-01",
    end: "2025-12-31",
  })),
};
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, title, content] of [
    ["expose", expose.title, exposeHtml(expose)],
    ["statement", "Nebenkostenabrechnung 2025", statementHtml(statement, row)],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 794, height: 1123 },
    });
    await page.emulateMedia({ media: "print" });
    await page.setContent(
      pdfHtml({ title, sender, content, simulated: true }),
      { waitUntil: "load" },
    );
    assert.equal(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      true,
      "PDF HTML must not overflow",
    );
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font:8px Arial;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
    await writeFile(`${output}/${name}.pdf`, bytes);
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() > 0);
    if (name === "statement")
      assert.ok(pdf.getPageCount() > 1, "Long statements must paginate");
    console.log(`${name}: ${pdf.getPageCount()} pages`);
    await page.close();
  }
} finally {
  await browser.close();
}
