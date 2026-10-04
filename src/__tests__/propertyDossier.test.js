import { describe, it, expect } from 'vitest';
import { dossierUpdates, dossierValues } from '../domain/propertyDossier';

describe('Wohnungsakte', () => {
    it('keeps unknown values empty and preserves the existing area field', () => {
        const values = dossierValues({ size: 74.5 });
        expect(values.size).toBe(74.5);
        expect(values.rooms).toBe('');
        const updates = dossierUpdates(values);
        expect(updates.size).toBe(74.5);
        expect(updates.rooms).toBeNull();
        expect(updates).not.toHaveProperty('coldRent');
    });
    it('rejects invalid dimensions instead of storing invalid numbers', () => {
        expect(() => dossierUpdates({ ...dossierValues({}), size: '-1' })).toThrow();
        expect(() => dossierUpdates({ ...dossierValues({}), rooms: 'not a number' })).toThrow();
    });
});
