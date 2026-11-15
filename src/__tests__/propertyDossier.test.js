import { describe, it, expect } from 'vitest';
import { dossierUpdates, dossierValues } from '../domain/propertyDossier';
import { changeEntity } from '../../server/cloud/entities';

describe('Wohnungsakte', () => {
    it('persists edited or cleared occupancy text without replacing historical residents', () => {
        const property = { id: 'p1', name: 'Wohnung', occupancyKind: 'Usufruct', residents: [{ name: 'Vater des Eigentümers', role: 'UsufructResident' }] };
        expect(dossierValues(property).occupancyNote).toBe('Bewohner mit Nießbrauch, kein Mieter\nVater des Eigentümers');
        const data = { properties: [property], tenants: [], leases: [] };
        const updates = dossierUpdates({ occupancyNote: ' Private Nutzung\nFamilie ' }, property, ['occupancyNote']);
        const saved = changeEntity(data, 'properties', 'PUT', 'p1', updates);
        expect(dossierValues(saved).occupancyNote).toBe('Private Nutzung\nFamilie');
        const cleared = changeEntity(data, 'properties', 'PUT', 'p1', { occupancyNote: '' });
        expect(dossierValues(cleared).occupancyNote).toBe('');
        expect(cleared.residents).toEqual(property.residents);
        expect(dossierValues({ occupancyKind: 'NonRental', residents: [{ name: 'Bewohnerin' }] }).occupancyNote).toBe('Bewohner, kein Mietverhältnis\nBewohnerin');
    });
    it('keeps unknown values empty and preserves the existing area field', () => {
        const values = dossierValues({ name: 'Wohnung', status: 'Vacant', size: 74.5 });
        expect(values.size).toBe(74.5);
        expect(values.rooms).toBe('');
        const updates = dossierUpdates(values);
        expect(updates.size).toBe(74.5);
        expect(updates.rooms).toBeNull();
        expect(updates.coldRent).toBeNull();
        expect(updates.moveInDate).toBeNull();
    });
    it('rejects invalid dimensions instead of storing invalid numbers', () => {
        expect(() => dossierUpdates({ ...dossierValues({ name: 'Wohnung', status: 'Vacant' }), size: '-1' })).toThrow();
        expect(() => dossierUpdates({ ...dossierValues({ name: 'Wohnung', status: 'Vacant' }), rooms: 'not a number' })).toThrow();
    });
    it('prefills only confirmed tenants and respects an explicitly cleared name', () => {
        const residents = [{ name: 'Stephanie Dicle', role: 'Tenant' }, { name: 'Bewohnerin', role: 'Resident' }];
        expect(dossierValues({ name: 'Wohnung', status: 'Vacant', residents }).tenantName).toBe('Stephanie Dicle');
        expect(dossierValues({ name: 'Wohnung', status: 'Vacant', residents, tenantName: '' }).tenantName).toBe('');
        expect(dossierValues({ name: 'Wohnung', status: 'Vacant', importReview: [{ value: 67.76 }] }).size).toBe('');
    });
    it('persists and reloads all requested fields through the cloud entity boundary', () => {
        const data = { properties: [{ id: 'p1', name: 'Wohnung' }], tenants: [], leases: [] };
        const values = { ...dossierValues({ name: 'Wohnung', status: 'Vacant' }), tenantName: ' Stephanie Dicle ', moveInDate: '2026-09-01', coldRent: '650.50', nebenkosten: '150', size: '67.76', condition: 'Ok', pets: 'Eine Katze' };
        const saved = changeEntity(data, 'properties', 'PUT', 'p1', dossierUpdates(values));
        expect(saved).toMatchObject({ tenantName: 'Stephanie Dicle', moveInDate: '2026-09-01', coldRent: 650.5, nebenkosten: 150, size: 67.76, condition: 'Ok', pets: 'Eine Katze' });
        expect(dossierValues(saved)).toMatchObject({ tenantName: 'Stephanie Dicle', moveInDate: '2026-09-01', coldRent: 650.5 });
        const cleared = changeEntity(data, 'properties', 'PUT', 'p1', dossierUpdates(dossierValues({ name: 'Wohnung', status: 'Vacant' })));
        expect(cleared).toMatchObject({ tenantName: '', moveInDate: null, coldRent: null, condition: '' });
    });
    it('rejects invalid dates, money and condition on both boundaries', () => {
        for (const fields of [{ moveInDate: '2026-02-30' }, { coldRent: '-1' }, { nebenkosten: '1.234' }, { condition: 'invalid' }]) {
            expect(() => dossierUpdates({ ...dossierValues({ name: 'Wohnung', status: 'Vacant' }), ...fields })).toThrow();
            expect(() => changeEntity({ properties: [{ id: 'p1', name: 'Wohnung' }], leases: [] }, 'properties', 'PUT', 'p1', fields)).toThrow();
        }
    });
    it('keeps lease-managed data out of property updates', () => {
        const updates = dossierUpdates(dossierValues({ name: 'Wohnung', status: 'Vacant', coldRent: 800 }), { leaseManaged: true });
        for (const key of ['tenantName', 'moveInDate', 'coldRent', 'nebenkosten']) expect(updates).not.toHaveProperty(key);
        expect(updates).toHaveProperty('size');
    });
});
