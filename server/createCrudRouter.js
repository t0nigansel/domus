import express from 'express';
import db from './db.js';
import { tenancyView } from '../src/domain/rentals.js';
import { localToday } from './rentalService.js';

export const createCrudRouter = (entityName) => {
    const router = express.Router();
    const readEntities = () => ['tenants', 'properties'].includes(entityName)
        ? tenancyView(db.data, localToday())[entityName] : db.data[entityName] || [];

    router.use((req, res, next) => {
        const id = req.path.split('/')[1];
        const leases = db.data.leases || [];
        if (['PUT', 'DELETE'].includes(req.method)) {
            if (entityName === 'tenants' && leases.some(l => l.tenantIds.includes(id))) {
                if (req.method === 'DELETE' || ['id', 'propertyId', 'propertyName', 'leaseStart', 'leaseEnd', 'status'].some(key => req.body && Object.hasOwn(req.body, key))) {
                    return res.status(409).json({ error: 'Zuordnung und Mietzeitraum werden im Mietverhältnis verwaltet. Vertragsparteien bleiben historisch erhalten.' });
                }
            }
            if (req.method === 'DELETE' && entityName === 'properties' && (leases.some(l => l.propertyId === id) || (db.data.rentals || []).some(r => r.propertyId === id))) return res.status(409).json({ error: 'Wohnung ist mit Vermietungen verknüpft.' });
            if (req.method === 'DELETE' && entityName === 'documents' && leases.some(l => l.contractDocumentId === id)) return res.status(409).json({ error: 'Unterschriebener Vertrag ist mit einem Mietverhältnis verknüpft.' });
        }
        if (entityName === 'tenants' && ['POST', 'PUT'].includes(req.method) && req.body?.propertyId && leases.some(l => l.propertyId === req.body.propertyId)) return res.status(409).json({ error: 'Neue Vertragsparteien über einen Vermietungsvorgang anlegen.' });
        next();
    });

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
        const data = readEntities();
        res.json(data);
    });

    // GET by ID
    router.get('/:id', (req, res) => {
        const data = readEntities();
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
        if (newItem.id && (db.data[entityName] || []).some(item => item.id === newItem.id)) return res.status(409).json({ error: 'ID already exists' });
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
                data[entityName][index] = { ...data[entityName][index], ...updates, id };
                updatedItem = data[entityName][index];
            }
        });

        if (updatedItem) {
            res.json(readEntities().find(item => item.id === id));
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
