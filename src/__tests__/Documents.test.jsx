import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Documents from '../pages/Documents';
import { documentInUploadRange } from '../domain/documents';

vi.mock('../context/DataContext', () => ({
    useData: () => ({
        properties: [],
        documents: [
            { id: '1', name: 'Januar.pdf', category: 'Invoices', date: '2026-01-31' },
            { id: '2', name: 'Februar.pdf', category: 'Invoices', date: '2026-02-01' },
            { id: '3', name: 'Ende Februar.pdf', category: 'Invoices', createdAt: new Date(2026, 1, 28, 23, 59, 59).toISOString(), date: '2020-01-01' },
            { id: '4', name: 'Foto.jpg', category: 'Photos', date: '2026-02-15' },
            { id: '5', name: 'Unbekannt.pdf', category: 'Invoices' },
        ],
    }),
}));
vi.mock('../hooks/domain/useFileWorkspace', () => ({ useFileWorkspace: () => ({ rawFiles: null }) }));

describe('Document upload date filter', () => {
    it('closes an upload panel without uploading a document', () => {
        render(<MemoryRouter><Documents /></MemoryRouter>);
        fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
        expect(screen.getByLabelText('Dateien hochladen (bis 20 MB je Datei)')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
        expect(screen.queryByLabelText('Dateien hochladen (bis 20 MB je Datei)')).not.toBeInTheDocument();
    });
    it('combines inclusive dates with categories and search, and resets only the dates', () => {
        render(<MemoryRouter><Documents /></MemoryRouter>);
        expect(screen.getByText('Unbekannt.pdf')).toBeVisible();
        fireEvent.change(screen.getByLabelText('Hochgeladen von'), { target: { value: '2026-02-01' } });
        expect(screen.queryByText('Januar.pdf')).not.toBeInTheDocument();
        expect(screen.queryByText('Unbekannt.pdf')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Hochgeladen bis'), { target: { value: '2026-02-28' } });
        expect(screen.getByText('Februar.pdf')).toBeVisible();
        expect(screen.getByText('Ende Februar.pdf')).toBeVisible();
        const category = within(screen.getByRole('group', { name: 'Kategorien' })).getByRole('button', { name: /Rechnungen/ });
        expect(category).toHaveTextContent('2');
        fireEvent.click(category);
        expect(screen.queryByText('Foto.jpg')).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Januar' } });
        expect(screen.queryByText('Februar.pdf')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Zeitraum zurücksetzen' }));
        expect(screen.getByText('Januar.pdf')).toBeVisible();
        expect(screen.getByRole('searchbox')).toHaveValue('Januar');
        expect(category).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('Hochgeladen von')).toHaveValue('');
        expect(screen.getByLabelText('Hochgeladen bis')).toHaveValue('');
    });

    it('supports an upper bound alone and excludes missing dates only with an active range', () => {
        expect(documentInUploadRange({ date: '2026-02-28' }, '', '2026-02-28')).toBe(true);
        expect(documentInUploadRange({ date: '2026-03-01' }, '', '2026-02-28')).toBe(false);
        expect(documentInUploadRange({}, '', '2026-02-28')).toBe(false);
        expect(documentInUploadRange({})).toBe(true);
        expect(documentInUploadRange({ createdAt: 'invalid', date: '2026-02-28' }, '2026-02-28', '2026-02-28')).toBe(true);
    });
});
