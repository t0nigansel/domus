import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Properties from '../pages/Properties';
import { ToastProvider } from '../components/common';

const { data, workflow } = vi.hoisted(() => ({ data: {}, workflow: { leases: [], rentals: [], legacyTenants: [], loading: false, error: '' } }));
vi.mock('../context/DataContext', () => ({ useData: () => data }));
vi.mock('../hooks/domain/useRentals', () => ({ useRentals: () => workflow }));
vi.mock('../pages/DocumentWorkspace', () => ({ default: () => <div>Dateiliste</div> }));

function Location() {
    const location = useLocation(), navigate = useNavigate();
    return <><output aria-label="Route">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Zurück im Browser</button></>;
}
function show(url = '/properties') {
    return render(<MemoryRouter initialEntries={[url]}><ToastProvider><Location /><Routes>
        <Route path="/properties" element={<Properties />} />
        <Route path="/properties/:id" element={<Properties />} />
    </Routes></ToastProvider></MemoryRouter>);
}
const row = name => screen.getByRole('heading', { name, level: 3 }).closest('.list-row');
beforeEach(() => {
    Object.assign(data, {
        properties: ['OG rechts', 'EG links'].map((name, index) => ({ id: `p${index + 1}`, name, status: 'Vacant', location: 'Berlin', size: 60, rooms: 2, coldRent: 700, nebenkosten: 100 })),
        tenants: [], issues: [], documents: [], addProperty: vi.fn(), refreshAll: vi.fn(),
        updateProperty: vi.fn(async (id, updates) => ({ ...data.properties.find(property => property.id === id), ...updates })),
    });
});
describe('Apartments in the shared overview', () => {
    it('expands and collapses the apartment in place while keeping the overview and other rows mounted', () => {
        show();
        const heading = screen.getByRole('heading', { name: 'Wohnungen', level: 1 });
        const first = row('OG rechts'), second = row('EG links');
        fireEvent.click(within(first).getByRole('heading', { name: 'OG rechts' }));
        expect(screen.getByRole('heading', { name: 'Wohnungen', level: 1 })).toBe(heading);
        expect(row('OG rechts')).toBe(first);
        expect(row('EG links')).toBe(second);
        expect(within(first).getByRole('tab', { name: 'Wohnungsdaten' })).toBeVisible();
        expect(within(first).getByRole('button', { name: 'Zuklappen' })).toHaveAttribute('aria-expanded', 'true');
        expect(first.querySelector('.property-details-inline')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Zurück zu Wohnungen' })).not.toBeInTheDocument();
        fireEvent.click(within(first).getByRole('button', { name: 'Zuklappen' }));
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Route')).toHaveTextContent('/properties');
    });
    it('opens just one row at a time and restores the selection with browser back', () => {
        show();
        fireEvent.click(within(row('OG rechts')).getByRole('heading'));
        fireEvent.click(within(row('EG links')).getByRole('heading'));
        expect(within(row('OG rechts')).queryByRole('tablist')).not.toBeInTheDocument();
        expect(within(row('EG links')).getByRole('tablist')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Zurück im Browser' }));
        expect(within(row('OG rechts')).getByRole('tablist')).toBeVisible();
    });
    it('opens direct links at the selected tab and edits only that apartment in the overview', async () => {
        show('/properties/p2?tab=data');
        expect(screen.getByRole('heading', { name: 'Wohnungen', level: 1 })).toBeVisible();
        expect(within(row('OG rechts')).queryByRole('tablist')).not.toBeInTheDocument();
        const apartment = row('EG links');
        const section = within(apartment).getByRole('region', { name: 'Heizung und Energie' });
        fireEvent.click(within(section).getByRole('button', { name: 'Bearbeiten' }));
        fireEvent.change(within(section).getByLabelText('Heizungsart'), { target: { value: 'Fernwärme' } });
        fireEvent.click(within(section).getByRole('button', { name: 'Stammdaten speichern' }));
        await waitFor(() => expect(data.updateProperty).toHaveBeenCalledWith('p2', { heating: 'Fernwärme', energyRating: '', energyDemand: null }));
        expect(screen.getByLabelText('Route')).toHaveTextContent('/properties/p2?tab=data');
    });
});
