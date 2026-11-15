import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PropertyDetails from '../pages/PropertyDetails';

const { data, workflow } = vi.hoisted(() => ({ data: {}, workflow: { leases: [], rentals: [], legacyTenants: [], loading: false, error: '' } }));
vi.mock('../context/DataContext', () => ({ useData: () => data }));
vi.mock('../hooks/domain/useRentals', () => ({ useRentals: () => workflow }));
vi.mock('../pages/DocumentWorkspace', () => ({ default: ({ categoryFilter }) => <div>{`Files: ${categoryFilter}`}</div> }));

function renderPage(url = '/properties/p1') {
    return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/properties/:id" element={<PropertyDetails />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
    Object.assign(data, {
        properties: [{ id: 'p1', name: 'OG rechts', status: 'Occupied', tenantName: 'Sandy', moveInDate: '2026-07-01', size: 88.23, rooms: 5, coldRent: null, nebenkosten: null, notes: 'Alter Importhinweis', importReview: [{ label: 'Wohnfläche', value: 88.23, unit: 'm²', sourceDocumentId: 'd1', sourceDate: '2023-04-12' }] }],
        tenants: [], documents: [{ id: 'd1', propertyId: 'p1', category: 'Photos', name: 'Wohnzimmer.jpg' }],
        issues: [{ id: 'i1', propertyId: 'p1', title: 'Heizung prüfen', description: '', status: 'Open', priority: 'High' }],
        updateProperty: vi.fn(async (id, values) => ({ ...data.properties[0], ...values, id })), refreshAll: vi.fn(), resolveIssue: vi.fn(), addIssue: vi.fn(),
    });
    workflow.leases = [];
    workflow.rentals = [];
    workflow.save = vi.fn().mockResolvedValue({ id: 'l1' });
});

