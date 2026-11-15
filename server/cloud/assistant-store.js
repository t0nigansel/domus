import { randomUUID } from "node:crypto";
import { rentalError } from "../../src/domain/rentals.js";
import { withAccountTransaction } from "./database.js";

export async function recordList(client, accountId, kind) {
  return (
    await client.query(
      "SELECT id, data, revision FROM assistant_records WHERE account_id=$1 AND kind=$2 ORDER BY created_at,id",
      [accountId, kind],
    )
  ).rows.map((row) => ({ ...row.data, id: row.id, revision: row.revision }));
}
export async function getRecord(client, accountId, kind, id) {
  const row = (
    await client.query(
      "SELECT data,revision FROM assistant_records WHERE account_id=$1 AND kind=$2 AND id=$3",
      [accountId, kind, id],
    )
  ).rows[0];
  if (!row) throw rentalError("Eintrag nicht gefunden.", 404);
  return { ...row.data, id, revision: row.revision };
}
export async function putRecord(client, accountId, kind, data, previous) {
  const id = previous?.id || randomUUID();
  if (previous) {
    const result = await client.query(
      "UPDATE assistant_records SET data=$4,revision=revision+1,updated_at=now() WHERE account_id=$1 AND id=$2 AND revision=$3 RETURNING revision",
      [accountId, id, previous.revision, JSON.stringify(data)],
    );
    if (!result.rows.length)
      throw rentalError(
        "Der Entwurf wurde inzwischen geändert. Bitte neu laden.",
        409,
      );
    return { ...data, id, revision: result.rows[0].revision };
  }
  await client.query(
    "INSERT INTO assistant_records(account_id,id,kind,data) VALUES($1,$2,$3,$4)",
    [accountId, id, kind, JSON.stringify(data)],
  );
  return { ...data, id, revision: 1 };
}
export async function jobAction(client, accountId, jobId, action) {
  return withAccountTransaction(client, accountId, async () => {
    const account = (
      await client.query(
        "SELECT deleting FROM domus_accounts WHERE id=$1 FOR UPDATE",
        [accountId],
      )
    ).rows[0];
    if (!account) throw rentalError("Konto nicht mehr vorhanden.", 410);
    const job = (
      await client.query(
        "SELECT * FROM assistant_jobs WHERE account_id=$1 AND id=$2",
        [accountId, jobId],
      )
    ).rows[0];
    if (
      !job ||
      job.status === "cancelled" ||
      (account.deleting && job.kind !== "delete")
    )
      throw rentalError("Auftrag abgebrochen.", 409);
    return action(job);
  });
}
