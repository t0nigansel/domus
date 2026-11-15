import { createHash } from "node:crypto";
import { withDatabase, withAccountTransaction } from "./database.js";
import { loadData, saveData } from "./store.js";
import {
  getRecord,
  recordList,
  putRecord,
  jobAction,
} from "./assistant-store.js";
import { decryptSecret, generate, simulationEnabled } from "./llm.js";
import { text, list } from "./assistant-domain.js";
import {
  documentParts,
  renderPdf,
  pdfHtml,
  exposeHtml,
  statementHtml,
  archiveToR2,
  csv,
} from "./assistant-documents.js";
import {
  calculateStatement,
  signedCents,
} from "../../src/domain/utilityStatements.js";
import { rentalError } from "../../src/domain/rentals.js";

const safeFacts = (property) =>
  Object.fromEntries(
    [
      "name",
      "street",
      "postalCode",
      "city",
      "floor",
      "size",
      "rooms",
      "coldRent",
      "nebenkosten",
      "equipment",
      "heating",
      "energyRating",
      "energyDemand",
      "modernizations",
      "condition",
      "pets",
    ]
      .filter((key) => property[key] !== undefined)
      .map((key) => [key, property[key]]),
  );
export async function runAssistant(env, params, step, renderer = renderPdf) {
  const { accountId, jobId } = params;
  const access = (action) =>
    withDatabase(env, (client) =>
      jobAction(client, accountId, jobId, (job) => action(client, job)),
    );
  // Workflow checkpoints contain only routing IDs, never pg.Result instances, documents or credentials.
  const perform = (name, action) =>
    step.do(
      name,
      {
        retries: {
          limit:
            name.startsWith("delete-") || name === "terminate-jobs" ? 5 : 0,
          delay: "10 seconds",
          backoff: "exponential",
        },
        timeout: "10 minutes",
      },
      async () => {
        const result = await action();
        return typeof result === "string" || Array.isArray(result)
          ? result
          : null;
      },
    );
  try {
    const kind = await perform("start", () =>
      access(async (client, job) => {
        await client.query(
          "UPDATE assistant_jobs SET status='running',updated_at=now() WHERE account_id=$1 AND id=$2 AND status='queued'",
          [accountId, jobId],
        );
        return job.kind;
      }),
    );
    if (kind === "delete") {
      await deleteAccount(env, params, perform);
      return;
    }
    if (["export", "statement-zip"].includes(kind)) {
      await perform("archive", async () => {
        const snapshot = await access(async (client, job) => ({
          job,
          data: await loadData(client, accountId),
          records: [
            ...(await recordList(client, accountId, "buildings")),
            ...(await recordList(client, accountId, "exposes")),
            ...(await recordList(client, accountId, "utility-statements")),
          ],
          settings:
            (
              await client.query(
                "SELECT data FROM user_settings WHERE account_id=$1 AND user_id=$2",
                [accountId, job.user_id],
              )
            ).rows[0]?.data || {},
          profile: (
            await client.query(
              'SELECT id,name,email,"createdAt" FROM "user" WHERE id=$1',
              [job.user_id],
            )
          ).rows[0],
          account: (
            await client.query("SELECT id,name FROM organization WHERE id=$1", [
              accountId,
            ])
          ).rows[0],
          audit: (
            await client.query(
              "SELECT id,user_id,action,entity,created_at FROM audit_log WHERE account_id=$1",
              [accountId],
            )
          ).rows,
          imports: (
            await client.query(
              "SELECT source_hash,manifest,created_at FROM domus_imports WHERE account_id=$1",
              [accountId],
            )
          ).rows,
        }));
        const key = `${accountId}/archives/${jobId}.zip`;
        async function* entries() {
          let docs = snapshot.data.documents;
          if (kind === "statement-zip") {
            const record = snapshot.records.find(
              (record) => record.id === snapshot.job.input.recordId,
            );
            if (!record || record.status !== "final")
              throw rentalError("Finalisierte Abrechnung nicht gefunden.");
            docs = docs.filter((doc) => record.pdfIds?.includes(doc.id));
          } else {
            const { documentFiles: _files, ...publicData } = snapshot.data;
            yield {
              name: "README.txt",
              text: "Domus Datenexport, Formatversion 1. data.json enthält alle Fachdaten, records.json Häuser und Entwürfe, settings.json persönliche Einstellungen. Dateien stehen unter files/<Dokument-ID>/<Dateiname>. API-Schlüssel, Passwort-Hashes und Sitzungen sind nicht enthalten. JSON-Zuordnungen verwenden die ursprünglichen IDs.",
            };
            yield {
              name: "data.json",
              text: JSON.stringify(publicData, null, 2),
            };
            yield {
              name: "records.json",
              text: JSON.stringify(snapshot.records, null, 2),
            };
            yield {
              name: "settings.json",
              text: JSON.stringify(snapshot.settings, null, 2),
            };
            yield { name: "costs.csv", text: csv(snapshot.data.costs) };
            yield {
              name: "profile.json",
              text: JSON.stringify(
                { user: snapshot.profile, account: snapshot.account },
                null,
                2,
              ),
            };
            yield {
              name: "audit.json",
              text: JSON.stringify(snapshot.audit, null, 2),
            };
            yield {
              name: "imports.json",
              text: JSON.stringify(snapshot.imports, null, 2),
            };
            yield {
              name: "payments.csv",
              text: csv(
                snapshot.records.flatMap((record) => record.advances || []),
              ),
            };
          }
          for (const doc of docs) {
            const file = snapshot.data.documentFiles[doc.id];
            if (!file) {
              if (doc.hasFile)
                throw rentalError(
                  "Eine Originaldatei fehlt. Der Export ist nicht vollständig.",
                );
              continue;
            }
            const object = await env.FILES.get(file.key);
            if (!object)
              throw rentalError(
                "Eine Originaldatei fehlt. Der Export wurde nicht als vollständig markiert.",
              );
            yield { name: `files/${doc.id}/${doc.name}`, body: object.body };
          }
        }
        await archiveToR2(env.FILES, key, entries());
        await access(async (client) =>
          client.query(
            "UPDATE assistant_jobs SET object_key=$3 WHERE account_id=$1 AND id=$2",
            [accountId, jobId, key],
          ),
        );
      });
    } else if (kind === "expose") {
      await perform("expose-draft", async () => {
        const state = await access(async (client, job) => {
          const record = await getRecord(
            client,
            accountId,
            "exposes",
            job.input.recordId,
          );
          const data = await loadData(client, accountId);
          const property = data.properties.find(
            (property) => property.id === record.propertyId,
          );
          if (!property) throw rentalError("Wohnung nicht gefunden.");
          const building = property.buildingId
            ? await getRecord(
                client,
                accountId,
                "buildings",
                property.buildingId,
              )
            : {};
          return {
            job,
            record,
            data,
            facts: safeFacts(property),
            building,
            connection: await connectionFor(client, accountId, job, env),
          };
        });
        let result,
          sources = [];
        if (state.job.input.simulated && simulationEnabled(env)) {
          result = {
            title: `Exposé · ${state.facts.name}`,
            intro:
              "SIMULATION: Dieser Entwurf demonstriert die Exposé-Erstellung mit den hinterlegten Objektdaten.",
            features: state.facts.equipment || "Ausstattung bitte ergänzen.",
            building:
              state.building.description || "Hausbeschreibung bitte ergänzen.",
            location:
              "SIMULATION: Es wurde keine Webrecherche durchgeführt. Lagebeschreibung bitte selbst ergänzen.",
            terms: `Kaltmiete: ${state.facts.coldRent ?? "offen"} EUR. Nebenkosten: ${state.facts.nebenkosten ?? "offen"} EUR. Verfügbar ab: ${state.record.availableFrom || "offen"}.`,
            warnings: [
              "Simulation: Lage und Objektangaben vor Verwendung selbst prüfen.",
            ],
          };
        } else {
          const research = await generate({
            ...state.connection,
            search: true,
            prompt: `Recherchiere belegbare öffentliche Informationen zu Infrastruktur, Nahversorgung und Verkehr in der Umgebung dieser Adresse. Keine privaten Bewohnerinformationen und keine geschätzten Entfernungen. Adresse: ${JSON.stringify({ street: state.facts.street || state.building.street, postalCode: state.facts.postalCode || state.building.postalCode, city: state.facts.city || state.building.city })}`,
          });
          if (!research.sources.length)
            throw rentalError(
              "Die Recherche hat keine überprüfbaren Quellen geliefert.",
            );
          sources = research.sources;
          const parts = [];
          for (const id of state.record.documentIds) {
            const file = state.data.documentFiles[id];
            if (
              file?.mime === "application/pdf" ||
              file?.mime.endsWith("wordprocessingml.document")
            ) {
              const object = await env.FILES.get(file.key);
              if (!object)
                throw rentalError("Eine ausgewählte Unterlage fehlt.");
              parts.push(
                ...(await documentParts(
                  file,
                  new Uint8Array(await object.arrayBuffer()),
                )),
              );
            }
          }
          if (parts.length > 5)
            throw rentalError(
              "Zu viele Unterlagen für einen Exposé-Entwurf. Bitte die Auswahl auf höchstens fünf Dokumentabschnitte begrenzen.",
            );
          result = await generate({
            ...state.connection,
            files: parts.filter((part) => part.base64),
            prompt: `Erstelle ein sachliches deutsches Vermietungsexposé. Liefere JSON mit String-Feldern title,intro,features,building,location,terms sowie warnings als String-Liste. Nutze ausschließlich die Objektfakten und belegte Recherche; widersprüchliche Angaben in warnings aufnehmen, keine personenbezogenen Mieterdaten. Fakten: ${JSON.stringify(state.facts)}. Haus: ${JSON.stringify(state.building)}. Verfügbarkeit: ${state.record.availableFrom}. Recherche: ${research.text}. Textunterlagen: ${parts
              .filter((part) => part.text)
              .map((part) => part.text)
              .join("\n")}`,
          });
        }
        const fields = Object.fromEntries(
          ["title", "intro", "features", "building", "location", "terms"].map(
            (key) => [key, text(result[key], 20000)],
          ),
        );
        const warnings = list(result.warnings || [], 50).map((warning) =>
          text(warning),
        );
        for (const key of ["size", "rooms", "coldRent", "nebenkosten"])
          if (
            state.facts[key] === undefined ||
            state.facts[key] === null ||
            state.facts[key] === ""
          )
            warnings.push(
              `Fehlende Objektangabe: ${{ size: "Wohnfläche", rooms: "Zimmer", coldRent: "Kaltmiete", nebenkosten: "Nebenkosten" }[key]}`,
            );
        await access(async (client, job) => {
          const current = await getRecord(
            client,
            accountId,
            "exposes",
            job.input.recordId,
          );
          if (current.revision !== state.record.revision)
            throw rentalError("Der Entwurf wurde inzwischen geändert.");
          await putRecord(
            client,
            accountId,
            "exposes",
            {
              ...current,
              ...fields,
              facts: state.facts,
              buildingSnapshot: state.building,
              warnings,
              sources,
              simulated: !!job.input.simulated,
              reviewed: false,
            },
            current,
          );
        });
      });
    } else if (kind === "analysis") {
      const ids = await perform("document-manifest", () =>
        access(async (client, job) => {
          const record = await getRecord(
            client,
            accountId,
            "utility-statements",
            job.input.recordId,
          );
          const ids = record.documents
            .filter((doc) => doc.status !== "excluded")
            .map((doc) => doc.id);
          if (ids.length > 100)
            throw rentalError(
              "Mehr als 100 Belege: Bitte zunächst nicht relevante Dokumente ausschließen.",
            );
          await client.query(
            "UPDATE assistant_jobs SET result=jsonb_build_object('processed',0,'total',$3::int) WHERE account_id=$1 AND id=$2",
            [accountId, jobId, ids.length],
          );
          return ids;
        }),
      );
      for (const documentId of ids)
        await perform(`document-${documentId}`, async () => {
          const state = await access(async (client, job) => ({
            job,
            record: await getRecord(
              client,
              accountId,
              "utility-statements",
              job.input.recordId,
            ),
            data: await loadData(client, accountId),
            connection: await connectionFor(client, accountId, job, env),
          }));
          const file = state.data.documentFiles[documentId];
          let suggestions = [],
            warning = "";
          if (state.job.input.simulated && simulationEnabled(env)) {
            warning =
              "SIMULATION: Keine echte Dokumentenanalyse durchgeführt. Beleg manuell prüfen.";
            suggestions = state.record.costCandidates
              .filter((cost) =>
                cost.attachments?.some(
                  (attachment) => attachment.id === documentId,
                ),
              )
              .map((cost) => ({
                name: cost.name,
                category: "",
                amount: String(cost.amount),
                start: cost.serviceStart || "",
                end: cost.serviceEnd || "",
                page: "Kostenverknüpfung; Original prüfen",
                reference: cost.id,
              }));
          } else {
            try {
              if (!file) throw rentalError("Originaldatei fehlt.");
              const object = await env.FILES.get(file.key);
              if (!object) throw rentalError("Originaldatei fehlt.");
              const parts = await documentParts(
                file,
                new Uint8Array(await object.arrayBuffer()),
              );
              for (const part of parts) {
                const result = await generate({
                  ...state.connection,
                  files: part.base64 ? [part] : [],
                  prompt: `Lies den Beleg als Daten aus. Liefere JSON {"items":[{"name":"","category":"","amount":"0.00","start":"YYYY-MM-DD oder leer","end":"YYYY-MM-DD oder leer","page":"Seite/Abschnitt","reference":"Rechnungsnummer + Positionsnummer"}],"warnings":["..."]}. Beträge als Dezimalstrings, Gutschriften negativ. Keine Gesamt- und Einzelpositionen doppelt übernehmen. Verwaltung, Reparaturen, Rücklagen und Eigentümerkosten ausdrücklich kennzeichnen; keine rechtliche Freigabe vornehmen. Heizkostenabrechnungen nur als Hinweise behandeln, keine Neuverteilung berechnen. Jede Position muss eine Fundstelle haben. Seitenoffset ${part.pageOffset}; Fundstellen auf die Originalseiten beziehen. Text: ${part.text || ""}`,
                });
                for (const item of list(result.items || [])) {
                  signedCents(item.amount);
                  suggestions.push({
                    name: text(item.name),
                    category: text(item.category || ""),
                    amount: String(item.amount),
                    start: text(item.start || "", 10),
                    end: text(item.end || "", 10),
                    page: text(item.page || ""),
                    reference: text(item.reference || ""),
                  });
                }
                warning += list(result.warnings || [], 50)
                  .map((value) => text(value))
                  .join("\n");
              }
            } catch (error) {
              warning =
                error.status && error.status < 500
                  ? error.message
                  : "Dokument konnte nicht automatisch ausgewertet werden. Bitte manuell prüfen.";
              suggestions = [];
            }
          }
          await access(async (client, job) => {
            const current = await getRecord(
              client,
              accountId,
              "utility-statements",
              job.input.recordId,
            );
            const source = current.documents.find(
              (doc) => doc.id === documentId,
            );
            source.warning = warning;
            source.status = "pending";
            // Re-analysis replaces unreviewed AI proposals, never manual or confirmed costs.
            const items = current.items.filter(
              (item) =>
                !item.analysisJob ||
                item.documentId !== documentId ||
                item.confirmed,
            );
            suggestions
              .filter(
                (proposal) =>
                  !items.some(
                    (item) =>
                      item.documentId === documentId &&
                      item.reference &&
                      item.reference === proposal.reference,
                  ),
              )
              .forEach((item, index) =>
                items.push({
                  ...item,
                  id: `${jobId}:${documentId}:${index}`,
                  documentId,
                  allocation: "area",
                  contractBasis: "",
                  confirmed: false,
                  analysisJob: jobId,
                  weights: {},
                }),
              );
            await putRecord(
              client,
              accountId,
              "utility-statements",
              {
                ...current,
                items,
                simulated: !!job.input.simulated,
                houseConfirmed: false,
              },
              current,
            );
            await client.query(
              "UPDATE assistant_jobs SET result=result||jsonb_build_object('processed',COALESCE((result->>'processed')::int,0)+1) WHERE account_id=$1 AND id=$2",
              [accountId, jobId],
            );
          });
        });
    } else if (["pdf", "statement-pdfs"].includes(kind)) {
      const targets = await perform("pdf-manifest", () =>
        access(async (client, job) => {
          const record = await getRecord(
            client,
            accountId,
            kind === "pdf" ? "exposes" : "utility-statements",
            job.input.recordId,
          );
          if (kind === "pdf") return ["expose"];
          const calculation = calculateStatement(record);
          if (calculation.issues.length)
            throw rentalError(calculation.issues.join("\n"));
          return calculation.rows
            .filter((row) => !row.owner)
            .map((row) => row.periodId);
        }),
      );
      await perform("pdf-progress", () =>
        access(async (client) => {
          await client.query(
            "UPDATE assistant_jobs SET result=jsonb_build_object('processed',0,'total',$3::int) WHERE account_id=$1 AND id=$2",
            [accountId, jobId, targets.length],
          );
        }),
      );
      for (const target of targets)
        await perform(`pdf-${target}`, async () => {
          const state = await access(async (client, job) => ({
            job,
            record: await getRecord(
              client,
              accountId,
              kind === "pdf" ? "exposes" : "utility-statements",
              job.input.recordId,
            ),
            data: await loadData(client, accountId),
            settings:
              (
                await client.query(
                  "SELECT data FROM user_settings WHERE account_id=$1 AND user_id=$2",
                  [accountId, job.user_id],
                )
              ).rows[0]?.data || {},
          }));
          if (!state.settings.sender?.name || !state.settings.sender?.address)
            throw rentalError(
              "Bitte zuerst Absendername und Anschrift unter Einstellungen vervollständigen.",
            );
          const image = async (id) => {
            const file = state.data.documentFiles[id];
            if (!file || !file.mime.startsWith("image/")) return null;
            const object = await env.FILES.get(file.key);
            if (!object || file.bytes > 5 * 1024 * 1024)
              throw rentalError(
                "Bild fehlt oder ist größer als 5 MB. Bitte eine kleinere Bilddatei auswählen.",
              );
            return `data:${file.mime};base64,${Buffer.from(await object.arrayBuffer()).toString("base64")}`;
          };
          const images = [];
          for (const id of kind === "pdf" ? state.record.documentIds : []) {
            const value = await image(id);
            if (value) images.push(value);
          }
          const row =
            kind === "pdf"
              ? null
              : calculateStatement(state.record).rows.find(
                  (row) => row.periodId === target,
                );
          const title =
            kind === "pdf"
              ? state.record.title
              : `Nebenkostenabrechnung ${state.record.start.slice(0, 4)}`;
          const html = pdfHtml({
            title,
            sender: state.settings.sender,
            content:
              kind === "pdf"
                ? exposeHtml(state.record)
                : statementHtml(state.record, row),
            simulated: state.record.simulated,
            images,
            logo: state.settings.sender.logoId
              ? await image(state.settings.sender.logoId)
              : null,
          });
          const buffer = await renderer(env, html);
          const documentId = `${jobId}-${target}`;
          const key = `${accountId}/generated/${documentId}.pdf`;
          await env.FILES.put(key, buffer, {
            httpMetadata: { contentType: "application/pdf" },
          });
          await access(async (client, job) => {
            const data = await loadData(client, accountId),
              before = structuredClone(data);
            if (!data.documents.some((doc) => doc.id === documentId)) {
              if (
                Object.values(data.documentFiles).reduce(
                  (sum, file) => sum + file.bytes,
                  0,
                ) +
                  buffer.length >
                1024 ** 3
              )
                throw rentalError("Speicherkontingent erreicht.");
              data.documents.push({
                id: documentId,
                name: `${title}${row ? " " + row.unit + " " + row.name : ""}.pdf`
                  .replace(/[\\/]/g, "-")
                  .slice(0, 235),
                type: "pdf",
                category: kind === "pdf" ? "Exposes" : "Statements",
                propertyId: state.record.propertyId || row?.unitId || null,
                buildingId: state.record.buildingId,
                hasFile: true,
                date: new Date().toISOString().slice(0, 10),
                bytes: buffer.length,
                size: `${(buffer.length / 1024).toFixed(1)} KB`,
                version: 1,
                generatedBy: job.input.recordId,
              });
              data.documentFiles[documentId] = {
                key,
                mime: "application/pdf",
                bytes: buffer.length,
                hash: createHash("sha256").update(buffer).digest("hex"),
                name: data.documents.at(-1).name,
              };
              await saveData(client, accountId, before, data);
            }
            const current = await getRecord(
              client,
              accountId,
              kind === "pdf" ? "exposes" : "utility-statements",
              job.input.recordId,
            );
            const pdfIds = [
              ...new Set([...(current.pdfIds || []), documentId]),
            ];
            await putRecord(
              client,
              accountId,
              kind === "pdf" ? "exposes" : "utility-statements",
              { ...current, pdfIds },
              current,
            );
            await client.query(
              "UPDATE assistant_jobs SET result=result||jsonb_build_object('processed',COALESCE((result->>'processed')::int,0)+1) WHERE account_id=$1 AND id=$2",
              [accountId, jobId],
            );
          });
        });
      await perform("finalize", () =>
        access(async (client, job) => {
          const recordKind = kind === "pdf" ? "exposes" : "utility-statements";
          const current = await getRecord(
            client,
            accountId,
            recordKind,
            job.input.recordId,
          );
          await putRecord(
            client,
            accountId,
            recordKind,
            {
              ...current,
              status: "final",
              finalizedAt: new Date().toISOString(),
              ...(kind === "statement-pdfs"
                ? { result: calculateStatement(current) }
                : {}),
            },
            current,
          );
        }),
      );
    }
    await perform("complete", () =>
      access(async (client) =>
        client.query(
          "UPDATE assistant_jobs SET status='completed',updated_at=now(),result=result || '{\"ready\":true}'::jsonb WHERE account_id=$1 AND id=$2",
          [accountId, jobId],
        ),
      ),
    );
  } catch (error) {
    await cleanupFailedPdfs(env, accountId, jobId).catch(() => {});
    await withDatabase(env, (client) =>
      withAccountTransaction(client, accountId, () =>
        client.query(
          "UPDATE assistant_jobs SET status='failed',error=$3,updated_at=now() WHERE account_id=$1 AND id=$2 AND status<>'cancelled'",
          [
            accountId,
            jobId,
            error.status && error.status < 500
              ? error.message
              : "Die Verarbeitung ist fehlgeschlagen. Bitte Verbindung und Unterlagen prüfen und erneut versuchen.",
          ],
        ),
      ),
    ).catch(() => {});
    throw error;
  }
}
async function cleanupFailedPdfs(env, accountId, jobId) {
  const keys = await withDatabase(env, (client) =>
    withAccountTransaction(client, accountId, async () => {
      const account = (
        await client.query(
          "SELECT deleting FROM domus_accounts WHERE id=$1 FOR UPDATE",
          [accountId],
        )
      ).rows[0];
      if (!account || account.deleting) return [];
      const job = (
        await client.query(
          "SELECT kind,input FROM assistant_jobs WHERE account_id=$1 AND id=$2",
          [accountId, jobId],
        )
      ).rows[0];
      if (!job || !["pdf", "statement-pdfs"].includes(job.kind)) return [];
      const kind = job.kind === "pdf" ? "exposes" : "utility-statements";
      const record = await getRecord(
        client,
        accountId,
        kind,
        job.input.recordId,
      );
      if (record.status === "final") return [];
      const data = await loadData(client, accountId),
        before = structuredClone(data);
      const ids = new Set(
        (record.pdfIds || []).filter((id) => id.startsWith(`${jobId}-`)),
      );
      const keys = [...ids]
        .map((id) => data.documentFiles[id]?.key)
        .filter(Boolean);
      data.documents = data.documents.filter((doc) => !ids.has(doc.id));
      for (const id of ids) delete data.documentFiles[id];
      await saveData(client, accountId, before, data);
      if (ids.size)
        await putRecord(
          client,
          accountId,
          kind,
          {
            ...record,
            pdfIds: (record.pdfIds || []).filter((id) => !ids.has(id)),
          },
          record,
        );
      return keys;
    }),
  );
  if (keys.length) await env.FILES.delete(keys);
}
async function connectionFor(client, accountId, job, env) {
  if (job.input.simulated && simulationEnabled(env)) return {};
  const row = (
    await client.query(
      "SELECT secret,model FROM llm_connections WHERE account_id=$1 AND user_id=$2 AND provider=$3 AND tested",
      [accountId, job.user_id, job.input.provider],
    )
  ).rows[0];
  if (!row || row.model !== job.input.model)
    throw rentalError(
      "Die persönliche LLM-Verbindung wurde entfernt oder geändert.",
    );
  return {
    provider: job.input.provider,
    model: row.model,
    key: decryptSecret(
      row.secret,
      `${accountId}:${job.user_id}:${job.input.provider}`,
      env,
    ),
  };
}
async function deleteAccount(env, { accountId, jobId }, perform) {
  await perform("terminate-jobs", async () => {
    const jobs = await withDatabase(env, (client) =>
      withAccountTransaction(
        client,
        accountId,
        async () =>
          (
            await client.query(
              "SELECT id,status FROM assistant_jobs WHERE account_id=$1 AND id<>$2",
              [accountId, jobId],
            )
          ).rows,
      ),
    );
    for (const job of jobs) {
      if (["completed", "failed"].includes(job.status)) continue;
      const instance = await env.ASSISTANT_WORKFLOW.get(job.id);
      const state = await instance.status();
      if (!["complete", "errored", "terminated"].includes(state.status))
        await instance.terminate();
    }
  });
  await perform("delete-files", async () => {
    while (true) {
      const objects = await env.FILES.list({
        prefix: `${accountId}/`,
        limit: 500,
      });
      if (!objects.objects.length) break;
      await env.FILES.delete(objects.objects.map((object) => object.key));
    }
  });
  await perform("delete-database", () =>
    withDatabase(env, (client) =>
      withAccountTransaction(client, accountId, async () => {
        const owner = (
          await client.query(
            "SELECT owner_user_id FROM domus_accounts WHERE id=$1 AND deleting FOR UPDATE",
            [accountId],
          )
        ).rows[0];
        if (!owner) return;
        const user = (
          await client.query('SELECT email FROM "user" WHERE id=$1', [
            owner.owner_user_id,
          ])
        ).rows[0];
        for (const table of [
          "cost_links",
          "rental_viewings",
          "rental_applications",
          "lease_parties",
          "leases",
          "rentals",
          "issues",
          "document_files",
          "documents",
          "costs",
          "tenants",
          "properties",
          "contacts",
          "audit_log",
          "domus_imports",
          "llm_connections",
          "user_settings",
          "assistant_records",
          "assistant_jobs",
        ])
          await client.query(`DELETE FROM ${table} WHERE account_id=$1`, [
            accountId,
          ]);
        await client.query("DELETE FROM domus_accounts WHERE id=$1", [
          accountId,
        ]);
        await client.query('DELETE FROM invitation WHERE "organizationId"=$1', [
          accountId,
        ]);
        await client.query('DELETE FROM member WHERE "organizationId"=$1', [
          accountId,
        ]);
        await client.query("DELETE FROM organization WHERE id=$1", [accountId]);
        await client.query('DELETE FROM session WHERE "userId"=$1', [
          owner.owner_user_id,
        ]);
        await client.query('DELETE FROM account WHERE "userId"=$1', [
          owner.owner_user_id,
        ]);
        await client.query(
          "DELETE FROM verification WHERE identifier IN ($1,$2) OR value=$1",
          [owner.owner_user_id, user?.email || ""],
        );
        await client.query('DELETE FROM "user" WHERE id=$1', [
          owner.owner_user_id,
        ]);
      }),
    ),
  );
}
