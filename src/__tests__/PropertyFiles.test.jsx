import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import PropertyFiles from '../components/PropertyFiles';

const { data, workspace } = vi.hoisted(() => ({ data: {}, workspace: { rawFiles: null, upload: vi.fn(), update: vi.fn() } }));
vi.mock('../context/DataContext', () => ({ useData: () => data }));
vi.mock('../hooks/domain/useFileWorkspace', () => ({ useFileWorkspace: () => workspace }));

beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(data, { properties: [{ id: 'p1', name: 'Wohnung' }], documents: [
        { id: 'house-photo', buildingId: 'b1', name: 'Haus.jpg', category: 'Photos', type: 'image', hasFile: true },
        { id: 'house-invoice', buildingId: 'b1', name: 'Hausrechnung.pdf', category: 'Invoices', type: 'pdf', hasFile: true },
        { id: 'other-house', buildingId: 'b2', name: 'Anderes Haus.jpg', category: 'Photos', type: 'image', hasFile: true },
        { id: 'apartment', propertyId: 'p1', name: 'Wohnung.jpg', category: 'Photos', type: 'image', hasFile: true },
    ] });
});
describe('Shared apartment and building files', () => {
    it('shows only the selected building, with a photo gallery and searchable category groups', () => {
        render(<PropertyFiles building={{ id: 'b1' }} />);
        expect(screen.getByRole('heading', { name: 'Fotos & Dokumente (2)' })).toBeVisible();
        expect(screen.getByRole('img', { name: 'Haus.jpg' })).toBeVisible();
        expect(screen.getByText('Hausrechnung.pdf')).toBeVisible();
        expect(screen.queryByText('Anderes Haus.jpg')).not.toBeInTheDocument();
        expect(screen.queryByText('Wohnung.jpg')).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Hausrechnung' } });
        expect(screen.queryByRole('img', { name: 'Haus.jpg' })).not.toBeInTheDocument();
        expect(screen.getByText('Hausrechnung.pdf')).toBeVisible();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: /^Fotos/ }));
        expect(screen.getByRole('img', { name: 'Haus.jpg' })).toBeVisible();
        expect(screen.queryByText('Hausrechnung.pdf')).not.toBeInTheDocument();
    });
    it('uploads to the building and keeps that assignment when editing a photo', () => {
        const view = render(<PropertyFiles building={{ id: 'b1' }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Dateien hinzufügen' }));
        const file = new File(['fixture'], 'haus.pdf', { type: 'application/pdf' });
        fireEvent.change(screen.getByLabelText('Dateien hochladen (bis 20 MB je Datei)'), { target: { files: [file] } });
        expect(workspace.upload).toHaveBeenCalledWith([file], { propertyId: null, buildingId: 'b1', category: 'Misc' });
        expect(screen.queryByLabelText('Wohnung für neue Dateien')).not.toBeInTheDocument();
        const photo = view.container.querySelector('.property-photo');
        fireEvent.click(within(photo).getByRole('button', { name: 'Bearbeiten' }));
        expect(within(photo).queryByLabelText('Wohnungszuordnung')).not.toBeInTheDocument();
        fireEvent.change(within(photo).getByLabelText('Dokumentname'), { target: { value: 'Hausansicht' } });
        fireEvent.click(within(photo).getByRole('button', { name: 'Speichern' }));
        expect(workspace.update).toHaveBeenCalledWith('house-photo', expect.objectContaining({ name: 'Hausansicht.jpg', buildingId: 'b1' }));
    });
    it('continues to scope apartment files and uploads to the apartment', () => {
        render(<PropertyFiles property={{ id: 'p1' }} />);
        expect(screen.getByRole('img', { name: 'Wohnung.jpg' })).toBeVisible();
        expect(screen.queryByText('Haus.jpg')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Dateien hinzufügen' }));
        const file = new File(['fixture'], 'wohnung.pdf');
        fireEvent.change(screen.getByLabelText('Dateien hochladen (bis 20 MB je Datei)'), { target: { files: [file] } });
        expect(workspace.upload).toHaveBeenCalledWith([file], { propertyId: 'p1', buildingId: null, category: 'Misc' });
    });
});
