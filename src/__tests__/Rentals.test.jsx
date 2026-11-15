import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Rentals from '../pages/Rentals';

const { data, workflow } = vi.hoisted(() => ({ data: {}, workflow: {} }));
vi.mock('../context/DataContext', () => ({ useData: () => data }));
vi.mock('../hooks/domain/useRentals', () => ({ useRentals: () => workflow }));
const lease = { id: 'l1', propertyId: 'p2', tenantIds: ['t1'], start: '2026-07-01', end: null, coldRentCents: 84000, utilitiesCents: 10000, depositCents: 252000, included: '', status: 'Active' };
function show(url = '/rentals?propertyId=p2') {
    return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/rentals" element={<Rentals />} /><Route path="/rentals/:id" element={<Rentals />} /></Routes></MemoryRouter>);
}
beforeEach(() => {
    Object.assign(data, { properties: [{ id: 'p2', name: 'OG rechts', coldRent: 840, nebenkosten: 100, moveInDate: '2026-07-01' }, { id: 'p3', name: 'EG rechts' }], tenants: [{ id: 't1', name: 'Sandy' }], documents: [], refreshAll: vi.fn() });
    Object.assign(workflow, { leases: [structuredClone(lease)], rentals: [], legacyTenants: [], loading: false, busy: false, error: '', message: '', save: vi.fn().mockResolvedValue({ id: 'saved' }) });
});

describe('Letting workspace', () => {
    it('starts with the active contract and hides unrelated tasks and apartment selectors', () => {
        show();
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mietverhältnis · OG rechts');
        expect(screen.getByText('Sandy')).toBeVisible();
        expect(screen.getByText('940,00 €')).toBeVisible();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.queryByText('Vorgänge')).not.toBeInTheDocument();
        expect(screen.queryByText('Bestandsmieter prüfen')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Neuvermietung', exact: true }));
        expect(screen.getByRole('button', { name: 'Neuvermietung starten' })).toBeVisible();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Historie', exact: true }));
        expect(screen.queryByText('Sandy')).not.toBeInTheDocument();
        expect(screen.getByText('Noch keine abgeschlossenen Mietverhältnisse oder Vermietungen.')).toBeVisible();
    });
    it('edits lease values through the dedicated endpoint and retains the form on failure', async () => {
        workflow.save.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'l1' });
        show();
        fireEvent.click(screen.getByRole('button', { name: 'Vertragsdaten bearbeiten' }));
        fireEvent.change(screen.getByLabelText('Kaltmiete (€ / Monat)'), { target: { value: '900.50' } });
        fireEvent.click(screen.getByRole('button', { name: 'Vertragsdaten speichern' }));
        await waitFor(() => expect(workflow.save).toHaveBeenCalledWith('/leases/l1', expect.objectContaining({ start: '2026-07-01', coldRent: '900.50', utilities: '100.00', contractDocumentId: '' }), 'PUT'));
        expect(screen.getByLabelText('Kaltmiete (€ / Monat)')).toHaveValue(900.5);
        fireEvent.click(screen.getByRole('button', { name: 'Vertragsdaten speichern' }));
        await waitFor(() => expect(screen.queryByLabelText('Kaltmiete (€ / Monat)')).not.toBeInTheDocument());
    });
    it('captures a missing existing contract on demand and keeps its apartment fixed', async () => {
        workflow.leases = [];
        workflow.legacyTenants = [{ id: 't1', name: 'Sandy', propertyId: 'p2', leaseStart: '2026-07-01' }, { id: 't2', name: 'Other tenant', propertyId: 'p3' }];
        show();
        fireEvent.click(screen.getByText('Bestehenden Mietvertrag erfassen'));
        expect(screen.getByRole('checkbox', { name: 'Sandy' })).toBeChecked();
        expect(screen.queryByText('Other tenant')).not.toBeInTheDocument();
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Mietbeginn')).toHaveValue('2026-07-01');
        fireEvent.change(screen.getByLabelText('Kaution (€)'), { target: { value: '2520' } });
        fireEvent.click(screen.getByRole('button', { name: 'Bestandsvertrag bestätigen' }));
        await waitFor(() => expect(workflow.save).toHaveBeenCalledWith('/leases/confirm', expect.objectContaining({ propertyId: 'p2', tenantIds: ['t1'] })));
    });
    it('shows all apartments from the main menu and keeps new lettings scoped to the selected apartment', async () => {
        const view = show('/rentals');
        expect(screen.getByRole('heading', { name: 'Wohnung auswählen' })).toBeVisible();
        expect(screen.getAllByRole('link', { name: 'Öffnen' }).map(link => link.getAttribute('href'))).toEqual(['/rentals?propertyId=p2', '/rentals?propertyId=p3']);
        view.unmount();
        show('/rentals?propertyId=p2&new=1');
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Bezeichnung')).toHaveValue('Neuvermietung OG rechts');
        fireEvent.click(screen.getByRole('button', { name: 'Vorgang speichern' }));
        await waitFor(() => expect(workflow.save).toHaveBeenCalledWith('', expect.objectContaining({ propertyId: 'p2' })));
    });
    it('shows one step of a letting at a time and locks completed records', () => {
        workflow.rentals = [{ id: 'r1', propertyId: 'p2', title: 'Neue Vermietung', phase: 'Inquiries', applications: [{ id: 'a1', parties: [{ name: 'Alex' }], status: 'Interested' }], viewings: [], selectedApplicationId: null }];
        const view = show('/rentals/r1');
        expect(screen.getByText('Alex')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Besichtigung hinzufügen' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Bezeichnung')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '3. Besichtigungen' }));
        expect(screen.getByRole('button', { name: 'Besichtigung hinzufügen' })).toBeVisible();
        expect(screen.queryByText('Alex')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Weiter zu Vertrag' })).toBeDisabled();
        view.unmount();
        workflow.rentals[0].phase = 'Completed';
        show('/rentals/r1');
        expect(screen.getByText('Vermietung abgeschlossen.')).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Abschließen und Mietverhältnis anlegen' })).not.toBeInTheDocument();
    });
});
