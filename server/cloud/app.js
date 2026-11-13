import express from 'express';
import { missingAuthSettings } from './auth.js';

// The local app imports lowdb and filesystem routes. Never mount it in Workers.
export function createCloudApp(env) {
    const app = express();
    app.disable('x-powered-by');
    app.use((_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        res.set('X-Content-Type-Options', 'nosniff');
        next();
    });
    app.get('/api/health', (_req, res) => res.json({
        service: 'domus',
        environment: env.DOMUS_ENV,
        status: env.DOMUS_DOMAIN_ENABLED === 'true' && !missingAuthSettings(env).length ? 'ready' : 'setup',
    }));
    app.use('/api-docs', (_req, res) => res.status(404).json({ error: 'Not found' }));
    app.use('/api', (_req, res) => res.status(503).json({
        error: 'Der Zugang wird vorbereitet.',
        code: 'SAAS_SETUP_PENDING',
    }));
    app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
    return app;
}
