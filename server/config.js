// Central server configuration, read once from environment variables.
// Invalid values stop the server at startup instead of failing later.

const list = value => value.split(',').map(item => item.trim()).filter(Boolean);

function parsePort(value) {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid PORT "${value}": expected an integer between 0 and 65535`);
    }
    return port;
}

function parseOrigins(value) {
    return list(value).map(origin => {
        let url;
        try {
            url = new URL(origin);
        } catch {
            throw new Error(`Invalid CORS_ORIGINS entry "${origin}": expected a URL like http://localhost:5173`);
        }
        if (url.origin !== origin) {
            throw new Error(`Invalid CORS_ORIGINS entry "${origin}": use the bare origin "${url.origin}"`);
        }
        return origin;
    });
}

export function loadConfig(env = process.env) {
    return {
        port: parsePort(env.PORT ?? '3001'),
        // Loopback only by default: the API is not reachable from other devices.
        host: env.HOST || '127.0.0.1',
        corsOrigins: parseOrigins(env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173'),
        // Accepted Host headers; blocks DNS rebinding from websites in the browser.
        allowedHosts: list(env.ALLOWED_HOSTS ?? 'localhost,127.0.0.1,[::1]').map(host => host.toLowerCase()),
    };
}

export const config = loadConfig();
