import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { createCrudRouter } from './createCrudRouter.js';
import { specs } from './swagger.js';

// Origins allowed to call the API from a browser (comma-separated).
// Defaults to the Vite dev server and preview server.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

// The API is meant for local use only. Rejecting other Host headers
// blocks DNS rebinding attacks from websites opened in the browser.
const allowedHostnames = (process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

const app = express();
app.disable('x-powered-by');

// Middleware
app.use((req, res, next) => {
    const hostname = (req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
    if (!allowedHostnames.includes(hostname)) {
        return res.status(403).json({ error: 'Host not allowed' });
    }
    next();
});
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
// Note: We mount them at /api/[resource]
app.use('/api/tenants', createCrudRouter('tenants'));
app.use('/api/properties', createCrudRouter('properties'));
app.use('/api/issues', createCrudRouter('issues'));
app.use('/api/documents', createCrudRouter('documents'));
app.use('/api/costs', createCrudRouter('costs'));
app.use('/api/contacts', createCrudRouter('contacts'));

// Root endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Domus API is running' });
});

// API Root
app.get('/api', (req, res) => {
    res.json({
        message: 'Domus API v1',
        resources: [
            '/api/tenants',
            '/api/properties',
            '/api/issues',
            '/api/documents',
            '/api/costs',
            '/api/contacts'
        ],
        documentation: '/api-docs'
    });
});

export default app;
