import { randomUUID } from 'node:crypto';
import { APPLICATION_STATUSES, RENTAL_PHASES, leaseStatus, overlaps, rentalError, validDate, textValue, moneyCents, unlinkedTenants } from '../src/domain/rentals.js';

export function localToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function createRentalService(db) {
    const findProperty = (data, id) => {
        const property = data.properties.find(p => p.id === id);
        if (!property) throw rentalError('Wohnung nicht gefunden.', 404);
        return property;
    };
    const findRental = (data, id, editable = true) => {
        const rental = (data.rentals || []).find(r => r.id === id);
        if (!rental) throw rentalError('Vermietung nicht gefunden.', 404);
        if (editable && ['Completed', 'Archived'].includes(rental.phase)) throw rentalError('Dieser Vorgang ist abgeschlossen oder archiviert.', 409);
        return rental;
    };
    const enumValue = (value, values, label) => {
        if (!Object.hasOwn(values, value)) throw rentalError(`${label}: ungültiger Status.`);
        return value;
    };

    // Mutate a copy after validation; failed operations never leave partial applicants/tenants.
    // The callback and state assignment are synchronous, including idempotency checks.
    async function transact(action) {
        let result;
        await db.update(data => {
            const draft = structuredClone(data);
            draft.rentals ||= [];
            draft.leases ||= [];
            result = action(draft);
            Object.assign(data, draft);
        });
        return result;
    }

    function rentalFields(input) {
        return {
            title: textValue(input.title, 'Bezeichnung', true, 200),
            availableFrom: validDate(input.availableFrom, 'Verfügbar ab', true),
            coldRentCents: moneyCents(input.coldRent, 'Kaltmiete', true),
            utilitiesCents: moneyCents(input.utilities, 'Nebenkosten', true),
            depositCents: moneyCents(input.deposit, 'Kaution', true),
            included: textValue(input.included, 'Mitvermietete Bestandteile'),
            notes: textValue(input.notes, 'Interne Notizen'),
            listing: textValue(input.listing, 'Inserat', false, 20000),
        };
    }

    function overview() {
        const today = localToday();
        return { rentals: db.data.rentals || [], leases: (db.data.leases || []).map(l => ({ ...l, status: leaseStatus(l, today) })),
            legacyTenants: unlinkedTenants(db.data), today };
    }
    const createRental = input => transact(data => {
        findProperty(data, input.propertyId);
        const rental = { id: randomUUID(), propertyId: input.propertyId, ...rentalFields(input), phase: 'Preparation', applications: [], viewings: [], selectedApplicationId: null, createdAt: new Date().toISOString() };
        data.rentals.push(rental);
        return rental;
    });
    const updateRental = (id, input) => transact(data => {
        const rental = findRental(data, id);
        if (input.phase !== undefined) {
            enumValue(input.phase, RENTAL_PHASES, 'Vorgang');
            if (input.phase === 'Completed') throw rentalError('Zum Abschließen einen unterschriebenen Vertrag zuordnen.');
            rental.phase = input.phase;
        }
        if (input.title !== undefined) Object.assign(rental, rentalFields(input));
        if (input.selectedApplicationId !== undefined) {
            const application = rental.applications.find(a => a.id === input.selectedApplicationId);
            if (input.selectedApplicationId !== null && (!application || ['Withdrawn', 'Rejected'].includes(application.status))) throw rentalError('Eine aktive Bewerbung auswählen.');
            rental.selectedApplicationId = input.selectedApplicationId;
        }
        return rental;
    });

    function applicationFields(input) {
        if (!Array.isArray(input.parties) || !input.parties.length || input.parties.length > 10) throw rentalError('Eine bis zehn Vertragsparteien angeben.');
        return {
            parties: input.parties.map(p => ({ name: textValue(p?.name, 'Name', true, 200), email: textValue(p?.email, 'E-Mail', false, 250), phone: textValue(p?.phone, 'Telefon', false, 100) })),
            inquiry: textValue(input.inquiry, 'Anfrage'), notes: textValue(input.notes, 'Notizen'),
            status: enumValue(input.status || 'New', APPLICATION_STATUSES, 'Bewerbung'),
        };
    }
    const saveApplication = (rentalId, applicationId, input) => transact(data => {
        const rental = findRental(data, rentalId);
        const fields = applicationFields(input);
        let application;
        if (applicationId) {
            application = rental.applications.find(a => a.id === applicationId);
            if (!application) throw rentalError('Bewerbung nicht gefunden.', 404);
            Object.assign(application, fields);
        } else {
            application = { id: randomUUID(), ...fields };
            rental.applications.push(application);
        }
        if (['Withdrawn', 'Rejected'].includes(application.status) && rental.selectedApplicationId === application.id) rental.selectedApplicationId = null;
        return rental;
    });
    const saveViewing = (rentalId, viewingId, input) => transact(data => {
        const rental = findRental(data, rentalId);
        if (!rental.applications.some(a => a.id === input.applicationId)) throw rentalError('Bewerbung nicht gefunden.');
        const date = validDate(input.date, 'Besichtigungsdatum');
        if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw rentalError('Gültige Uhrzeit eingeben.');
        const fields = { applicationId: input.applicationId, date, time: input.time, notes: textValue(input.notes, 'Besichtigungsnotizen'),
            status: enumValue(input.status || 'Scheduled', { Scheduled: true, Done: true, Cancelled: true }, 'Besichtigung') };
        if (viewingId) {
            const existing = rental.viewings.find(v => v.id === viewingId);
            if (!existing) throw rentalError('Termin nicht gefunden.', 404);
            Object.assign(existing, fields);
        } else rental.viewings.push({ id: randomUUID(), ...fields });
        return rental;
    });

    function leaseFields(input) {
        const start = validDate(input.start, 'Mietbeginn');
        const end = validDate(input.end, 'Mietende', true);
        if (end && end < start) throw rentalError('Mietende muss am oder nach dem Mietbeginn liegen.');
        return { start, end, coldRentCents: moneyCents(input.coldRent, 'Kaltmiete'), utilitiesCents: moneyCents(input.utilities, 'Nebenkosten'), depositCents: moneyCents(input.deposit, 'Kaution'), included: textValue(input.included, 'Mitvermietete Bestandteile') };
    }
    function assertNoOverlap(data, lease, excludeId = null) {
        const conflict = data.leases.find(other => other.id !== excludeId && (other.propertyId === lease.propertyId || other.tenantIds.some(id => lease.tenantIds.includes(id))) && overlaps(other, lease));
        if (conflict) throw rentalError(`Zeitraum überschneidet sich mit Mietverhältnis ${conflict.start} bis ${conflict.end || 'unbefristet'}. Zuerst den bestehenden Zeitraum prüfen.`, 409);
        const unresolved = unlinkedTenants(data).filter(t => !lease.tenantIds.includes(t.id) && t.propertyId === lease.propertyId && t.status === 'Active');
        if (unresolved.length) throw rentalError('Aktive Bestandsmieter dieser Wohnung zuerst als Mietverhältnis bestätigen (gemeinsame Vertragsparteien gemeinsam auswählen).', 409);
    }
    function signedDocument(data, id, propertyId) {
        const document = (data.documents || []).find(d => d.id === id && d.propertyId === propertyId && d.category === 'Leases' && data.documentFiles?.[d.id]);
        if (!document) throw rentalError('Einen hinterlegten Mietvertrag dieser Wohnung auswählen.');
        return document.id;
    }
    const confirmLegacyLease = input => transact(data => {
        findProperty(data, input.propertyId);
        if (!Array.isArray(input.tenantIds) || !input.tenantIds.length || new Set(input.tenantIds).size !== input.tenantIds.length) throw rentalError('Vertragsparteien auswählen.');
        const available = unlinkedTenants(data);
        if (!input.tenantIds.every(id => available.some(t => t.id === id && (!t.propertyId || t.propertyId === input.propertyId)))) throw rentalError('Nur noch nicht zugeordnete Bestandsmieter dieser Wohnung auswählen.');
        const lease = { id: randomUUID(), propertyId: input.propertyId, tenantIds: input.tenantIds, ...leaseFields(input), source: 'legacy-confirmed', createdAt: new Date().toISOString() };
        assertNoOverlap(data, lease);
        data.leases.push(lease);
        return lease;
    });
    const updateLease = (id, input) => transact(data => {
        const lease = data.leases.find(l => l.id === id);
        if (!lease) throw rentalError('Mietverhältnis nicht gefunden.', 404);
        const end = validDate(input.end, 'Mietende', true);
        if (end && end < lease.start) throw rentalError('Mietende liegt vor dem Mietbeginn.');
        assertNoOverlap(data, { ...lease, end }, id);
        lease.end = end;
        return lease;
    });
    const completeRental = (id, input) => transact(data => {
        const rental = findRental(data, id, false);
        // One transaction and one stable rental reference make retries idempotent.
        const previous = data.leases.find(l => l.rentalId === id);
        if (previous) return previous;
        if (rental.phase === 'Archived') throw rentalError('Archivierter Vorgang kann nicht abgeschlossen werden.', 409);
        if (input.confirmSigned !== true) throw rentalError('Unterschrift und Vertragsdaten ausdrücklich bestätigen.');
        const application = rental.applications.find(a => a.id === rental.selectedApplicationId);
        if (!application || ['Withdrawn', 'Rejected'].includes(application.status)) throw rentalError('Zuerst eine aktive Bewerbung auswählen.');
        const contractDocumentId = signedDocument(data, input.contractDocumentId, rental.propertyId);
        const fields = leaseFields(input);
        const parties = application.parties.map(p => ({ ...p, id: randomUUID(), paymentHistory: [] }));
        const lease = { id: randomUUID(), rentalId: id, propertyId: rental.propertyId, tenantIds: parties.map(p => p.id), ...fields, contractDocumentId,
            partySnapshot: structuredClone(application.parties), source: 'rental', createdAt: new Date().toISOString() };
        assertNoOverlap(data, lease);
        data.tenants.push(...parties);
        data.leases.push(lease);
        rental.phase = 'Completed';
        rental.leaseId = lease.id;
        return lease;
    });

    return { overview, createRental, updateRental, saveApplication, saveViewing, confirmLegacyLease, updateLease, completeRental };
}
