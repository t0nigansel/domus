// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createDomusMcp } from '../mcp/tools.js';

const fixtures = {
    '/properties': [{ id: 'p1', name: 'EG', status: 'Vacant' }, { id: 'p2', name: 'OG', status: 'Occupied' }],
    '/buildings': [], '/tenants': [{ id: 't1', name: 'Test', propertyId: 'p2', status: 'Active' }],
    '/rentals': { leases: [{ id: 'l1', propertyId: 'p2', tenantIds: ['t1'], status: 'Active', end: '2026-12-31', coldRentCents: 80000 }] },
    '/costs': [{ id: 'c1', propertyIds: ['p2'], dueDate: '2026-01-01', amount: 10.29 }, { id: 'c2', propertyIds: ['p1', 'p2'], dueDate: '2026-02-01', amount: 100 }, { id: 'c3', propertyIds: ['p2'], dueDate: '2025-01-01', amount: 5 }, { id: 'unknown', propertyIds: ['p2'], dueDate: '2027-01-01', amount: null }],
    '/issues': [{ id: 'i1', propertyId: 'p2', status: 'Open', createdAt: '2026-11-01' }, { id: 'i2', propertyId: 'p2', status: 'Closed' }],
    '/documents': [{ id: 'd1', propertyId: 'p2', name: 'Vertrag.pdf', category: 'Leases', hasFile: true }],
};
async function rpc(method, params = {}) {
    const handler = createDomusMcp({ today: '2026-11-15', read: async path => {
        expect(Object.hasOwn(fixtures, path)).toBe(true);
        return structuredClone(fixtures[path]);
    }, readDocument: async id => ({ documentId: id, pages: [{ page: 1, text: 'Untrusted lease text' }] }) });
    const response = await handler.fetch(new Request('https://domus.example/mcp', { method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
    }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }));
    const text = await response.text();
    return JSON.parse(text.startsWith('event:') ? text.split('\n').find(line => line.startsWith('data:')).slice(5) : text);
}
const call = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;

describe('Read-only Domus MCP tools', () => {
    it('exposes exactly eight read-only tools and rejects mutation tools and extra arguments', async () => {
        const { result } = await rpc('tools/list');
        expect(result.tools).toHaveLength(8);
        expect(result.tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint)).toBe(true);
        const mutation = await rpc('tools/call', { name: 'delete_property', arguments: { id: 'p1' } });
        expect(mutation.error || mutation.result?.isError).toBeTruthy();
        const injection = await call('list_properties', { accountId: 'another-account' });
        expect(injection.isError).toBe(true);
    });
    it('filters vacancy and expiring contracts, and paginates', async () => {
        expect((await call('list_properties', { status: 'Vacant' })).structuredContent.items.map(item => item.id)).toEqual(['p1']);
        expect((await call('list_leases', { endsBefore: '2026-12-31' })).structuredContent.items[0].parties).toEqual([{ id: 't1', name: 'Test' }]);
        expect((await call('list_properties', { limit: 1 })).structuredContent.nextOffset).toBe(1);
    });
    it('compares recorded costs without multiplying shared costs or recurrence', async () => {
        const result = (await call('analyze_costs', { year: 2026 })).structuredContent;
        expect(result.current.amountCents).toBe(11029);
        expect(result.previous.amountCents).toBe(500);
        expect(result.differenceCents).toBe(10529);
        expect(result.byProperty.find(item => item.propertyId === 'p2').amountCents).toBe(1029);
        expect(result.unallocatedCostIds).toEqual(['c2']);
        const incomplete = (await call('analyze_costs', { year: 2027 })).structuredContent;
        expect(incomplete.current.amountCents).toBeNull();
        expect(incomplete.current.unknownAmountIds).toEqual(['unknown']);
        expect(incomplete.differenceCents).toBeNull();
    });
    it('assembles a scoped dossier and returns document source pages', async () => {
        const result = (await call('get_property_dossier', { propertyId: 'p2' })).structuredContent;
        expect(result.property.id).toBe('p2');
        expect(result.issues.map(issue => issue.id)).toEqual(['i1']);
        expect(result.missing[0].fields).toContain('contractDocumentId');
        expect((await call('read_document', { documentId: 'd1' })).structuredContent.pages[0].page).toBe(1);
        expect((await call('get_property_dossier', { propertyId: 'foreign' })).isError).toBe(true);
    });
});