describe('Apartment page structure', () => {
    it('manages the selected apartment lease directly in its letting tab', async () => {
        workflow.leases = [
            { id: 'l1', propertyId: 'p1', tenantIds: ['t1'], start: '2026-07-01', end: null, coldRentCents: 84000, utilitiesCents: 10000, depositCents: 252000, status: 'Active' },
            { id: 'l2', propertyId: 'p2', tenantIds: ['t2'], start: '2026-07-01', coldRentCents: 50000, utilitiesCents: 10000, status: 'Active' },
        ];
        data.tenants = [{ id: 't1', name: 'Sandy' }, { id: 't2', name: 'Andere Wohnung' }];
        renderPage();
        fireEvent.click(screen.getByRole('button', { name: 'Mietverhältnis verwalten' }));
        const panel = within(screen.getByRole('tabpanel', { name: 'Vermietung' }));
        expect(panel.getByText('Sandy')).toBeVisible();
        expect(panel.queryByText('Andere Wohnung')).not.toBeInTheDocument();
        fireEvent.click(panel.getByRole('button', { name: 'Vertragsdaten bearbeiten' }));
        fireEvent.change(panel.getByLabelText('Kaltmiete (€ / Monat)'), { target: { value: '900' } });
        fireEvent.click(panel.getByRole('button', { name: 'Vertragsdaten speichern' }));
        await waitFor(() => expect(workflow.save).toHaveBeenCalledWith('/leases/l1', expect.objectContaining({ coldRent: '900' }), 'PUT'));
    });

    it('opens new lettings from a direct apartment link with the apartment already selected', () => {
        renderPage('/properties/p1?tab=rental&new=1');
        const panel = within(screen.getByRole('tabpanel', { name: 'Vermietung' }));
        expect(panel.getByLabelText('Bezeichnung')).toHaveValue('Neuvermietung OG rechts');
        expect(panel.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('edits and reloads the complete occupancy description below the key facts', async () => {
        Object.assign(data.properties[0], { occupancyKind: 'Usufruct', residents: [{ name: 'Vater des Eigentümers', role: 'UsufructResident' }] });
        const view = renderPage();
        const section = screen.getByRole('region', { name: 'Belegung und Eckdaten' });
        expect(within(section).getByText(/Bewohner mit Nießbrauch, kein Mieter/)).toBeVisible();
        fireEvent.click(within(section).getByRole('button', { name: 'Bearbeiten' }));
        expect(within(section).getByLabelText('Belegungstext')).toHaveValue('Bewohner mit Nießbrauch, kein Mieter\nVater des Eigentümers');
        fireEvent.change(within(section).getByLabelText('Belegungstext'), { target: { value: 'Private Nutzung\nFamilienangehöriger' } });
        fireEvent.click(within(section).getByRole('button', { name: 'Stammdaten speichern' }));
        await waitFor(() => expect(data.updateProperty).toHaveBeenCalledWith('p1', expect.objectContaining({ occupancyNote: 'Private Nutzung\nFamilienangehöriger' })));
        const updates = data.updateProperty.mock.calls[0][1];
        expect(updates).not.toHaveProperty('residents');
        expect(updates).not.toHaveProperty('occupancyKind');
        view.unmount();
        Object.assign(data.properties[0], updates);
        renderPage();
        expect(within(screen.getByRole('region', { name: 'Belegung und Eckdaten' })).getByText(/Private Nutzung/)).toBeVisible();
    });
    it('shows current facts and action items first, and separates files and historical information', () => {
        renderPage();
        expect(screen.getAllByRole('tab')).toHaveLength(5);
        expect(screen.getByRole('tabpanel', { name: /Übersicht/ })).toBeVisible();
        expect(screen.getByText('Sandy')).toBeVisible();
        expect(screen.getByText('Mieter erfasst · Mietvertrag noch nicht zugeordnet')).toBeVisible();
        expect(screen.getByText('Heizung prüfen')).toBeVisible();
        expect(screen.getByText('Alter Importhinweis')).not.toBeVisible();
        expect(screen.queryByText('Files: Photos')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Fotos & Dokumente' }));
        expect(screen.getByText('Files: Photos')).toBeVisible();
        expect(screen.queryByText('Files: Leases')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
        expect(screen.getByText('Alter Importhinweis')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Quelle ansehen' })).toBeVisible();
    });
    it('opens only the selected section for editing and saves only that section', async () => {
        renderPage();
        fireEvent.click(screen.getByRole('tab', { name: 'Wohnungsdaten' }));
        const energy = screen.getByRole('region', { name: 'Heizung und Energie' });
        fireEvent.click(within(energy).getByRole('button', { name: 'Bearbeiten' }));
        fireEvent.change(within(energy).getByLabelText('Heizungsart'), { target: { value: 'Wärmepumpe' } });
        fireEvent.click(within(energy).getByRole('button', { name: 'Stammdaten speichern' }));
        await waitFor(() => expect(data.updateProperty).toHaveBeenCalledWith('p1', { heating: 'Wärmepumpe', energyRating: '', energyDemand: null }));
        expect(within(energy).queryByRole('textbox')).not.toBeInTheDocument();
    });
    it('supports keyboard navigation and cancel without saving', () => {
        renderPage();
        fireEvent.keyDown(screen.getByRole('tab', { name: /Übersicht/ }), { key: 'ArrowRight' });
        const tab = screen.getByRole('tab', { name: 'Wohnungsdaten' });
        expect(tab).toHaveAttribute('aria-selected', 'true');
        expect(tab).toHaveFocus();
        const section = screen.getByRole('region', { name: 'Bezeichnung und Adresse' });
        fireEvent.click(within(section).getByRole('button', { name: 'Bearbeiten' }));
        fireEvent.change(within(section).getByLabelText('Bezeichnung'), { target: { value: 'Changed' } });
        fireEvent.click(within(section).getByRole('button', { name: 'Abbrechen' }));
        expect(data.updateProperty).not.toHaveBeenCalled();
        fireEvent.click(within(section).getByRole('button', { name: 'Bearbeiten' }));
        expect(within(section).getByLabelText('Bezeichnung')).toHaveValue('OG rechts');
    });
});
