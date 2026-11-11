// Test entrypoint only: isolated in-memory data and captured email delivery.
import { betterAuth } from 'better-auth';
import { authOptions } from '../cloud/auth.js';

// Explicit initialization avoids the adapter's lazy import cycle in esbuild.
const { memoryAdapter } = await import('better-auth/adapters/memory');

const database = { user: [], session: [], account: [], verification: [], rateLimit: [], organization: [], member: [], invitation: [] };
const options = authOptions({
    BETTER_AUTH_URL: 'http://localhost:8787',
    BETTER_AUTH_SECRET: 'domus-runtime-test-secret-at-least-thirty-two-characters',
    PILOT_EMAILS: 'invited@example.invalid',
}, memoryAdapter(database), async () => {});
const auth = betterAuth({ ...options, rateLimit: { enabled: false }, logger: { disabled: true } });

export default { fetch: request => auth.handler(new Request(
    `http://localhost:8787${new URL(request.url).pathname}`, request,
)) };
