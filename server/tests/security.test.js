import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { specs } from '../swagger.js';

describe('Dynamic Security Tests (Fuzzing)', () => {
    // 1. Define "Naughty Strings" (Attack Vectors)
    const payloads = [
        { name: 'SQL Injection 1', value: "' OR '1'='1" },
        { name: 'SQL Injection 2', value: "'; DROP TABLE users; --" },
        { name: 'XSS Basic', value: "<script>alert(1)</script>" },
        { name: 'XSS Image', value: "<img src=x onerror=alert(1)>" },
        { name: 'Path Traversal', value: "../../../etc/passwd" },
        { name: 'Command Injection', value: "| ls -la" },
        { name: 'NoSQL Injection', value: '{"$gt": ""}' }, // Stringified JSON often passed as string
        { name: 'Large String', value: "A".repeat(10000) }, // Buffer overflow attempt
    ];

    // 2. Extract POST and PUT paths from Swagger
    const paths = Object.keys(specs.paths);
    const endpoints = [];

    paths.forEach(path => {
        const methods = Object.keys(specs.paths[path]);
        methods.forEach(method => {
            if (['post', 'put'].includes(method)) {
                endpoints.push({ path, method });
            }
        });
    });

    // 3. Helper to build a request body with injected payloads
    // We try to fill only string fields if we can determine them, or just a generic object
    const createBodyWithPayload = (payload) => {
        // A generic generic body that hits common fields
        return {
            name: payload,
            title: payload,
            description: payload,
            email: payload,
            notes: payload,
            // Add required fields with safe dummys if known, but for fuzzing generic is often enough 
            // to trigger the parser.
            // Ideally we would parse components.schemas to know exact fields, 
            // but simply sending the payload as common keys is a good 80/20.
        };
    };

    endpoints.forEach(({ path, method }) => {
        describe(`${method.toUpperCase()} ${path}`, () => {
            payloads.forEach(({ name, value }) => {
                it(`should handle ${name}`, async () => {
                    // Replace path parameters if any (e.g. {id}) with a dummy ID to ensure we reach the handler
                    // If it's a create (POST), usually no ID. If update (PUT), needs ID.
                    const cleanPath = path.replace('{id}', 'security-test-dummy-id');

                    const response = await request(app)[method](`/api${cleanPath}`)
                        .send(createBodyWithPayload(value));

                    // Security Assertion: The server should NOT crash (500).
                    // We accept 400 (Bad Request), 404 (Not Found - for dummy ID update), 
                    // 200/201 (Accepted - if sanitization happens later), 
                    // 403 (Forbidden), 503 (Service Unavailable).
                    // Basically anything except an unhandled exception (500).

                    if (response.status === 500) {
                        console.error(`CRITICAL: Server crashed on ${method} ${path} with payload: ${value}`);
                        console.error('Response:', response.body);
                    }

                    expect(response.status).not.toBe(500);
                });
            });
        });
    });
});
