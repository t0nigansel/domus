import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Domus API',
            version: '1.0.0',
            description: 'API for the Domus Property Management Application',
        },
        servers: [
            {
                url: 'http://localhost:3001/api',
                description: 'Local Development Server',
            },
        ],
        components: {
            schemas: {
                Property: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        location: { type: 'string' },
                        coldRent: { type: 'number' },
                        nebenkosten: { type: 'number' },
                        status: { type: 'string', enum: ['Occupied', 'Vacant', 'Maintenance'] },
                        condition: { type: 'string' },
                        occupants: { type: 'integer' },
                        pets: { type: 'string' },
                        notes: { type: 'string' }
                    },
                },
                Tenant: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                        propertyId: { type: 'string' },
                        propertyName: { type: 'string' },
                        leaseStart: { type: 'string', format: 'date' },
                        leaseEnd: { type: 'string', format: 'date' },
                        status: { type: 'string', enum: ['Active', 'Past'] },
                        paymentHistory: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    date: { type: 'string', format: 'date' },
                                    amount: { type: 'number' },
                                    status: { type: 'string' }
                                }
                            }
                        }
                    },
                },
                Issue: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        propertyId: { type: 'string' },
                        tenantId: { type: 'string' },
                        priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                        status: { type: 'string', enum: ['Open', 'Closed', 'In Progress'] },
                        dueDate: { type: 'string', format: 'date' },
                        createdAt: { type: 'string', format: 'date' },
                        attachments: { type: 'array', items: { type: 'object' } }
                    }
                },
                Document: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string' },
                        category: { type: 'string' },
                        date: { type: 'string', format: 'date' },
                        size: { type: 'string' },
                        url: { type: 'string' }
                    }
                },
                Cost: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        amount: { type: 'number' },
                        dueDate: { type: 'string', format: 'date' },
                        paidDate: { type: 'string', format: 'date' },
                        utilityBillable: { type: 'boolean' },
                        recurrence: { type: 'string', enum: ['none', 'monthly', 'yearly'], default: 'none', description: 'Amount applies per occurrence; does not generate future entries.' },
                        tenantIds: { type: 'array', items: { type: 'string' } }
                    }
                },
                Contact: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string', description: 'Pflichtfeld' },
                        role: { type: 'string', description: 'Funktion, z. B. Elektriker' },
                        description: { type: 'string' },
                        phone: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        address: { type: 'string' },
                        contactInfo: { type: 'string', deprecated: true, description: 'Altfeld: Telefon oder E-Mail in einem Feld' }
                    }
                }
            },
        },
        paths: {
            '/properties': {
                get: {
                    summary: 'Get all properties',
                    responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Property' } } } } } }
                },
                post: {
                    summary: 'Create a property',
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Property' } } } },
                    responses: { 201: { description: 'Created' } }
                }
            },
            '/properties/{id}': {
                get: {
                    summary: 'Get property by ID',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Property' } } } } }
                },
                put: {
                    summary: 'Update property',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Property' } } } },
                    responses: { 200: { description: 'Updated' } }
                },
                delete: {
                    summary: 'Delete property',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Deleted' } }
                }
            },
            '/tenants': {
                get: {
                    summary: 'Get all tenants',
                    responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Tenant' } } } } } }
                },
                post: {
                    summary: 'Create a tenant',
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Tenant' } } } },
                    responses: { 201: { description: 'Created' } }
                }
            },
            '/tenants/{id}': {
                get: {
                    summary: 'Get tenant by ID',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Tenant' } } } } }
                },
                put: {
                    summary: 'Update tenant',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Tenant' } } } },
                    responses: { 200: { description: 'Updated' } }
                },
                delete: {
                    summary: 'Delete tenant',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Deleted' } }
                }
            },
            '/issues': {
                get: {
                    summary: 'Get all issues',
                    responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Issue' } } } } } }
                },
                post: {
                    summary: 'Create an issue',
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Issue' } } } },
                    responses: { 201: { description: 'Created' } }
                }
            },
            '/issues/{id}': {
                get: {
                    summary: 'Get issue by ID',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Issue' } } } } }
                },
                put: {
                    summary: 'Update issue',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Issue' } } } },
                    responses: { 200: { description: 'Updated' } }
                },
                delete: {
                    summary: 'Delete issue',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Deleted' } }
                }
            },
            '/documents': {
                get: {
                    summary: 'Get all documents',
                    responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Document' } } } } } }
                },
                post: {
                    summary: 'Create a document',
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } } },
                    responses: { 201: { description: 'Created' } }
                }
            },
            '/documents/{id}': {
                get: {
                    summary: 'Get document by ID',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } } } }
                },
                put: {
                    summary: 'Update document',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Document' } } } },
                    responses: { 200: { description: 'Updated' } }
                },
                delete: {
                    summary: 'Delete document',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Deleted' } }
                }
            },
            '/costs': {
                get: {
                    summary: 'Get all costs',
                    responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Cost' } } } } } }
                },
                post: {
                    summary: 'Create a cost',
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Cost' } } } },
                    responses: { 201: { description: 'Created' } }
                }
            },
            '/costs/{id}': {
                get: {
                    summary: 'Get cost by ID',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Cost' } } } } }
                },
                put: {
                    summary: 'Update cost',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Cost' } } } },
                    responses: { 200: { description: 'Updated' } }
                },
                delete: {
                    summary: 'Delete cost',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Deleted' } }
                }
            },
            '/contacts': {
                get: {
                    summary: 'Get all contacts',
                    responses: { 200: { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Contact' } } } } } }
                },
                post: {
                    summary: 'Create a contact',
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Contact' } } } },
                    responses: { 201: { description: 'Created' } }
                }
            },
            '/contacts/{id}': {
                get: {
                    summary: 'Get contact by ID',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Contact' } } } } }
                },
                put: {
                    summary: 'Update contact',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Contact' } } } },
                    responses: { 200: { description: 'Updated' } }
                },
                delete: {
                    summary: 'Delete contact',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Deleted' } }
                }
            },
        }
    },
    apis: ['./routes/*.js'], // Path to the API docs (we defined them inline above so this is optional, but good practice)
};

export const specs = swaggerJsdoc(options);
