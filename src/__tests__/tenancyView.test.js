import { describe, expect, it } from 'vitest';
import { tenancyView } from '../domain/rentals';

describe('Lease-backed property occupancy', () => {
    it.each(['NonRental', 'Usufruct'])('uses an active lease over the legacy %s classification without changing stored data', occupancyKind => {
        const property = { id: 'p1', occupancyKind, status: 'Occupied', coldRent: 0, nebenkosten: 0 };
        const data = {
            properties: [property],
            tenants: [{ id: 't1', name: 'Test tenant' }],
            leases: [{ id: 'l1', propertyId: 'p1', tenantIds: ['t1'], start: '2026-07-01', end: '2026-12-31', coldRentCents: 84000, utilitiesCents: 10000 }],
        };

        expect(tenancyView(data, '2026-06-30').properties[0].occupancyKind).toBe(occupancyKind);
        expect(tenancyView(data, '2026-11-15').properties[0]).toMatchObject({
            occupancyKind: 'Rental', status: 'Occupied', occupants: 1, coldRent: 840, nebenkosten: 100,
        });
        expect(tenancyView(data, '2027-01-01').properties[0].occupancyKind).toBe(occupancyKind);
        expect(property).toEqual({ id: 'p1', occupancyKind, status: 'Occupied', coldRent: 0, nebenkosten: 0 });
    });
});
