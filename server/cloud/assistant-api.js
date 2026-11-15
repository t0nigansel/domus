import { randomUUID } from "node:crypto";
import { withAccountTransaction } from "./database.js";
import { loadData } from "./store.js";
import { recordList, getRecord, putRecord } from "./assistant-store.js";
import {
  buildingInput,
  settingsInput,
  exposeInput,
  newStatement,
  statementInput,
  text,
} from "./assistant-domain.js";
import { calculateStatement } from "../../src/domain/utilityStatements.js";
import { rentalError } from "../../src/domain/rentals.js";
import { readJson } from "./files.js";
import {
  encryptSecret,
  decryptSecret,
  listModels,
  generate,
  simulationEnabled,
  PROVIDERS,
} from "./llm.js";

const json = (value, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const resources = [
  "settings",
  "llm-connections",
  "buildings",
  "exposes",
  "utility-statements",
  "jobs",
  "account",
];
export async function assistantRequest(
  request,
  env,
  client,
  user,
  account,
  auth,
) {
  const [resource, id, action] = new URL(request.url).pathname
    .split("/")
    .filter(Boolean)
    .slice(1);
  if (!resources.includes(resource)) return null;
  const method = request.method;
  const input = ["POST", "PUT", "PATCH"].includes(method)
    ? await readJson(request)
    : {};
  const tx = (callback) =>
    withAccountTransaction(client, account.id, async () => {
      const row = (
        await client.query(
          "SELECT deleting FROM domus_accounts WHERE id=$1 FOR UPDATE",
          [account.id],
        )
      ).rows[0];
      if (!row || (row.deleting && resource !== "jobs"))
        throw rentalError("Dieses Konto wird gelöscht.", 410);
      const member = (
        await client.query(
          'SELECT role FROM member WHERE "organizationId"=$1 AND "userId"=$2',
          [account.id, user.id],
        )
      ).rows[0];
      if (!member) throw rentalError("Kein Zugriff.", 403);
      return callback();
    });
  if (resource === "settings")
    return tx(async () => {
      if (method === "GET") {
        const row = (
          await client.query(
            "SELECT data FROM user_settings WHERE account_id=$1 AND user_id=$2",
            [account.id, user.id],
          )
        ).rows[0];
        return json({
          appearance: "system",
          language: "de",
          provider: "",
          sender: {},
          ...row?.data,
          stored: !!row,
          simulation: simulationEnabled(env),
        });
      }
      if (method === "PUT") {
        const value = settingsInput(input);
        if (value.sender.logoId) {
          const data = await loadData(client, account.id);
          if (
            !data.documents.some(
              (doc) =>
                doc.id === value.sender.logoId &&
                doc.type === "image" &&
                doc.hasFile,
            )
          )
            throw rentalError("Logo nicht gefunden.");
        }
        await client.query(
          "INSERT INTO user_settings(account_id,user_id,data) VALUES($1,$2,$3) ON CONFLICT(account_id,user_id) DO UPDATE SET data=EXCLUDED.data",
          [account.id, user.id, JSON.stringify(value)],
        );
        return json(value);
      }
      throw rentalError("Funktion nicht gefunden.", 404);
    });
  if (resource === "llm-connections") {
    if (method === "GET")
      return tx(async () =>
        json(
          (
            await client.query(
              "SELECT provider,model,tested FROM llm_connections WHERE account_id=$1 AND user_id=$2 ORDER BY provider",
              [account.id, user.id],
            )
          ).rows,
        ),
      );
    if (!Object.hasOwn(PROVIDERS, id))
      throw rentalError("Unbekannter Anbieter.");
    if (method === "DELETE")
      return tx(async () => {
        await client.query(
          "DELETE FROM llm_connections WHERE account_id=$1 AND user_id=$2 AND provider=$3",
          [account.id, user.id, id],
        );
        return json({ success: true });
      });
    if (method === "PUT")
      return tx(async () => {
        const secret = encryptSecret(
          text(input.key, 2000),
          `${account.id}:${user.id}:${id}`,
          env,
        );
        if (!input.key.trim() || !/^[\w.:-]{1,150}$/.test(input.model))
          throw rentalError("Schlüssel und Modell angeben.");
        await client.query(
          "INSERT INTO llm_connections(account_id,user_id,provider,model,secret) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,user_id,provider) DO UPDATE SET model=EXCLUDED.model,secret=EXCLUDED.secret,tested=false",
          [account.id, user.id, id, input.model, JSON.stringify(secret)],
        );
        return json({ provider: id, model: input.model, tested: false });
      });
    if (method === "POST" && ["test", "models"].includes(action)) {
      await tx(async () => {
        const recent = (
          await client.query(
            "SELECT count(*)::int AS count FROM audit_log WHERE account_id=$1 AND user_id=$2 AND entity='llm-connections' AND created_at>now()-interval '1 hour'",
            [account.id, user.id],
          )
        ).rows[0].count;
        if (recent >= 20)
          throw rentalError(
            "Zu viele Verbindungsprüfungen. Bitte später erneut versuchen.",
            429,
          );
        await client.query(
          "INSERT INTO audit_log(account_id,id,user_id,action,entity) VALUES($1,$2,$3,$4,$5)",
          [account.id, randomUUID(), user.id, action, "llm-connections"],
        );
      });
      const connection = await tx(
        async () =>
          (
            await client.query(
              "SELECT model,secret FROM llm_connections WHERE account_id=$1 AND user_id=$2 AND provider=$3",
              [account.id, user.id, id],
            )
          ).rows[0],
      );
      if (!connection)
        throw rentalError("Bitte zuerst die Verbindung speichern.");
      if (simulationEnabled(env)) {
        if (action === "models") return json([connection.model]);
      } else {
        const key = decryptSecret(
          connection.secret,
          `${account.id}:${user.id}:${id}`,
          env,
        );
        const models = await listModels(id, key);
        if (action === "models") return json(models);
        if (!models.includes(connection.model))
          throw rentalError(
            "Dieses Modell unterstützt die benötigten Aufgaben nicht oder ist nicht verfügbar.",
          );
        // Both capabilities must actually succeed before this connection can run an assistant.
        const { PDFDocument } = await import("pdf-lib");
        const pdf = await PDFDocument.create();
        pdf.addPage();
        await generate({
          provider: id,
          model: connection.model,
          key,
          prompt:
            'Prüfe das beigefügte leere PDF. Antworte als JSON: {"ok":true}.',
          files: [
            {
              name: "test.pdf",
              mime: "application/pdf",
              base64: Buffer.from(await pdf.save()).toString("base64"),
            },
          ],
        });
        const research = await generate({
          provider: id,
          model: connection.model,
          key,
          search: true,
          prompt:
            "Suche die offizielle Website der Stadt Berlin und nenne die Quelle.",
        });
        if (!research.sources.length)
          throw rentalError(
            "Das Modell hat keine belegte Webrecherche geliefert. Bitte ein anderes Modell wählen.",
          );
      }
      await tx(async () => {
        await client.query(
          "UPDATE llm_connections SET tested=true WHERE account_id=$1 AND user_id=$2 AND provider=$3 AND secret=$4::jsonb AND model=$5",
          [
            account.id,
            user.id,
            id,
            JSON.stringify(connection.secret),
            connection.model,
          ],
        );
      });
      return json({ success: true, simulated: simulationEnabled(env) });
    }
  }
  if (
    resource === "account" &&
    ["email", "password", "delete"].includes(id) &&
    method === "POST"
  ) {
    await auth.api.verifyPassword({
      headers: request.headers,
      body: { password: text(input.currentPassword, 128) },
    });
    if (id === "email")
      return auth.api.changeEmail({
        headers: request.headers,
        body: {
          newEmail: input.email,
          callbackURL: `${env.BETTER_AUTH_URL}/settings?emailChanged=1`,
        },
        asResponse: true,
      });
    if (id === "password")
      return auth.api.changePassword({
        headers: request.headers,
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.password,
          revokeOtherSessions: true,
        },
        asResponse: true,
      });
    if (input.confirmation !== "KONTO LÖSCHEN")
      throw rentalError(
        "Bitte die endgültige Löschung ausdrücklich bestätigen.",
      );
    return enqueue("delete", {});
  }
  if (resource === "account" && id === "export" && method === "POST")
    return enqueue("export", {});
  if (resource === "jobs") {
    if (method === "GET" && !id)
      return tx(async () =>
        json(
          (
            await client.query(
              "SELECT id,kind,status,input,result,error FROM assistant_jobs WHERE account_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100",
              [account.id, user.id],
            )
          ).rows,
        ),
      );
    const job = await tx(async () => {
      const row = (
        await client.query(
          "SELECT id,kind,status,result,error,object_key FROM assistant_jobs WHERE account_id=$1 AND user_id=$2 AND id=$3",
          [account.id, user.id, id],
        )
      ).rows[0];
      if (!row) throw rentalError("Auftrag nicht gefunden.", 404);
      if (method === "POST" && action === "cancel") {
        if (row.kind === "delete")
          throw rentalError(
            "Die bestätigte Kontolöschung kann nicht abgebrochen werden.",
          );
        await client.query(
          "UPDATE assistant_jobs SET status='cancelled',updated_at=now() WHERE account_id=$1 AND id=$2 AND status IN ('queued','running')",
          [account.id, id],
        );
        row.status = ["queued", "running"].includes(row.status)
          ? "cancelled"
          : row.status;
      }
      return row;
    });
    if (method === "GET" && action === "download") {
      if (job.status !== "completed" || !job.object_key)
        throw rentalError("Der Download ist noch nicht bereit.", 409);
      const file = await env.FILES.get(job.object_key);
      if (!file) throw rentalError("Datei nicht gefunden.", 404);
      return new Response(file.body, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="zuloni-export.zip"',
          "Cache-Control": "no-store",
        },
      });
    }
    const { object_key: _key, ...publicJob } = job;
    return json(publicJob);
  }
  if (["buildings", "exposes", "utility-statements"].includes(resource)) {
    if (method === "GET")
      return tx(async () =>
        json(
          id
            ? await getRecord(client, account.id, resource, id)
            : await recordList(client, account.id, resource),
        ),
      );
    if (["POST", "PUT"].includes(method) && !action)
      return tx(async () => {
        const previous = id
          ? await getRecord(client, account.id, resource, id)
          : null;
        if (previous?.status === "final")
          throw rentalError(
            "Finalisierte Dokumente bleiben unverändert. Bitte eine neue Version anlegen.",
            409,
          );
        if (previous && input.revision !== previous.revision)
          throw rentalError(
            "Der Entwurf wurde inzwischen geändert. Bitte neu laden.",
            409,
          );
        if (
          id &&
          (
            await client.query(
              "SELECT id FROM assistant_jobs WHERE account_id=$1 AND input->>'recordId'=$2 AND status IN ('queued','running')",
              [account.id, id],
            )
          ).rows.length
        )
          throw rentalError("Der Entwurf wird gerade verarbeitet.", 409);
        const data = await loadData(client, account.id);
        let value;
        if (resource === "buildings") value = buildingInput(input);
        else if (resource === "exposes")
          value = exposeInput(input, previous, data);
        else
          value = previous
            ? statementInput(input, previous, data)
            : newStatement(
                input,
                data,
                await getRecord(
                  client,
                  account.id,
                  "buildings",
                  input.buildingId,
                ),
              );
        if (resource === "exposes" && !previous) {
          value.facts = data.properties.find(
            (property) => property.id === value.propertyId,
          );
          const sender = (
            await client.query(
              "SELECT data FROM user_settings WHERE account_id=$1 AND user_id=$2",
              [account.id, user.id],
            )
          ).rows[0]?.data?.sender;
          if (!value.contact && sender)
            value.contact = [sender.name, sender.email, sender.phone]
              .filter(Boolean)
              .join(" · ");
        }
        if (resource === "exposes" && input.copyOf && !previous) {
          const source = await getRecord(
            client,
            account.id,
            resource,
            input.copyOf,
          );
          if (source.propertyId !== value.propertyId)
            throw rentalError("Ungültige Vorlage.");
          value = {
            ...source,
            ...value,
            sourceId: source.id,
            status: "draft",
            reviewed: false,
            pdfIds: [],
          };
        }
        return json(
          await putRecord(client, account.id, resource, value, previous),
          previous ? 200 : 201,
        );
      });
    if (
      method === "POST" &&
      action === "copy" &&
      resource === "utility-statements"
    )
      return tx(async () => {
        const previous = await getRecord(client, account.id, resource, id);
        const {
          id: _id,
          revision: _revision,
          result: _result,
          pdfIds: _pdfIds,
          ...copy
        } = previous;
        return json(
          await putRecord(client, account.id, resource, {
            ...copy,
            sourceId: id,
            status: "draft",
            houseConfirmed: false,
            advancesConfirmed: false,
            heatingConfirmed: false,
          }),
        );
      });
    if (
      method === "POST" &&
      resource === "utility-statements" &&
      action === "calculate"
    )
      return tx(async () =>
        json(
          calculateStatement(await getRecord(client, account.id, resource, id)),
        ),
      );
    if (method === "POST" && action === "generate" && resource === "exposes")
      return enqueue("expose", { recordId: id });
    if (
      method === "POST" &&
      action === "analyze" &&
      resource === "utility-statements"
    )
      return enqueue("analysis", { recordId: id });
    if (method === "POST" && action === "finalize")
      return enqueue(resource === "exposes" ? "pdf" : "statement-pdfs", {
        recordId: id,
      });
    if (
      method === "POST" &&
      action === "zip" &&
      resource === "utility-statements"
    )
      return enqueue("statement-zip", { recordId: id });
  }
  throw rentalError("Funktion nicht gefunden.", 404);

  async function enqueue(kind, payload) {
    if (!env.ASSISTANT_WORKFLOW)
      throw rentalError(
        "Die Hintergrundverarbeitung ist noch nicht eingerichtet.",
        503,
      );
    if (["expose", "analysis"].includes(kind) && input.consent !== true)
      throw rentalError(
        "Bitte die Verarbeitung durch den gewählten LLM-Anbieter bestätigen.",
      );
    const created = await tx(async () => {
      const requestKey = text(input.requestKey || "", 100);
      if (!requestKey) throw rentalError("Auftragskennung fehlt.");
      const existing = (
        await client.query(
          "SELECT id,status FROM assistant_jobs WHERE account_id=$1 AND user_id=$2 AND request_key=$3",
          [account.id, user.id, requestKey],
        )
      ).rows[0];
      if (existing) return { ...existing, exists: true };
      const recent = (
        await client.query(
          "SELECT count(*)::int AS count FROM assistant_jobs WHERE account_id=$1 AND user_id=$2 AND created_at>now()-interval '1 hour'",
          [account.id, user.id],
        )
      ).rows[0].count;
      if (recent >= 30 && kind !== "delete")
        throw rentalError(
          "Das Auftragslimit ist erreicht. Bitte später erneut versuchen.",
          429,
        );
      if (
        ["export", "statement-zip"].includes(kind) &&
        (
          await client.query(
            "SELECT id FROM assistant_jobs WHERE account_id=$1 AND user_id=$2 AND kind IN ('export','statement-zip') AND status IN ('queued','running')",
            [account.id, user.id],
          )
        ).rows.length
      )
        throw rentalError("Ein ZIP-Export wird bereits erstellt.", 409);
      if (payload.recordId) {
        const recordKind = ["expose", "pdf"].includes(kind)
          ? "exposes"
          : "utility-statements";
        const record = await getRecord(
          client,
          account.id,
          recordKind,
          payload.recordId,
        );
        if (record.status === "final" && kind !== "statement-zip")
          throw rentalError("Bitte zuerst eine neue Version anlegen.", 409);
        if (
          (
            await client.query(
              "SELECT id FROM assistant_jobs WHERE account_id=$1 AND input->>'recordId'=$2 AND status IN ('queued','running')",
              [account.id, payload.recordId],
            )
          ).rows.length
        )
          throw rentalError("Dieser Entwurf wird bereits verarbeitet.", 409);
        payload.revision = record.revision;
        if (kind === "statement-pdfs") {
          const calculation = calculateStatement(record);
          if (calculation.issues.length)
            throw rentalError(calculation.issues.join("\n"));
        }
        if (
          kind === "pdf" &&
          (!record.reviewed ||
            !record.title ||
            !record.intro ||
            !record.contact ||
            record.warnings?.length)
        )
          throw rentalError(
            "Bitte den vollständigen Exposé-Entwurf und alle offenen Angaben prüfen.",
          );
        if (kind === "statement-zip" && record.status !== "final")
          throw rentalError("Bitte zuerst die Abrechnung finalisieren.");
      }
      if (["expose", "analysis"].includes(kind)) {
        const settings = (
          await client.query(
            "SELECT data FROM user_settings WHERE account_id=$1 AND user_id=$2",
            [account.id, user.id],
          )
        ).rows[0]?.data;
        const connection = (
          await client.query(
            "SELECT provider,model FROM llm_connections WHERE account_id=$1 AND user_id=$2 AND provider=$3 AND tested",
            [account.id, user.id, settings?.provider || ""],
          )
        ).rows[0];
        if (!connection && !simulationEnabled(env))
          throw rentalError(
            "Bitte zuerst unter Einstellungen eine persönliche LLM-Verbindung speichern, prüfen und auswählen.",
          );
        payload.provider = connection?.provider || "simulation";
        payload.model = connection?.model || "simulation";
        payload.simulated = simulationEnabled(env);
      }
      const jobId = randomUUID();
      if (kind === "delete") {
        await client.query(
          "UPDATE domus_accounts SET deleting=true WHERE id=$1",
          [account.id],
        );
        await client.query(
          "UPDATE assistant_jobs SET status='cancelled' WHERE account_id=$1 AND status IN ('queued','running')",
          [account.id],
        );
      }
      await client.query(
        "INSERT INTO assistant_jobs(account_id,id,user_id,kind,input,request_key) VALUES($1,$2,$3,$4,$5,$6)",
        [account.id, jobId, user.id, kind, JSON.stringify(payload), requestKey],
      );
      return { id: jobId, status: "queued" };
    });
    if (!created.exists) {
      try {
        await env.ASSISTANT_WORKFLOW.create({
          id: created.id,
          params: { accountId: account.id, jobId: created.id },
        });
      } catch {
        await withAccountTransaction(client, account.id, async () => {
          await client.query(
            "UPDATE assistant_jobs SET status='failed',error='Die Verarbeitung konnte nicht gestartet werden.' WHERE account_id=$1 AND id=$2",
            [account.id, created.id],
          );
          if (kind === "delete")
            await client.query(
              "UPDATE domus_accounts SET deleting=false WHERE id=$1",
              [account.id],
            );
        });
        throw rentalError(
          "Die Verarbeitung konnte nicht gestartet werden. Bitte erneut versuchen.",
          503,
        );
      }
    }
    return json(created, 202);
  }
}
