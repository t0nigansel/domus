import { describe, it, expect } from 'vitest';
import { propertyOverview } from '../domain/propertyOverview';
import { dossierUpdates, dossierValues } from '../domain/propertyDossier';

describe('Apartment overview sources', () => {
    const property = { id: 'p1', name: 'Wohnung', status: 'Occupied' };
    const tenants = [{ id: 't1', propertyId: 'p1', status: 'Active', name: 'Current tenant', leaseStart: '2026-01-01' }];
    it('prefers the active contract over legacy details and ignores planned contracts', () => {
        const leases = [
            { propertyId: 'p1', status: 'Planned', tenantIds: ['other'], start: '2027-01-01' },
            { propertyId: 'p1', status: 'Active', tenantIds: ['t1'], start: '2026-01-01', coldRentCents: 70050, utilitiesCents: 15000 },
        ];
        const result = propertyOverview({ ...property, tenantName: 'Old name', moveInDate: '2020-01-01', coldRent: 500 }, tenants, leases);
        expect(result.facts).toMatchObject({ tenantName: 'Current tenant', moveInDate: '2026-01-01', coldRent: 700.5, nebenkosten: 150 });
    });
    it('uses existing tenant data only when owner fields have not been set', () => {
        expect(propertyOverview(property, tenants, []).facts).toMatchObject({ tenantName: 'Current tenant', moveInDate: '2026-01-01' });
        const result = propertyOverview({ ...property, tenantName: '', moveInDate: null }, tenants, []);
        expect(result.facts).toMatchObject({ tenantName: '', moveInDate: null });
        expect(result.missing).toContain('moveInDate');
    });
    it('keeps unknown money distinct from zero and residents distinct from tenants', () => {
        const result = propertyOverview({ ...property, coldRent: 0, nebenkosten: null }, [], []);
        expect(result.missing).not.toContain('coldRent');
        expect(result.missing).toContain('nebenkosten');
        expect(propertyOverview({ ...property, occupancyKind: 'Usufruct' }, [], []).missing).toEqual(['size']);
    });
    it('saves only fields belonging to the edited section', () => {
        const values = dossierValues({ ...property, size: 67.76, coldRent: 700 });
        expect(dossierUpdates({ ...values, heating: 'Gas' }, property, ['heating'])).toEqual({ heating: 'Gas' });
        expect(dossierUpdates(values, { ...property, leaseManaged: true }, ['tenantName', 'coldRent', 'status', 'occupants', 'size'])).toEqual({ size: 67.76 });
    });
});
