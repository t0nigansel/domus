// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createCloudApp } from '../cloud/app.js';
import { withAccountTransaction } from '../cloud/database.js';
import { authOptions, missingAuthSettings } from '../cloud/auth.js';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { betterAuth } from 'better-auth';

describe('Cloud isolation from local storage', () => {
    const app = createCloudApp({ DOMUS_ENV: 'preview' });
    it('exposes liveness but keeps data and documentation closed', async () => {
        expect((await request(app).get('/api/health')).body).toEqual({ service: 'domus', environment: 'preview', status: 'setup' });
        for (const path of ['/api/properties', '/api/tenants', '/api/files/raw-files', '/api/rentals', '/api/unknown']) {
            const response = await request(app).get(path);
            expect(response.status).toBe(503);
            expect(response.headers['cache-control']).toBe('no-store');
        }
        expect((await request(app).post('/api/files/upload').send({ base64: 'dGVzdA==' })).status).toBe(503);
        expect((await request(app).get('/api-docs')).status).toBe(404);
    });
});

describe('Transaction-scoped account context', () => {
    it('rolls back failed operations and never accepts missing account context', async () => {
        const client = { query: vi.fn().mockResolvedValue({ rows: [] }) };
        await expect(withAccountTransaction(client, '', () => {})).rejects.toThrow('Account ID');
        expect(client.query).not.toHaveBeenCalled();
        const failure = new Error('constraint failed');
        await expect(withAccountTransaction(client, 'account-a', async () => { throw failure; })).rejects.toBe(failure);
        expect(client.query.mock.calls).toEqual([
            ['BEGIN'], ["SELECT set_config('app.account_id', $1, true)", ['account-a']], ['ROLLBACK'],
        ]);
    });
});

describe('Pilot auth policy', () => {
    it('requires database, mail and a sufficiently long secret before activation', () => {
        expect(missingAuthSettings({})).toContain('HYPERDRIVE');
        expect(missingAuthSettings({ BETTER_AUTH_SECRET: 'short' })).toContain('BETTER_AUTH_SECRET_LENGTH');
    });
    it('rejects registration outside the pilot and requires email verification for invited users', async () => {
        const database = { user: [], session: [], account: [], verification: [], rateLimit: [], organization: [], member: [], invitation: [] };
        const mail = vi.fn();
        const options = authOptions({
            BETTER_AUTH_URL: 'http://localhost:8787',
            BETTER_AUTH_SECRET: 'domus-test-secret-at-least-thirty-two-characters',
            PILOT_EMAILS: 'invited@example.invalid',
        }, memoryAdapter(database), mail);
        // No external services or shared test state; production uses DB rate limits.
        const auth = betterAuth({ ...options, rateLimit: { enabled: false }, logger: { disabled: true } });
        const signup = email => auth.handler(new Request('http://localhost:8787/api/auth/sign-up/email', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8787' },
            body: JSON.stringify({ email, name: 'Pilot Test', password: 'a-long-test-password-345' }),
        }));
        expect((await signup('outsider@example.invalid')).status).toBe(403);
        expect(database.user).toHaveLength(0);
        const invited = await signup('invited@example.invalid');
        expect(invited.status).toBe(200);
        expect(database.user).toHaveLength(1);
        expect(database.user[0].emailVerified).toBe(false);
        expect(mail).toHaveBeenCalledOnce();
        expect(invited.headers.get('set-cookie')).toBeNull();
    });
});
