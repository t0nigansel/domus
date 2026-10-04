export const RENTAL_PHASES = { Preparation: 'Vorbereitung', Listing: 'Inserat', Inquiries: 'Anfragen', Viewings: 'Besichtigungen', Selection: 'Auswahl', Contract: 'Vertrag', Completed: 'Abgeschlossen', Archived: 'Archiviert' };
export const APPLICATION_STATUSES = { New: 'Neu', Contacted: 'Kontaktiert', Interested: 'Interessiert', Withdrawn: 'Zurückgezogen', Rejected: 'Abgesagt' };
export const LEASE_STATUSES = { Planned: 'Geplant', Active: 'Aktiv', Ended: 'Beendet' };

export const rentalError = (message, status = 400) => Object.assign(new Error(message), { status });
export function validDate(value, label, optional = false) {
    if (optional && (value === '' || value === null || value === undefined)) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw rentalError(`${label}: gültiges Datum erforderlich.`);
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw rentalError(`${label}: ungültiges Datum.`);
    return value;
}
export function textValue(value, label, required = false, max = 5000) {
    if (value === undefined || value === null) value = '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw rentalError(`${label}: Angabe fehlt oder ist zu lang.`);
    return value.trim();
}
export function moneyCents(value, label, optional = false) {
    if (optional && (value === '' || value === null || value === undefined)) return null;
    const normalized = String(value ?? '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw rentalError(`${label}: positiven Eurobetrag mit höchstens zwei Nachkommastellen eingeben.`);
    const [euros, cents = ''] = normalized.split('.');
    const result = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
    if (!Number.isSafeInteger(result) || result > 1000000000) throw rentalError(`${label}: Betrag zu groß.`);
    return result;
}
export function leaseStatus(lease, today) {
    if (lease.start > today) return 'Planned';
    if (lease.end && lease.end < today) return 'Ended';
    return 'Active';
}
export function overlaps(a, b) {
    return a.start <= (b.end || '9999-12-31') && b.start <= (a.end || '9999-12-31');
}

// Additive migration: never infer that two people share one contract.
export function migrateRentals(data) {
    if (data.rentalSchemaVersion >= 1) return data;
    return { ...data, rentals: data.rentals || [], leases: data.leases || [], rentalSchemaVersion: 1 };
}

export function unlinkedTenants(data) {
    const assigned = new Set((data.leases || []).flatMap(lease => lease.tenantIds));
    return (data.tenants || []).filter(tenant => !assigned.has(tenant.id));
}

// Read projections keep time-dependent status correct after a server restart or date change.
// Stored legacy fields are left intact until a lease is explicitly confirmed.
export function tenancyView(data, today) {
    const leases = data.leases || [];
    const tenants = (data.tenants || []).map(tenant => {
        const history = leases.filter(lease => lease.tenantIds.includes(tenant.id)).sort((a, b) => b.start.localeCompare(a.start));
        if (!history.length) return { ...tenant };
        const current = history.find(lease => leaseStatus(lease, today) === 'Active');
        const past = history.find(lease => leaseStatus(lease, today) === 'Ended');
        const next = history.filter(lease => leaseStatus(lease, today) === 'Planned').at(-1);
        const shown = current || past || next;
        return { ...tenant, leaseManaged: true, leaseId: shown.id,
            propertyId: shown.propertyId, propertyName: data.properties.find(p => p.id === shown.propertyId)?.name || '',
            leaseStart: shown.start, leaseEnd: shown.end,
            status: current ? 'Active' : past ? 'Past' : 'Pending',
        };
    });
    const properties = (data.properties || []).map(property => {
        const history = leases.filter(lease => lease.propertyId === property.id);
        if (!history.length) return { ...property };
        if (!history.some(lease => lease.start <= today)) return { ...property, leaseManaged: true };
        const activeLease = history.find(lease => leaseStatus(lease, today) === 'Active');
        const activeTenants = tenants.filter(tenant => tenant.propertyId === property.id && tenant.status === 'Active');
        return { ...property, leaseManaged: true, occupants: activeTenants.length,
            status: activeTenants.length ? 'Occupied' : property.status === 'Maintenance' ? 'Maintenance' : 'Vacant',
            ...(activeLease ? { coldRent: activeLease.coldRentCents / 100, nebenkosten: activeLease.utilitiesCents / 100 } : {}),
        };
    });
    return { tenants, properties };
}
