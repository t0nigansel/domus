import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Low, Memory } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { migrateRentals } from '../src/domain/rentals.js';
import {
    INITIAL_PROPERTIES,
    INITIAL_TENANTS,
    INITIAL_DOCUMENTS,
    INITIAL_ISSUES,
    INITIAL_COSTS
} from './initialData.js';

// Default data if db.json is empty
const defaultData = {
    tenants: INITIAL_TENANTS,
    properties: INITIAL_PROPERTIES,
    issues: INITIAL_ISSUES,
    documents: INITIAL_DOCUMENTS,
    costs: INITIAL_COSTS,
    contacts: []
};

// Tests run against an in-memory copy so they never touch real data.
// Otherwise data lives in DOMUS_DB_FILE, or server/db.json (ignored by Git).
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DOMUS_DB_FILE || path.join(serverDir, 'db.json');
const adapter = process.env.NODE_ENV === 'test' ? new Memory() : new JSONFile(dbFile);

// Initialize DB
const db = new Low(adapter, structuredClone(defaultData));
await db.read();

if (!db.data.rentalSchemaVersion) {
    if (process.env.NODE_ENV !== 'test') {
        await copyFile(dbFile, `${dbFile}.before-rentals-v1.bak`, constants.COPYFILE_EXCL).catch(error => {
            if (!['ENOENT', 'EEXIST'].includes(error.code)) throw error;
        });
    }
    db.data = migrateRentals(db.data);
    await db.write();
}

export default db;
