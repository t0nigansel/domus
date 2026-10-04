import express from 'express';
import { overview, createRental, updateRental, saveApplication, saveViewing, confirmLegacyLease, updateLease, completeRental } from './rentalService.js';

export const rentalRouter = express.Router();
rentalRouter.use((req, res, next) => {
    if (['POST', 'PUT'].includes(req.method)) {
        if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type must be application/json' });
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'JSON object required' });
    }
    next();
});
rentalRouter.get('/', (_req, res) => res.json(overview()));
rentalRouter.post('/', async (req, res) => res.status(201).json(await createRental(req.body)));
rentalRouter.put('/:id', async (req, res) => res.json(await updateRental(req.params.id, req.body)));
rentalRouter.post('/:id/applications', async (req, res) => res.status(201).json(await saveApplication(req.params.id, null, req.body)));
rentalRouter.put('/:id/applications/:applicationId', async (req, res) => res.json(await saveApplication(req.params.id, req.params.applicationId, req.body)));
rentalRouter.post('/:id/viewings', async (req, res) => res.status(201).json(await saveViewing(req.params.id, null, req.body)));
rentalRouter.put('/:id/viewings/:viewingId', async (req, res) => res.json(await saveViewing(req.params.id, req.params.viewingId, req.body)));
rentalRouter.post('/:id/complete', async (req, res) => res.json(await completeRental(req.params.id, req.body)));
rentalRouter.post('/leases/confirm', async (req, res) => res.status(201).json(await confirmLegacyLease(req.body)));
rentalRouter.put('/leases/:id/end', async (req, res) => res.json(await updateLease(req.params.id, req.body)));
rentalRouter.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Vermietung konnte nicht gespeichert werden.' });
});
