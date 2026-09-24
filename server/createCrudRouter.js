import express from 'express';
import db from './db.js';

export const createCrudRouter = (entityName) => {
    const router = express.Router();

    // Writes must be JSON objects. Requiring the JSON content type also means
    // browsers can't send cross-site writes without a CORS preflight.
    const requireJsonObject = (req, res, next) => {
        if (!req.is('application/json')) {
            return res.status(415).json({ error: 'Content-Type must be application/json' });
        }
        if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
            return res.status(400).json({ error: 'Request body must be a JSON object' });
        }
        next();
    };

    // GET all
    router.get('/', (req, res) => {
        const data = db.data[entityName] || [];
        res.json(data);
    });

    // GET by ID
    router.get('/:id', (req, res) => {
        const data = db.data[entityName] || [];
        const item = data.find(i => i.id === req.params.id);
        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    });

    // POST create
    router.post('/', requireJsonObject, async (req, res) => {
        const newItem = req.body;
        // Simple ID generation if not provided
        if (!newItem.id) {
            newItem.id = Math.random().toString(36).substr(2, 9);
        }

        await db.update((data) => {
            if (!data[entityName]) data[entityName] = [];
            data[entityName].push(newItem);
        });

        res.status(201).json(newItem);
    });

    // PUT update
    router.put('/:id', requireJsonObject, async (req, res) => {
        const { id } = req.params;
        const updates = req.body;
        let updatedItem = null;

        await db.update((data) => {
            if (!data[entityName]) return;
            const index = data[entityName].findIndex(i => i.id === id);
            if (index !== -1) {
                // Merge updates
                data[entityName][index] = { ...data[entityName][index], ...updates };
                updatedItem = data[entityName][index];
            }
        });

        if (updatedItem) {
            res.json(updatedItem);
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    });

    // DELETE 
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        let deleted = false;

        await db.update((data) => {
            if (!data[entityName]) return;
            const index = data[entityName].findIndex(i => i.id === id);
            if (index !== -1) {
                data[entityName].splice(index, 1);
                deleted = true;
            }
        });

        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Not found' });
        }
    });

    return router;
};
