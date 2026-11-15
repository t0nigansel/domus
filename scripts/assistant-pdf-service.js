import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

// Isolated integration renderer. Production always uses its Cloudflare Browser binding.
export async function startPdfTestService() {
  const browser = await chromium.launch({ headless: true }),
    token = randomUUID();
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.headers.authorization !== token) {
      response.writeHead(403);
      response.end();
      return;
    }
    let page;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 50 * 1024 * 1024) throw new Error("Test HTML too large");
        chunks.push(chunk);
      }
      page = await browser.newPage();
      await page.route("**/*", (route) =>
        route.request().url().startsWith("data:")
          ? route.continue()
          : route.abort(),
      );
      await page.setContent(Buffer.concat(chunks).toString("utf8"), {
        waitUntil: "load",
      });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      response.writeHead(200, { "Content-Type": "application/pdf" });
      response.end(pdf);
    } catch {
      response.writeHead(500);
      response.end("Test rendering failed");
    } finally {
      await page?.close();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    token,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await browser.close();
    },
  };
}
