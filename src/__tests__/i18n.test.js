import { afterEach, describe, expect, it } from 'vitest';
import { getLanguage, getLocale, setLanguage, translate } from '../i18n';

afterEach(() => setLanguage('de'));

describe('UI language selection', () => {
    it('translates the existing mixed German and English labels', () => {
        expect(translate('Properties', {}, 'de')).toBe('Wohnungen');
        expect(translate('Vermietungen', {}, 'en')).toBe('Rentals');
        expect(translate('Abmelden', {}, 'en')).toBe('Sign out');
        expect(translate('Rejected', {}, 'en')).toBe('Rejected');
        expect(translate('Cancelled', {}, 'en')).toBe('Cancelled');
    });

    it('preserves names and zero values when interpolating translated messages', () => {
        expect(translate('Kontomenü für {name}', { name: 'Properties' }, 'de')).toBe('Kontomenü für Properties');
        expect(translate('{count} total units', { count: 0 }, 'de')).toBe('0 Einheiten insgesamt');
        expect(translate('My existing property name', {}, 'de')).toBe('My existing property name');
    });

    it('translates server validation messages containing variable field labels', () => {
        expect(translate('Mietbeginn: ungültiges Datum.', {}, 'en')).toBe('Lease Start: invalid date.');
        expect(translate('Zeitraum überschneidet sich mit Mietverhältnis 2027-01-01 bis 2027-12-31. Zuerst den bestehenden Zeitraum prüfen.', {}, 'en'))
            .toBe('The dates overlap with a tenancy from 2027-01-01 to 2027-12-31. Please review the existing dates first.');
        expect(translate('Zeitraum überschneidet sich mit Mietverhältnis 2027-01-01 bis unbefristet. Zuerst den bestehenden Zeitraum prüfen.', {}, 'en'))
            .toBe('The dates overlap with a tenancy from 2027-01-01 to open-ended. Please review the existing dates first.');
    });

    it('persists a valid choice and updates the document language and locale', () => {
        setLanguage('en');
        expect(getLanguage()).toBe('en');
        expect(getLocale()).toBe('en-GB');
        expect(document.documentElement.lang).toBe('en');
        expect(localStorage.getItem('domus-language')).toBe('en');
        setLanguage('fr');
        expect(getLanguage()).toBe('en');
    });
});
