import { randomUUID } from 'node:crypto';
import { withAccountTransaction } from './database.js';

export const entities = ['properties', 'tenants', 'documents', 'rentals', 'leases', 'issues', 'costs', 'contacts'];
const cents = value => value == null || value === '' ? null : Math.round(Number(value) * 100);
const columns = {
    properties: row => ({ cold_rent_cents: cents(row.coldRent), utilities_cents: cents(row.nebenkosten) }),
    tenants: row => ({ property_id: row.propertyId || null }),
    documents: row => ({ property_id: row.propertyId || null }),
    document_files: row => ({ bytes: row.bytes, hash: row.hash, object_key: row.key }),
    rentals: row => ({ property_id: row.propertyId }),
    rental_applications: row => ({ rental_id: row.rentalId }),
    rental_viewings: row => ({ rental_id: row.rentalId, application_id: row.applicationId }),
    leases: row => ({ property_id: row.propertyId, rental_id: row.rentalId || null, contract_document_id: row.contractDocumentId || null,
        start_date: row.start, end_date: row.end || null, cold_rent_cents: row.coldRentCents, utilities_cents: row.utilitiesCents, deposit_cents: row.depositCents }),
    lease_parties: row => ({ lease_id: row.leaseId, tenant_id: row.tenantId }),
    issues: row => ({ property_id: row.propertyId || null, tenant_id: row.tenantId || null }),
    costs: row => ({ amount_cents: cents(row.amount), due_date: row.dueDate || null, paid_date: row.paidDate || null }),
    cost_links: row => ({ cost_id: row.costId, tenant_id: row.tenantId || null, property_id: row.propertyId || null, issue_id: row.issueId || null }),
    contacts: () => ({}),
};

export function emptyData() {
    return { ...Object.fromEntries(entities.map(name => [name, []])), documentFiles: {}, rentalSchemaVersion: 1 };
}

// One id per verified user makes first access and retried onboarding idempotent.
export async function ensureAccount(client, user) {
    if (!user.emailVerified) throw Object.assign(new Error('Bitte zuerst deine E-Mail-Adresse bestätigen.'), { status: 403 });
    const id = `domus-${user.id}`;
    return withAccountTransaction(client, id, async () => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`onboard:${user.id}`]);
        const existing = await client.query('SELECT a.id, o.name FROM domus_accounts a JOIN organization o ON o.id = a.id JOIN member m ON m."organizationId" = a.id AND m."userId" = $1 WHERE a.owner_user_id = $1', [user.id]);
        if (existing.rows.length) return existing.rows[0];
        const name = `${user.name || 'Meine'} Immobilien`;
        await client.query('INSERT INTO organization (id, name, slug, "createdAt") VALUES ($1, $2, $1, now()) ON CONFLICT (id) DO NOTHING', [id, name]);
        await client.query('INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, \'owner\', now()) ON CONFLICT (id) DO NOTHING', [`owner-${user.id}`, id, user.id]);
        await client.query('INSERT INTO domus_accounts (id, owner_user_id) VALUES ($1, $2)', [id, user.id]);
        return { id, name };
    });
}

export async function loadData(client, accountId) {
    const data = emptyData();
    // The account predicate complements RLS and makes the intended scope explicit.
    const queries = entities.map(name => `SELECT '${name}' AS entity, data, created_at, id FROM ${name} WHERE account_id = $1`);
    const result = await client.query(`SELECT entity, data FROM (${queries.join(' UNION ALL ')}) records ORDER BY created_at, id`, [accountId]);
    for (const row of result.rows) data[row.entity].push(row.data);
    const files = await client.query('SELECT id, data FROM document_files WHERE account_id = $1', [accountId]);
    data.documentFiles = Object.fromEntries(files.rows.map(row => [row.id, row.data]));
    return data;
}

function relationalRows(data) {
    const rows = Object.fromEntries(entities.map(name => [name, data[name] || []]));
    rows.document_files = Object.entries(data.documentFiles || {}).map(([id, row]) => ({ ...row, id }));
    rows.rental_applications = data.rentals.flatMap(rental => rental.applications.map(row => ({ ...row, rentalId: rental.id })));
    rows.rental_viewings = data.rentals.flatMap(rental => rental.viewings.map(row => ({ ...row, rentalId: rental.id })));
    rows.lease_parties = data.leases.flatMap(lease => lease.tenantIds.map(tenantId => ({ id: `${lease.id}:${tenantId}`, leaseId: lease.id, tenantId })));
    rows.cost_links = data.costs.flatMap(cost => ['tenant', 'property', 'issue'].flatMap(kind =>
        (cost[`${kind}Ids`] || []).map(id => ({ id: `${cost.id}:${kind}:${id}`, costId: cost.id, [`${kind}Id`]: id }))));
    return rows;
}

export async function saveData(client, accountId, before, after) {
    const oldRows = relationalRows(before);
    const newRows = relationalRows(after);
    for (const [table, fields] of Object.entries(columns)) {
        const previous = new Map(oldRows[table].map(row => [row.id, row]));
        const current = new Map(newRows[table].map(row => [row.id, row]));
        const removed = [...previous.keys()].filter(id => !current.has(id));
        if (removed.length) await client.query(`DELETE FROM ${table} WHERE account_id = $1 AND id = ANY($2::text[])`, [accountId, removed]);
        for (const row of current.values()) {
            if (JSON.stringify(previous.get(row.id)) === JSON.stringify(row)) continue;
            const values = { account_id: accountId, id: row.id, data: JSON.stringify(row), ...fields(row) };
            const keys = Object.keys(values);
            const updates = keys.filter(key => !['id', 'account_id'].includes(key)).map(key => `${key} = EXCLUDED.${key}`);
            await client.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(', ')}) ON CONFLICT (account_id, id) DO UPDATE SET ${updates.join(', ')}, updated_at = now()`, Object.values(values));
        }
    }
}

export async function accountAction(client, account, userId, action, audit) {
    return withAccountTransaction(client, account.id, async () => {
        // ponytail: serialize writes within one account while existing rental rules operate on a snapshot.
        // Row-level operation-specific locking can replace this if pilot throughput requires it.
        if (audit) await client.query('SELECT id FROM domus_accounts WHERE id = $1 FOR UPDATE', [account.id]);
        const membership = await client.query('SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2', [account.id, userId]);
        if (!membership.rows.length) throw Object.assign(new Error('Kein Zugriff auf dieses Konto.'), { status: 403 });
        const data = await loadData(client, account.id);
        const before = structuredClone(data);
        const result = await action(data);
        if (audit) {
            await saveData(client, account.id, before, data);
            await client.query('INSERT INTO audit_log (account_id, id, user_id, action, entity) VALUES ($1, $2, $3, $4, $5)', [account.id, randomUUID(), userId, audit.action, audit.entity]);
        }
        return result;
    }, { readOnly: !audit });
}
