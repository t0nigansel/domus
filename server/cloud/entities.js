import { randomUUID } from 'node:crypto';
import { moneyCents, rentalError, tenancyView, validDate, textValue } from '../../src/domain/rentals.js';
import { localToday } from '../rentalOperations.js';
import { COST_RECURRENCES } from '../../src/domain/costs.js';

export const categories = ['Leases', 'Invoices', 'Insurance', 'Misc', 'Photos', 'FloorPlans', 'Energy'];
const fields = {
    properties: ['name', 'location', 'coldRent', 'nebenkosten', 'status', 'condition', 'occupants', 'pets', 'notes', 'street', 'postalCode', 'city', 'floor', 'size', 'rooms', 'equipment', 'heating', 'energyRating', 'energyDemand', 'modernizations'],
    tenants: ['name', 'email', 'phone', 'propertyId', 'propertyName', 'leaseStart', 'leaseEnd', 'status', 'paymentHistory'],
    documents: ['name', 'type', 'category', 'date', 'size', 'propertyId', 'caption', 'published', 'cover', 'position'],
    issues: ['title', 'description', 'propertyId', 'tenantId', 'priority', 'status', 'dueDate', 'attachments'],
    costs: ['name', 'description', 'amount', 'dueDate', 'paidDate', 'recurrence', 'utilityBillable', 'tenantIds', 'propertyIds', 'issueIds', 'attachments'],
    contacts: ['name', 'role', 'description', 'contactInfo', 'email', 'phone', 'address'],
};
const enums = {
    costs: { recurrence: COST_RECURRENCES },
    properties: { status: ['Occupied', 'Vacant', 'Maintenance'], condition: ['Good', 'Ok', 'Bad', 'Needs Repair', 'Renovated'] },
    tenants: { status: ['Active', 'Past', 'Pending'] },
    documents: { category: categories, type: ['image', 'pdf', 'document'] },
    issues: { status: ['Open', 'In Progress', 'Closed'], priority: ['Low', 'Medium', 'High'] },
};
const numeric = ['coldRent', 'nebenkosten', 'amount', 'occupants', 'size', 'rooms', 'energyDemand', 'position'];
const boolean = ['published', 'cover', 'utilityBillable'];
const dates = ['leaseStart', 'leaseEnd', 'date', 'dueDate', 'paidDate'];

