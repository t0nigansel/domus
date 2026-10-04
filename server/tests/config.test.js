import { describe, it, expect } from 'vitest';
import { loadConfig } from '../config.js';

describe('server config', () => {
    it('uses safe local defaults', () => {
        expect(loadConfig({})).toEqual({
            port: 3001,
            host: '127.0.0.1',
            corsOrigins: ['http://localhost:5173', 'http://localhost:4173'],
            allowedHosts: ['localhost', '127.0.0.1', '[::1]'],
        });
    });

    it('reads and normalizes values from the environment', () => {
        const config = loadConfig({ PORT: '8080', HOST: '0.0.0.0', CORS_ORIGINS: ' https://app.example.com ', ALLOWED_HOSTS: 'App.Example.com' });
        expect(config).toMatchObject({ port: 8080, host: '0.0.0.0', corsOrigins: ['https://app.example.com'], allowedHosts: ['app.example.com'] });
    });

    it('rejects an invalid port', () => {
        expect(() => loadConfig({ PORT: 'abc' })).toThrow(/Invalid PORT/);
    });

    it('rejects origins with a path or invalid syntax', () => {
        expect(() => loadConfig({ CORS_ORIGINS: 'https://app.example.com/' })).toThrow(/bare origin/);
        expect(() => loadConfig({ CORS_ORIGINS: 'not a url' })).toThrow(/Invalid CORS_ORIGINS/);
    });
});
