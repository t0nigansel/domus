// Production aliases are explicit: the request Host never chooses the redirect target.
export function canonicalRedirect(request, env) {
    if (env.DOMUS_ENV !== 'production' || !env.BETTER_AUTH_URL) return null;
    const canonical = new URL(env.BETTER_AUTH_URL);
    if (canonical.origin !== 'https://www.zuloni.com') return null;
    const incoming = new URL(request.url);
    const aliases = ['zuloni.com', 'domus.toni-gansel.workers.dev'];
    if (!aliases.includes(incoming.hostname) && !(incoming.hostname === canonical.hostname && incoming.protocol !== 'https:')) return null;
    const destination = new URL(canonical.origin);
    destination.pathname = incoming.pathname;
    destination.search = incoming.search;
    // Verification/reset links already sent may carry an absolute callback on the old host.
    // Rewrite only our fixed aliases; arbitrary callback URLs remain subject to auth validation.
    if (incoming.pathname.startsWith('/api/auth/')) {
        const value = incoming.searchParams.get('callbackURL');
        if (value) {
            try {
                const callback = new URL(value);
                if (aliases.includes(callback.hostname) && ['http:', 'https:'].includes(callback.protocol) && !callback.username && !callback.password) {
                    const updated = new URL(canonical.origin);
                    updated.pathname = callback.pathname;
                    updated.search = callback.search;
                    updated.hash = callback.hash;
                    destination.searchParams.set('callbackURL', updated.href);
                }
            } catch { /* Relative callbacks are already valid on the new origin. */ }
        }
    }
    return Response.redirect(destination.href, 308);
}

export function isAssetRequest(request) {
    const path = new URL(request.url).pathname;
    return ['GET', 'HEAD'].includes(request.method)
        && path !== '/api' && !path.startsWith('/api/')
        && path !== '/api-docs' && !path.startsWith('/api-docs/');
}