export function validateEntity(name, input, data, existing = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw rentalError('Ein JSON-Objekt ist erforderlich.');
    if (Object.hasOwn(input, 'account_id') || Object.hasOwn(input, 'accountId')) throw rentalError('Die Kontozuordnung wird durch die Anmeldung festgelegt.');
    const result = { ...existing };
    for (const key of fields[name]) {
        if (input[key] === undefined) continue;
        const value = input[key];
        if (numeric.includes(key)) {
            const number = value === null || value === '' ? null : Number(value);
            if (number !== null && (!Number.isFinite(number) || number < 0 || number > 1000000000)) throw rentalError(`${key}: ungültige Zahl.`);
            if (['occupants', 'position'].includes(key) && number !== null && !Number.isInteger(number)) throw rentalError(`${key}: ganze Zahl erforderlich.`);
            if (['coldRent', 'nebenkosten', 'amount'].includes(key) && number !== null) moneyCents(value, key);
            result[key] = number;
        } else if (boolean.includes(key)) {
            if (typeof value !== 'boolean') throw rentalError(`${key}: ungültige Auswahl.`);
            result[key] = value;
        } else if (dates.includes(key)) result[key] = validDate(value, key, true);
        else if (['tenantIds', 'propertyIds', 'issueIds'].includes(key)) {
            if (!Array.isArray(value) || value.length > 1000 || value.some(id => typeof id !== 'string') || new Set(value).size !== value.length) throw rentalError(`${key}: ungültige Zuordnung.`);
            result[key] = [...value];
        } else if (key === 'attachments') {
            if (!Array.isArray(value) || value.length > 100) throw rentalError('Ungültige Anlagen.');
            result[key] = value.map(item => {
                if (typeof item === 'string') return textValue(item, 'Dateiname', true, 240);
                const document = data.documents.find(document => document.id === item?.id && document.hasFile);
                if (!document) throw rentalError('Anlage nicht gefunden.', 404);
                return { id: document.id, name: document.name, type: document.type, url: `/api/files/${encodeURIComponent(document.id)}/content` };
            });
        } else if (key === 'paymentHistory') {
            if (!Array.isArray(value) || value.length > 1000) throw rentalError('Ungültige Zahlungen.');
            result[key] = value.map(payment => ({ id: textValue(payment.id || randomUUID(), 'ID', true, 100), date: validDate(payment.date, 'Zahlungsdatum'), amount: moneyCents(payment.amount, 'Betrag') / 100, status: textValue(payment.status, 'Status', true, 30) }));
        } else result[key] = value === null && key.endsWith('Id') ? null : textValue(value, key, false, key === 'name' || key === 'title' ? 240 : 20000);
        if (enums[name]?.[key] && !enums[name][key].includes(result[key])) throw rentalError(`${key}: ungültige Auswahl.`);
    }
    const title = name === 'issues' ? 'title' : 'name';
    if (!result[title]?.trim()) throw rentalError('Bitte eine Bezeichnung angeben.');
    if (name === 'costs' && result.amount == null) throw rentalError('Bitte einen Betrag angeben.');
    if (name === 'contacts' && result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw rentalError('Bitte eine gültige E-Mail-Adresse angeben.');
    for (const [key, entity] of [['propertyId', 'properties'], ['tenantId', 'tenants']]) {
        if (result[key] && !data[entity].some(item => item.id === result[key])) throw rentalError('Zuordnung nicht gefunden.', 404);
    }
    for (const [key, entity] of [['tenantIds', 'tenants'], ['propertyIds', 'properties'], ['issueIds', 'issues']]) {
        if (result[key]?.some(id => !data[entity].some(item => item.id === id))) throw rentalError('Zuordnung nicht gefunden.', 404);
    }
    return result;
}

export function readEntities(data, name) {
    return ['properties', 'tenants'].includes(name) ? tenancyView(data, localToday())[name] : data[name];
}

export function changeEntity(data, name, method, id, input) {
    const existing = data[name].find(item => item.id === id);
    if (method !== 'POST' && !existing) throw rentalError('Eintrag nicht gefunden.', 404);
    if (method === 'DELETE') {
        if (name === 'tenants' && data.leases.some(lease => lease.tenantIds.includes(id))) throw rentalError('Vertragsparteien bleiben historisch erhalten.', 409);
        if (name === 'properties' && [...data.leases, ...data.rentals, ...data.documents, ...data.tenants, ...data.issues].some(item => item.propertyId === id)) throw rentalError('Wohnung ist noch mit Daten verknüpft.', 409);
        if (name === 'documents' && data.leases.some(lease => lease.contractDocumentId === id)) throw rentalError('Vertrag ist mit einem Mietverhältnis verknüpft.', 409);
        if (name === 'documents' && data.issues.some(issue => issue.attachments?.some(attachment => attachment.id === id))) throw rentalError('Dokument ist noch mit einem Anliegen verknüpft.', 409);
        data[name] = data[name].filter(item => item.id !== id);
        if (name === 'documents') delete data.documentFiles[id];
        return { success: true };
    }
    if (name === 'tenants' && data.leases.some(lease => lease.tenantIds.includes(id)) && ['propertyId', 'propertyName', 'leaseStart', 'leaseEnd', 'status'].some(key => Object.hasOwn(input, key))) throw rentalError('Zuordnung und Zeitraum werden im Mietverhältnis verwaltet.', 409);
    if (name === 'tenants' && input.propertyId && data.leases.some(lease => lease.propertyId === input.propertyId)) throw rentalError('Neue Vertragsparteien über eine Vermietung anlegen.', 409);
    const defaults = {
        properties: { status: 'Vacant', condition: 'Good', occupants: 0, coldRent: 0, nebenkosten: 0 },
        tenants: { status: 'Pending', paymentHistory: [] }, issues: { status: 'Open', priority: 'Medium', description: '', attachments: [] },
        costs: { recurrence: 'none', utilityBillable: false, tenantIds: [], propertyIds: [], issueIds: [], attachments: [] },
        documents: { category: 'Misc', type: 'document', published: false, cover: false, position: 0 }, contacts: {},
    };
    const item = validateEntity(name, input, data, existing || defaults[name]);
    if (name === 'documents' && data.leases.some(lease => lease.contractDocumentId === id) && (item.propertyId !== existing.propertyId || item.category !== 'Leases')) throw rentalError('Ein zugeordneter Mietvertrag muss bei seinem Mietverhältnis bleiben.', 409);
    item.id = existing?.id || randomUUID();
    item.createdAt = existing?.createdAt || new Date().toISOString();
    if (existing) Object.assign(existing, item);
    else data[name].push(item);
    return readEntities(data, name).find(row => row.id === item.id);
}
