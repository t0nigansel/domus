import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";

export async function assistantIntegration({
  call,
  post,
  a,
  b,
  property,
  check,
}) {
  const put = (path, body, cookie = a.cookie) =>
    call(path, { method: "PUT", body, cookie });
  const get = async (path) => (await call(path, { cookie: a.cookie })).json();
  const building = await (
    await post(
      "/api/buildings",
      {
        name: "Synthetic House",
        street: "Teststrasse 1",
        postalCode: "10115",
        city: "Berlin",
      },
      a.cookie,
    )
  ).json();
  assert.ok(building.id);
  check(
    (await call(`/api/buildings/${building.id}`, { cookie: b.cookie })).status,
    404,
    "house isolation",
  );
  check(
    (await put(`/api/properties/${property.id}`, { buildingId: building.id }))
      .status,
    200,
    "explicit apartment assignment",
  );
  check(
    (
      await post(
        "/api/properties",
        { name: "Foreign building", buildingId: building.id },
        b.cookie,
      )
    ).status,
    404,
    "foreign building relation",
  );
  const settings = {
    appearance: "dark",
    language: "de",
    provider: "openai",
    sender: {
      name: "Synthetic Landlord",
      address: "Teststrasse 1\n10115 Berlin",
    },
  };
  check(
    (await put("/api/settings", settings)).status,
    200,
    "save sender and preferences",
  );
  check(
    (await get("/api/settings")).sender.name,
    "Synthetic Landlord",
    "settings read",
  );
  check(
    (await (await call("/api/settings", { cookie: b.cookie })).json()).sender,
    {},
    "personal settings isolation",
  );
  check(
    (
      await put("/api/llm-connections/openai", {
        key: "fake-integration-key",
        model: "test-model",
      })
    ).status,
    200,
    "encrypted personal connection",
  );
  check(
    (await post("/api/llm-connections/openai/test", {}, a.cookie)).status,
    200,
    "simulated capability test",
  );
  check(
    (await get("/api/llm-connections"))[0].tested,
    true,
    "capability status",
  );
  check(
    JSON.stringify(await get("/api/llm-connections")).includes(
      "fake-integration-key",
    ),
    false,
    "secret never returned",
  );
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText("Synthetic insurance invoice 120.00 EUR");
  const form = new FormData();
  form.append(
    "file",
    new Blob([await pdf.save()], { type: "application/pdf" }),
    "insurance.pdf",
  );
  form.append("buildingId", building.id);
  form.append("category", "Invoices");
  const upload = await call("/api/files/upload", {
    method: "POST",
    form,
    cookie: a.cookie,
  });
  check(upload.status, 201, "house document upload");
  const invoice = (await upload.json()).document;
  const draft = await (
    await post(
      "/api/exposes",
      { propertyId: property.id, documentIds: [] },
      a.cookie,
    )
  ).json();
  check(
    (
      await post(
        `/api/exposes/${draft.id}/generate`,
        { requestKey: randomUUID() },
        a.cookie,
      )
    ).status,
    400,
    "provider consent required",
  );
  const requestKey = randomUUID();
  const job = await (
    await post(
      `/api/exposes/${draft.id}/generate`,
      { requestKey, consent: true },
      a.cookie,
    )
  ).json();
  assert.ok(job.id, JSON.stringify(job));
  check(
    (
      await (
        await post(
          `/api/exposes/${draft.id}/generate`,
          { requestKey, consent: true },
          a.cookie,
        )
      ).json()
    ).id,
    job.id,
    "idempotent enqueue",
  );
  check(
    (await call(`/api/jobs/${job.id}`, { cookie: b.cookie })).status,
    404,
    "job isolation",
  );
  await waitJob(job.id, get);
  const generated = await get(`/api/exposes/${draft.id}`);
  check(generated.simulated, true, "simulation provenance retained");
  check(
    generated.intro.includes("SIMULATION"),
    true,
    "simulation visibly identified",
  );
  check(
    (await put(`/api/exposes/${draft.id}`, { ...generated, revision: 0 }))
      .status,
    409,
    "stale draft rejected",
  );
  const statement = await (
    await post(
      "/api/utility-statements",
      { buildingId: building.id, start: "2027-01-01", end: "2027-12-31" },
      a.cookie,
    )
  ).json();
  assert.ok(statement.id, JSON.stringify(statement));
  const analysis = await (
    await post(
      `/api/utility-statements/${statement.id}/analyze`,
      { requestKey: randomUUID(), consent: true },
      a.cookie,
    )
  ).json();
  await waitJob(analysis.id, get);
  const analyzed = await get(`/api/utility-statements/${statement.id}`);
  check(
    analyzed.documents.some(
      (doc) => doc.id === invoice.id && doc.warning.includes("SIMULATION"),
    ),
    true,
    "simulated document analysis requires manual review",
  );
  const input = {
    ...analyzed,
    houseConfirmed: true,
    advancesConfirmed: true,
    heatingConfirmed: true,
    units: analyzed.units.map((unit) => ({
      ...unit,
      area: 50,
      confirmed: true,
      periods: unit.periods.map((period) => ({ ...period, confirmed: true })),
    })),
    documents: analyzed.documents.map((doc) => ({
      ...doc,
      status: doc.id === invoice.id ? "checked" : "excluded",
      reason: doc.id === invoice.id ? "" : "Not a cost invoice",
    })),
    items: [
      {
        name: "Insurance",
        category: "Insurance",
        amount: "120.00",
        start: "2027-01-01",
        end: "2027-12-31",
        documentId: invoice.id,
        page: "1",
        reference: "I-1",
        contractBasis: "Lease clause 3",
        allocation: "area",
        confirmed: true,
      },
    ],
  };
  check(
    (await put(`/api/utility-statements/${statement.id}`, input)).status,
    200,
    "review statement",
  );
  const calculation = await (
    await post(
      `/api/utility-statements/${statement.id}/calculate`,
      {},
      a.cookie,
    )
  ).json();
  check(calculation.issues, [], "all review gates satisfied");
  check(calculation.rows[0].balanceCents, 12000, "deterministic balance");
  check(
    (
      await put(`/api/exposes/${draft.id}`, {
        ...generated,
        reviewed: true,
        resolvedWarnings: true,
        contact: "Synthetic Landlord",
      })
    ).status,
    200,
    "approve expose draft",
  );
  const exposePdf = await (
    await post(
      `/api/exposes/${draft.id}/finalize`,
      { requestKey: randomUUID() },
      a.cookie,
    )
  ).json();
  await waitJob(exposePdf.id, get);
  const finalExpose = await get(`/api/exposes/${draft.id}`);
  check(finalExpose.status, "final", "expose PDF finalized");
  check(finalExpose.pdfIds.length, 1, "one PDF for expose");
  const exposeDownload = await call(
    `/api/files/${finalExpose.pdfIds[0]}/content`,
    { cookie: a.cookie },
  );
  check(
    (await exposeDownload.text()).startsWith("%PDF-"),
    true,
    "real Chromium expose PDF stored privately",
  );
  check(
    (await put(`/api/exposes/${draft.id}`, finalExpose)).status,
    409,
    "final expose is immutable",
  );
  check(
    (
      await post(
        "/api/exposes",
        { ...finalExpose, copyOf: finalExpose.id },
        a.cookie,
      )
    ).status,
    201,
    "new expose version can be created",
  );
  const statementPdf = await (
    await post(
      `/api/utility-statements/${statement.id}/finalize`,
      { requestKey: randomUUID() },
      a.cookie,
    )
  ).json();
  await waitJob(statementPdf.id, get);
  const finalStatement = await get(`/api/utility-statements/${statement.id}`);
  check(finalStatement.status, "final", "statement finalized");
  check(finalStatement.pdfIds.length, 1, "one PDF per tenancy");
  check(
    (
      await call(`/api/documents/${invoice.id}`, {
        method: "DELETE",
        cookie: a.cookie,
      })
    ).status,
    409,
    "final statement retains source documents",
  );
  const statementZip = await (
    await post(
      `/api/utility-statements/${statement.id}/zip`,
      { requestKey: randomUUID() },
      a.cookie,
    )
  ).json();
  await waitJob(statementZip.id, get);
  check(
    (await call(`/api/jobs/${statementZip.id}/download`, { cookie: a.cookie }))
      .status,
    200,
    "statement PDF archive ready",
  );
  const archive = await (
    await post("/api/account/export", { requestKey: randomUUID() }, a.cookie)
  ).json();
  await waitJob(archive.id, get);
  const download = await call(`/api/jobs/${archive.id}/download`, {
    cookie: a.cookie,
  });
  check(download.status, 200, "account export download");
  const entries = unzipSync(new Uint8Array(await download.arrayBuffer()));
  const data = JSON.parse(strFromU8(entries["data.json"]));
  check(
    data.properties.some((row) => row.id === property.id),
    true,
    "export contains apartment",
  );
  check(
    Object.keys(entries).some((name) => name.endsWith("/insurance.pdf")),
    true,
    "export contains original house document",
  );
  check(
    Object.keys(entries).some((name) =>
      /secret|connection|password/.test(name),
    ),
    false,
    "export excludes credentials",
  );
  check(
    (await call(`/api/jobs/${archive.id}/download`, { cookie: b.cookie }))
      .status,
    404,
    "archive isolation",
  );
  return { building, statement };
}
async function waitJob(id, get) {
  assert.ok(id, "Job ID required");
  for (let attempt = 0; attempt < 90; attempt++) {
    const job = await get(`/api/jobs/${id}`);
    if (job.status === "completed") return job;
    if (job.status === "failed" || job.status === "cancelled")
      throw new Error(`Test job failed: ${job.error || job.status}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Test job did not complete within 45 seconds.");
}
