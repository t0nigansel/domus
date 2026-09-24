import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { specs } from '../swagger.js';

describe('Dynamic API Tests (OpenAPI Driven)', () => {
    // 1. Extract paths from Swagger
    const paths = Object.keys(specs.paths);

    // 2. Separate into "Collections" (e.g., /tenants) and "Details" (e.g., /tenants/{id})
    const collections = paths.filter(p => !p.includes('{'));
    const details = paths.filter(p => p.includes('{id}'));

    // Cache valid IDs found during testing to test detail endpoints dynamically
    const resourceIds = {};

    describe('Collection Endpoints (GET)', () => {
        collections.forEach((path) => {
            it(`GET ${path} should return 200 OK and an array`, async () => {
                const response = await request(app).get(`/api${path}`);

                expect(response.status).toBe(200);
                expect(response.type).toMatch(/json/);
                expect(Array.isArray(response.body)).toBe(true);

                // If data exists, store an ID for later Detail testing
                if (response.body.length > 0) {
                    // Start of path is usually the resource name e.g., /tenants
                    resourceIds[path] = response.body[0].id;
                }
            });
        });
    });

    describe('Detail Endpoints (GET)', () => {
        details.forEach((detailPath) => {
            // Find corresponding collection path (e.g., /tenants/{id} -> /tenants)
            const collectionPath = detailPath.replace('/{id}', '');

            it(`GET ${detailPath} - should return 200 if data exists`, async () => {
                const testId = resourceIds[collectionPath];

                if (testId) {
                    const realPath = detailPath.replace('{id}', testId);
                    const response = await request(app).get(`/api${realPath}`);

                    expect(response.status).toBe(200);
                    expect(response.body).toHaveProperty('id', testId);
                } else {
                    console.warn(`Skipping ${detailPath} - No test data found in ${collectionPath}`);
                }
            });

            it(`GET ${detailPath} with invalid ID should return 404`, async () => {
                const invalidPath = detailPath.replace('{id}', 'non-existent-id-999');
                const response = await request(app).get(`/api${invalidPath}`);
                expect(response.status).toBe(404);
            });
        });
    });
});
