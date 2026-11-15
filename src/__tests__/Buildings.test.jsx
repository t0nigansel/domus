import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import Properties from '../pages/Properties';
import { ToastProvider } from '../components/common';

const { data, buildings } = vi.hoisted(() => ({ data: {}, buildings: [{ id: 'b1', name: 'Testhaus', street: 'Testweg 1' }, { id: 'b2', name: 'Zweites Haus' }] }));
vi.mock('../context/DataContext', () => ({ useData: () => data }));
vi.mock('../context/CloudAuthContext', () => ({ useCloudAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../hooks/useAssistant', () => ({ useAssistant: path => ({ data: path === '/buildings' ? buildings : buildings.find(building => path === `/buildings/${building.id}`), refresh: vi.fn(), error: '', busy: false }) }));
vi.mock('../hooks/domain/useRentals', () => ({ useRentals: () => ({ leases: [], rentals: [], legacyTenants: [], loading: false, error: '' }) }));
vi.mock('../components/PropertyFiles', () => ({ default: ({ building }) => <section aria-label="Hausdateien">{building?.id}</section> }));

function Back() { const navigate = useNavigate(); return <button onClick={() => navigate(-1)}>Browser zurück</button>; }
function show(path = '/properties') {
    return render(<MemoryRouter initialEntries={[path]}><ToastProvider><Back /><Routes>
        {['/properties', '/properties/:id', '/buildings/:id'].map(path => <Route key={path} path={path} element={<Properties />} />)}
    </Routes></ToastProvider></MemoryRouter>);
}
const row = name => screen.getByRole('heading', { name, level: 3 }).closest('.list-row');
beforeEach(() => Object.assign(data, { properties: [{ id: 'p1', name: 'EG rechts', status: 'Vacant' }], tenants: [], documents: [], issues: [], costs: [], refreshAll: vi.fn(), updateProperty: vi.fn() }));

describe('Buildings in the apartment overview', () => {
    it('opens and closes in place while retaining the overview and apartment rows', () => {
        show();
        const heading = screen.getByRole('heading', { name: 'Wohnungen', level: 1 }), building = row('Testhaus'), apartment = row('EG rechts');
        fireEvent.click(within(building).getByRole('heading', { name: 'Testhaus' }));
        expect(screen.getByRole('heading', { name: 'Wohnungen', level: 1 })).toBe(heading);
        expect(row('EG rechts')).toBe(apartment);
        expect(within(building).getByRole('region', { name: 'Hausdateien' })).toHaveTextContent('b1');
        expect(building.querySelector('.page-container')).toBeNull();
        expect(screen.queryByText('Wohnung nicht gefunden.')).not.toBeInTheDocument();
        fireEvent.click(within(building).getByRole('button', { name: 'Zuklappen' }));
        expect(screen.queryByRole('region', { name: 'Hausdateien' })).not.toBeInTheDocument();
    });
    it('supports direct house links and browser back, with only one building or apartment expanded', () => {
        show('/buildings/b1');
        expect(within(row('Testhaus')).getByRole('button', { name: 'Hausdaten bearbeiten' })).toBeVisible();
        fireEvent.click(within(row('Zweites Haus')).getByRole('heading'));
        expect(within(row('Testhaus')).queryByRole('region', { name: 'Hausdateien' })).not.toBeInTheDocument();
        expect(within(row('Zweites Haus')).getByRole('region', { name: 'Hausdateien' })).toHaveTextContent('b2');
        fireEvent.click(screen.getByRole('button', { name: 'Browser zurück' }));
        expect(within(row('Testhaus')).getByRole('region', { name: 'Hausdateien' })).toHaveTextContent('b1');
        fireEvent.click(within(row('EG rechts')).getByRole('heading'));
        expect(screen.queryByRole('region', { name: 'Hausdateien' })).not.toBeInTheDocument();
        expect(within(row('EG rechts')).getByRole('tab', { name: 'Wohnungsdaten' })).toBeVisible();
    });
    it('identifies a missing building without confusing it with an apartment', () => {
        show('/buildings/missing');
        expect(screen.getByRole('alert')).toHaveTextContent('Haus nicht gefunden.');
        expect(screen.queryByText('Wohnung nicht gefunden.')).not.toBeInTheDocument();
    });
});
