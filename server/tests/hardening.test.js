import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('API hardening', () => {
    it('rejects requests with a foreign Host header (DNS rebinding)', async () => {
        const response = await request(app).get('/api/tenants').set('Host', 'evil.example.com');
        expect(response.status).toBe(403);
    });

    it('accepts requests addressed to localhost', async () => {
        const response = await request(app).get('/api/tenants').set('Host', 'localhost:3001');
        expect(response.status).toBe(200);
    });

    it('allows CORS for the frontend origin', async () => {
        const response = await request(app).get('/api/tenants').set('Origin', 'http://localhost:5173');
        expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('does not allow CORS for other origins', async () => {
        const response = await request(app).get('/api/tenants').set('Origin', 'https://evil.example.com');
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects non-JSON writes', async () => {
        const response = await request(app)
            .post('/api/tenants')
            .set('Content-Type', 'text/plain')
            .send('{"name":"x"}');
        expect(response.status).toBe(415);
    });

    it('rejects JSON bodies that are not objects', async () => {
        const response = await request(app).post('/api/tenants').send([{ name: 'x' }]);
        expect(response.status).toBe(400);
    });

    it('does not advertise Express', async () => {
        const response = await request(app).get('/api');
        expect(response.headers['x-powered-by']).toBeUndefined();
    });
});
