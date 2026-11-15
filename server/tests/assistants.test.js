import { describe, it, expect, vi, afterEach } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  simulationEnabled,
  generate,
} from "../cloud/llm.js";
import {
  settingsInput,
  exposeInput,
  statementInput,
} from "../cloud/assistant-domain.js";
import {
  archiveToR2,
  escapeHtml,
  documentParts,
  csv,
  pdfHtml,
} from "../cloud/assistant-documents.js";
import { unzipSync, strFromU8 } from "fflate";
import { PDFDocument } from "pdf-lib";

afterEach(() => vi.unstubAllGlobals());
describe("Assistant security and document handling", () => {
  const env = { LLM_ENCRYPTION_KEY_V1: Buffer.alloc(32, 3).toString("base64") };
  it("encrypts user secrets with authenticated ownership and never enables simulation in production or preview", () => {
    const secret = encryptSecret("fake-test-token", "account:user:openai", env);
    expect(JSON.stringify(secret)).not.toContain("fake-test-token");
    expect(decryptSecret(secret, "account:user:openai", env)).toBe(
      "fake-test-token",
    );
    expect(() => decryptSecret(secret, "other:user:openai", env)).toThrow();
    expect(
      simulationEnabled({ DOMUS_ENV: "production", LLM_SIMULATION: "true" }),
    ).toBe(false);
    expect(
      simulationEnabled({ DOMUS_ENV: "preview", LLM_SIMULATION: "true" }),
    ).toBe(false);
    expect(
      simulationEnabled({ DOMUS_ENV: "test", LLM_SIMULATION: "true" }),
    ).toBe(true);
  });
  it("validates settings and prevents selecting private or foreign apartment media", () => {
    expect(() =>
      settingsInput({ appearance: "evil", language: "de" }),
    ).toThrow();
    const data = {
      properties: [{ id: "p1" }],
      documents: [
        {
          id: "d1",
          propertyId: "p1",
          category: "Photos",
          hasFile: true,
          published: false,
        },
      ],
    };
    expect(() =>
      exposeInput({ propertyId: "p1", documentIds: ["d1"] }, null, data),
    ).toThrow(/freigegebene/);
    data.documents[0].published = true;
    expect(
      exposeInput(
        { propertyId: "p1", documentIds: ["d1"], status: "final" },
        null,
        data,
      ).status,
    ).toBe("draft");
  });
  it("splits PDFs into bounded page ranges and reports unsupported documents", async () => {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 21; i++) pdf.addPage();
    const parts = await documentParts(
      { name: "large.pdf", mime: "application/pdf" },
      await pdf.save(),
    );
    expect(parts.map((part) => part.pageOffset)).toEqual([0, 20]);
    await expect(
      documentParts(
        { name: "old.doc", mime: "application/msword" },
        new Uint8Array(),
      ),
    ).rejects.toThrow(/als PDF/);
  });
  it("writes a complete streaming archive and escapes untrusted HTML and spreadsheet formulas", async () => {
    const parts = [];
    const upload = {
      uploadPart: async (number, data) => {
        parts.push(new Uint8Array(data));
        return { partNumber: number, etag: String(number) };
      },
      complete: vi.fn(),
      abort: vi.fn(),
    };
    const bucket = { createMultipartUpload: async () => upload };
    async function* entries() {
      yield { name: "data.json", text: '{"ok":true}' };
      yield {
        name: "files/test.txt",
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("original"));
            controller.close();
          },
        }),
      };
      yield {
        name: "files/large.bin",
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(11 * 1024 * 1024));
            controller.close();
          },
        }),
      };
    }
    await archiveToR2(bucket, "archive.zip", entries());
    const zip = Buffer.concat(parts.map((part) => Buffer.from(part)));
    const decoded = unzipSync(zip);
    expect(strFromU8(decoded["data.json"])).toBe('{"ok":true}');
    expect(strFromU8(decoded["files/test.txt"])).toBe("original");
    expect(upload.complete).toHaveBeenCalledOnce();
    expect(upload.abort).not.toHaveBeenCalled();
    expect(
      parts.slice(0, -1).every((part) => part.length === 5 * 1024 * 1024),
    ).toBe(true);
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(csv([{ name: '=HYPERLINK("bad")' }])).toContain("'=HYPERLINK");
    expect(
      pdfHtml({ title: "<evil>", sender: {}, content: "", simulated: true }),
    ).toContain("SIMULATION");
  });
  it("does not expose provider errors or secrets, and rejects malformed model output", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("fake-secret-provider-diagnostic", { status: 401 }),
        ),
    );
    await expect(
      generate({
        provider: "openai",
        model: "gpt-4.1",
        key: "never-print",
        prompt: "test",
      }),
    ).rejects.toThrow("API-Schlüssel oder Modellzugriff prüfen.");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          output: [{ content: [{ type: "output_text", text: "broken-json" }] }],
        }),
      ),
    );
    await expect(
      generate({
        provider: "openai",
        model: "gpt-4.1",
        key: "never-print",
        prompt: "test",
      }),
    ).rejects.toThrow(/unvollständig/);
  });
  it("does not allow draft edits to change the tenancy snapshot or accept foreign evidence", () => {
    const previous = {
      units: [
        {
          id: "p1",
          area: 50,
          periods: [
            { id: "l1", leaseId: "l1", start: "2024-01-01", end: "2024-12-31" },
          ],
        },
      ],
      documents: [{ id: "d1", status: "pending" }],
    };
    const value = statementInput(
      {
        units: [
          {
            id: "p1",
            area: 60,
            periods: [{ id: "l1", start: "1900-01-01", confirmed: true }],
          },
        ],
      },
      previous,
      { documents: [] },
    );
    expect(value.units[0].periods[0].start).toBe("2024-01-01");
    expect(() =>
      statementInput(
        {
          items: [
            {
              name: "cost",
              amount: "1.00",
              allocation: "area",
              documentId: "foreign",
            },
          ],
        },
        previous,
        { documents: [] },
      ),
    ).toThrow(/Beleg/);
  });
});
