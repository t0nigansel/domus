import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PropertyDossier from '../pages/PropertyDossier';

const { updateProperty } = vi.hoisted(() => ({ updateProperty: vi.fn() }));
vi.mock('../context/DataContext', () => ({ useData: () => ({ updateProperty }) }));
vi.mock('../pages/DocumentWorkspace', () => ({ default: () => null }));

describe('Editable apartment dossier', () => {
    it('saves all requested fields and shows a confirmation', async () => {
        updateProperty.mockImplementation(async (id, values) => ({ id, ...values }));
        render(<PropertyDossier property={{ id: 'p1', name: 'Wohnung', status: 'Occupied', residents: [{ name: 'Stephanie Dicle', role: 'Tenant' }] }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
        expect(screen.getByLabelText('Mieter')).toHaveValue('Stephanie Dicle');
        for (const [label, value] of [
            ['Mieter', 'Neue Mieterin'], ['Einzugsdatum', '2026-10-01'],
            ['Kaltmiete (€ / Monat)', '700.50'], ['Nebenkosten (€ / Monat)', '180'],
            ['Wohnfläche (m²)', '67.76'], ['Zustand', 'Renovated'], ['Haustiere', 'Eine Katze'],
        ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
        fireEvent.click(screen.getByRole('button', { name: 'Stammdaten speichern' }));
        await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Stammdaten gespeichert.'));
        expect(updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ tenantName: 'Neue Mieterin', moveInDate: '2026-10-01', coldRent: 700.5, nebenkosten: 180, size: 67.76, condition: 'Renovated', pets: 'Eine Katze' }));
    });

    it('retains entered values and displays a failed save', async () => {
        updateProperty.mockRejectedValueOnce(new Error('Speichern fehlgeschlagen'));
        render(<PropertyDossier property={{ id: 'p1', name: 'Wohnung', status: 'Occupied' }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
        fireEvent.change(screen.getByLabelText('Mieter'), { target: { value: 'Neue Mieterin' } });
        fireEvent.click(screen.getByRole('button', { name: 'Stammdaten speichern' }));
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Speichern fehlgeschlagen'));
        expect(screen.getByLabelText('Mieter')).toHaveValue('Neue Mieterin');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
