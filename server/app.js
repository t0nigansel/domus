import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { createCrudRouter } from './createCrudRouter.js';
import { specs } from './swagger.js';
import { fileRouter } from './fileRouter.js';
import { rentalRouter } from './rentalRouter.js';
import { config } from './config.js';

const app = express();
app.disable('x-powered-by');

// Middleware
app.use((req, res, next) => {
    const hostname = (req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
    if (!config.allowedHosts.includes(hostname)) {
        return res.status(403).json({ error: 'Host not allowed' });
    }
    next();
});
app.use(cors({ origin: config.corsOrigins }));
app.use('/api/files', fileRouter);
app.use(express.json());
app.use('/api/rentals', rentalRouter);

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
            '/api/contacts',
            '/api/rentals'
        ],
        documentation: '/api-docs'
    });
});

export default app;
