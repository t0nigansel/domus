// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canonicalRedirect, isAssetRequest } from '../cloud/routing.js';
import { authOptions } from '../cloud/auth.js';

const production = { DOMUS_ENV: 'production', BETTER_AUTH_URL: 'https://www.zuloni.com' };

describe('Zuloni canonical domain', () => {
    it.each(['zuloni.com', 'domus.toni-gansel.workers.dev'])('redirects %s while preserving deep links and query values', hostname => {
        const response = canonicalRedirect(new Request(`https://${hostname}/properties/example?tab=rental&new=1`), production);
        expect(response.status).toBe(308);
        expect(response.headers.get('Location')).toBe('https://www.zuloni.com/properties/example?tab=rental&new=1');
    });
    it('preserves OAuth links and POST method semantics through a permanent 308', () => {
        const response = canonicalRedirect(new Request('https://domus.toni-gansel.workers.dev/api/auth/verify-email?token=test&callbackURL=%2Fsettings', { method: 'POST', body: 'fixture' }), production);
        expect(response.status).toBe(308);
        expect(response.headers.get('Location')).toBe('https://www.zuloni.com/api/auth/verify-email?token=test&callbackURL=%2Fsettings');
    });
    it('updates previously mailed auth callbacks without trusting unrelated redirect destinations', () => {
        const oldCallback = 'https://domus.toni-gansel.workers.dev/?auth=reset';
        const response = canonicalRedirect(new Request(`https://domus.toni-gansel.workers.dev/api/auth/reset-password/test?callbackURL=${encodeURIComponent(oldCallback)}`), production);
        expect(new URL(response.headers.get('Location')).searchParams.get('callbackURL')).toBe('https://www.zuloni.com/?auth=reset');
        const unrelated = 'https://attacker.example/path';
        const untouched = canonicalRedirect(new Request(`https://zuloni.com/api/auth/verify-email?token=test&callbackURL=${encodeURIComponent(unrelated)}`), production);
        expect(new URL(untouched.headers.get('Location')).searchParams.get('callbackURL')).toBe(unrelated);
    });
    it('upgrades canonical HTTP, does not loop and leaves preview/custom untrusted hosts unchanged', () => {
        expect(canonicalRedirect(new Request('http://www.zuloni.com/documents'), production)?.headers.get('Location')).toBe('https://www.zuloni.com/documents');
        for (const url of ['https://www.zuloni.com/', 'https://domus-preview.toni-gansel.workers.dev/', 'https://zuloni.com.attacker.example/']) {
            expect(canonicalRedirect(new Request(url), production)).toBeNull();
        }
        expect(canonicalRedirect(new Request('https://zuloni.com/'), { ...production, DOMUS_ENV: 'preview' })).toBeNull();
        expect(canonicalRedirect(new Request('https://zuloni.com/'), { ...production, BETTER_AUTH_URL: 'https://untrusted.example/' })).toBeNull();
    });
    it('ignores spoofed Host and forwarded host headers when selecting the target', () => {
        const response = canonicalRedirect(new Request('https://zuloni.com/settings', { headers: { Host: 'attacker.example', 'X-Forwarded-Host': 'attacker.example' } }), production);
        expect(response.headers.get('Location')).toBe('https://www.zuloni.com/settings');
        const doubleSlash = canonicalRedirect(new Request('https://zuloni.com//attacker.example/path?next=https://attacker.example'), production);
        expect(new URL(doubleSlash.headers.get('Location')).origin).toBe('https://www.zuloni.com');
    });
});

describe('Worker-first static assets', () => {
    it('serves frontend GET/HEAD routes while retaining API ownership and rejecting arbitrary writes', () => {
        for (const url of ['/', '/properties/flat-1', '/assets/index.js', '/mcp/consent']) {
            expect(isAssetRequest(new Request(`https://www.zuloni.com${url}`))).toBe(true);
            expect(isAssetRequest(new Request(`https://www.zuloni.com${url}`, { method: 'HEAD' }))).toBe(true);
            expect(isAssetRequest(new Request(`https://www.zuloni.com${url}`, { method: 'POST' }))).toBe(false);
        }
        for (const path of ['/api', '/api/health', '/api/unknown', '/api-docs', '/api-docs/example']) {
            expect(isAssetRequest(new Request(`https://www.zuloni.com${path}`))).toBe(false);
        }
    });
    it('uses the new auth identity and canonical URL without changing existing technical scopes', () => {
        const options = authOptions({ BETTER_AUTH_URL: production.BETTER_AUTH_URL }, {});
        expect(options.appName).toBe('Zuloni');
        expect(options.baseURL).toBe('https://www.zuloni.com');
        expect(options.trustedOrigins).toEqual(['https://www.zuloni.com']);
    });
});
