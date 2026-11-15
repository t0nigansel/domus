import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth/mammoth.browser.js";
import { unzipSync, Zip, ZipPassThrough, strToU8 } from "fflate";
import puppeteer from "@cloudflare/puppeteer";
import { rentalError } from "../../src/domain/rentals.js";
import { ALLOCATION_KEYS } from "../../src/domain/utilityStatements.js";

export async function documentParts(file, bytes) {
  if (file.mime === "application/pdf") {
    let pdf;
    try {
      pdf = await PDFDocument.load(bytes);
    } catch {
      throw rentalError(
        "Das PDF ist geschützt oder nicht lesbar. Bitte manuell prüfen.",
      );
    }
    if (pdf.getPageCount() > 100)
      throw rentalError(
        "Mehr als 100 Seiten: Bitte das Dokument aufteilen oder manuell prüfen.",
      );
    const parts = [];
    for (let from = 0; from < pdf.getPageCount(); from += 20) {
      const part = await PDFDocument.create();
      const to = Math.min(from + 20, pdf.getPageCount());
      const pages = await part.copyPages(
        pdf,
        Array.from({ length: to - from }, (_, index) => from + index),
      );
      pages.forEach((page) => part.addPage(page));
      parts.push({
        name: file.name,
        mime: file.mime,
        base64: Buffer.from(await part.save()).toString("base64"),
        pageOffset: from,
      });
    }
    return parts;
  }
  if (file.mime.startsWith("image/"))
    return [
      {
        name: file.name,
        mime: file.mime,
        base64: Buffer.from(bytes).toString("base64"),
        pageOffset: 0,
      },
    ];
  if (file.mime.endsWith("wordprocessingml.document")) {
    let size = 0;
    unzipSync(bytes, {
      filter: (entry) => {
        size += entry.originalSize;
        if (size > 8 * 1024 * 1024)
          throw rentalError("Das Word-Dokument ist entpackt zu groß.");
        return false;
      },
    });
    const result = await mammoth.extractRawText({
      arrayBuffer: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ),
    });
    if (result.value.length > 100000)
      throw rentalError(
        "Das Word-Dokument enthält zu viel Text. Bitte aufteilen.",
      );
    return [{ text: result.value, pageOffset: 0 }];
  }
  throw rentalError(
    "Dieses Dokumentformat bitte als PDF hinterlegen oder manuell auswerten.",
  );
}
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const money = (value) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    value / 100,
  );
export function pdfHtml({
  title,
  sender,
  content,
  simulated = false,
  images = [],
  logo,
}) {
  return `<!doctype html><html lang="de"><meta charset="utf-8"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:11pt Arial,sans-serif;color:#172b2a;line-height:1.5}h1{font-size:25pt;line-height:1.2;color:#185d53}h1,h2{break-after:avoid}h2{font-size:15pt;margin-top:22pt}p{white-space:pre-line;overflow-wrap:anywhere;orphans:3;widows:3}.sender{font-size:9pt;border-bottom:1px solid #a9bfb9;padding-bottom:12px}.logo{max-height:55px;max-width:180px}table{width:100%;border-collapse:collapse;font-size:9pt;margin:14px 0}th,td{border-bottom:1px solid #ddd;text-align:left;padding:7px;overflow-wrap:anywhere}thead{display:table-header-group}tr,img{break-inside:avoid}img.photo{width:100%;max-height:210mm;object-fit:contain;margin-top:15px}.notice{background:#fff2cb;padding:12px}.source{font-size:9pt;overflow-wrap:anywhere}.footer{margin-top:22px;font-size:9pt;color:#49635d}</style><body><div class="sender">${logo ? `<img class="logo" src="${logo}" alt="Logo"><br>` : ""}${escapeHtml(sender.name)}<br>${escapeHtml(sender.address).replace(/\n/g, "<br>")}<br>${escapeHtml([sender.email, sender.phone].filter(Boolean).join(" · "))}</div>${simulated ? '<p class="notice">SIMULATION — mit Testantworten erstellt, nicht zur Veröffentlichung oder Abrechnung verwenden.</p>' : ""}<h1>${escapeHtml(title)}</h1>${content}${images.map((image) => `<img class="photo" src="${image}" alt="Objektbild">`).join("")}<p class="footer">Erstellt mit Domus</p></body></html>`;
}
export function exposeHtml(record) {
  const labels = {
    name: "Wohnung",
    street: "Straße",
    postalCode: "PLZ",
    city: "Ort",
    size: "Wohnfläche (m²)",
    rooms: "Zimmer",
    coldRent: "Kaltmiete (€)",
    nebenkosten: "Nebenkosten (€)",
    heating: "Heizung",
    energyRating: "Energieklasse",
    energyDemand: "Energiekennwert",
  };
  const facts = Object.entries(labels)
    .filter(([key]) => record.facts?.[key] != null && record.facts[key] !== "")
    .map(
      ([key, label]) =>
        `<tr><th>${label}</th><td>${escapeHtml(record.facts[key])}</td></tr>`,
    )
    .join("");
  return `<p>${escapeHtml(record.intro)}</p><h2>Eckdaten</h2><table>${facts}</table>${[
    ["features", "Ausstattung"],
    ["building", "Haus"],
    ["location", "Lage"],
    ["terms", "Konditionen"],
    ["contact", "Kontakt"],
  ]
    .map(([key, title]) => `<h2>${title}</h2><p>${escapeHtml(record[key])}</p>`)
    .join(
      "",
    )}${record.sources?.length ? `<h2>Quellen zur Lage</h2>${record.sources.map((source) => `<p class="source">${escapeHtml(source.title)} · ${escapeHtml(source.url)} · ${escapeHtml(source.accessedAt?.slice(0, 10))}</p>`).join("")}` : ""}`;
}
export function statementHtml(statement, row) {
  return `<p>${escapeHtml(row.name)}<br>${escapeHtml(row.unit)}<br>${escapeHtml(statement.building.street)}, ${escapeHtml(statement.building.postalCode)} ${escapeHtml(statement.building.city)}</p><p>Abrechnungszeitraum: ${escapeHtml(statement.start)} bis ${escapeHtml(statement.end)}<br>Nutzungszeitraum: ${escapeHtml(row.start)} bis ${escapeHtml(row.end)}</p><table><thead><tr><th>Kostenart / Beleg</th><th>Gesamtkosten</th><th>Verteilung</th><th>Ihr Anteil</th></tr></thead><tbody>${row.lines.map((line) => `<tr><td>${escapeHtml(line.name)}<br>${escapeHtml(line.category || "")}<br>${escapeHtml(line.start || "")} ${line.end ? "bis " + escapeHtml(line.end) : ""}<br>Beleg ${escapeHtml(statement.documents.find((doc) => doc.id === line.documentId)?.name || line.documentId)} · ${escapeHtml(line.page)}</td><td>${line.totalCents === undefined ? "Externe Einzelabrechnung" : money(line.totalCents)}${line.periodCents !== undefined ? `<br>Im Zeitraum: ${money(line.periodCents)}` : ""}</td><td>${line.allocation ? `${escapeHtml(ALLOCATION_KEYS[line.allocation])}<br>${line.numerator} / ${line.denominator}` : "Übernommene Einzelabrechnung"}</td><td>${money(line.cents)}</td></tr>`).join("")}</tbody></table><p>Summe der Kosten: <strong>${money(row.totalCents)}</strong><br>Tatsächliche Nebenkostenvorauszahlungen: <strong>${money(row.advanceCents)}</strong><br><strong>${row.balanceCents >= 0 ? "Nachzahlung" : "Guthaben"}: ${money(Math.abs(row.balanceCents))}</strong></p><h2>Berücksichtigte Vorauszahlungen</h2>${
    statement.advances
      .filter((advance) => advance.leaseId === row.leaseId)
      .map(
        (advance) =>
          `<p>${escapeHtml(advance.date)} · ${money(Math.round(Number(String(advance.amount).replace(",", ".")) * 100))} · ${escapeHtml(advance.reference)}</p>`,
      )
      .join("") ||
    "<p>Keine Vorauszahlungen erfasst; Vollständigkeit wurde bestätigt.</p>"
  }<p>Die Verteilung berücksichtigt bestätigte Nutzungszeiträume und die angegebenen Verteilerschlüssel. Belege und Berechnungsgrundlagen sind in Domus hinterlegt.</p>`;
}
export async function renderPdf(env, html) {
  if (!env.BROWSER)
    throw rentalError("Die PDF-Erstellung ist noch nicht eingerichtet.", 503);
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) =>
      /^(data:|about:)/.test(request.url())
        ? request.continue()
        : request.abort(),
    );
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: "load" });
    return Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate:
          '<div style="font:8px Arial;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      }),
    );
  } finally {
    await browser.close();
  }
}

// Streaming multipart ZIP: at most one file chunk plus two 5 MiB parts in memory.
export async function archiveToR2(bucket, key, entries) {
  const upload = await bucket.createMultipartUpload(key, {
    httpMetadata: { contentType: "application/zip" },
  });
  let pending = [],
    bytes = 0,
    chain = Promise.resolve();
  const parts = [];
  const flush = async () => {
    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const value of pending) {
      combined.set(value, offset);
      offset += value.length;
    }
    const length = Math.min(bytes, 5 * 1024 * 1024);
    pending = bytes > length ? [combined.slice(length)] : [];
    bytes -= length;
    parts.push(
      await upload.uploadPart(parts.length + 1, combined.subarray(0, length)),
    );
  };
  const zip = new Zip((error, data, final) => {
    if (error) {
      chain = chain.then(() => {
        throw error;
      });
      return;
    }
    chain = chain.then(async () => {
      pending.push(data);
      bytes += data.length;
      while (bytes >= 5 * 1024 * 1024) await flush();
      if (final && bytes) await flush();
    });
  });
  try {
    for await (const entry of entries) {
      const file = new ZipPassThrough(
        entry.name.replace(/[^\p{L}\p{N}._/-]/gu, "_").replace(/\.\./g, "_"),
      );
      zip.add(file);
      if (entry.text !== undefined) file.push(strToU8(entry.text), true);
      else {
        const reader = entry.body.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            file.push(value);
            await chain;
          }
        } finally {
          reader.releaseLock();
        }
        file.push(new Uint8Array(), true);
      }
      await chain;
    }
    zip.end();
    await chain;
    await upload.complete(parts);
  } catch (error) {
    zip.terminate();
    await upload.abort();
    throw error;
  }
}
export function csv(rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (value) =>
    `"${String(
      typeof value === "object" ? JSON.stringify(value) : (value ?? ""),
    )
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""')}"`;
  return [
    keys.map(cell).join(","),
    ...rows.map((row) => keys.map((key) => cell(row[key])).join(",")),
  ].join("\r\n");
}
