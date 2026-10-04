import { useState, useEffect, useCallback } from 'react';
import { tenantService, propertyService } from '../../db/services';
import { TENANT_STATUS } from '../../constants/status';
import { generateId } from '../../utils/idGenerator';

export const useTenants = (properties = []) => {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTenants = useCallback(async () => {
        try {
            const data = await tenantService.getAll();
            setTenants(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch tenants:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    const addTenant = async (propertyId, tenantData) => {
        try {
            const property = properties.find(p => p.id === propertyId);
            const newTenant = {
                id: generateId('t'),
                propertyId,
                propertyName: property?.name || 'Unknown Property',
                leaseStart: new Date().toISOString().split('T')[0],
                leaseEnd: null,
                status: TENANT_STATUS.ACTIVE,
                paymentHistory: [],
                ...tenantData
            };

            const created = await tenantService.create(newTenant);
            setTenants(prev => [...prev, created]);

            // Update property occupant count
            if (property) {
                await propertyService.update(propertyId, {
                    occupants: (property.occupants || 0) + 1
                });
            }
            return created;
        } catch (err) {
            console.error('Failed to add tenant:', err);
            throw err;
        }
    };

    const updateTenant = async (id, updatedFields) => {
        try {
            if (tenants.find(t => t.id === id)?.leaseManaged) {
                updatedFields = Object.fromEntries(['name', 'email', 'phone'].filter(key => updatedFields[key] !== undefined).map(key => [key, updatedFields[key]]));
            }
            // If propertyId is being updated, also update propertyName for consistency
            if (updatedFields.propertyId !== undefined) {
                const property = properties.find(p => p.id === updatedFields.propertyId);
                updatedFields.propertyName = property?.name || 'Unknown Property';
            }
            const updated = await tenantService.update(id, updatedFields);
            setTenants(prev => prev.map(t => t.id === id ? updated : t));
            return updated;
        } catch (err) {
            console.error('Failed to update tenant:', err);
            throw err;
        }
    };

    const removeTenant = async (tenantId) => {
        try {
            const tenant = tenants.find(t => t.id === tenantId);

            if (tenant?.leaseManaged) throw new Error('Mietverhältnis unter Vermietungen beenden.');

            // Mark tenant as past instead of deleting
            const updated = await tenantService.update(tenantId, {
                status: TENANT_STATUS.PAST
            });
            setTenants(prev => prev.map(t => t.id === tenantId ? updated : t));

            // Update property occupant count
            if (tenant && tenant.propertyId && tenant.status === TENANT_STATUS.ACTIVE) {
                const property = properties.find(p => p.id === tenant.propertyId);
                if (property) {
                    await propertyService.update(property.id, {
                        occupants: Math.max(0, (property.occupants || 0) - 1)
                    });
                }
            }
        } catch (err) {
            console.error('Failed to remove tenant:', err);
            throw err;
        }
    };

    const deleteTenant = async (tenantId) => {
        try {
            const tenant = tenants.find(t => t.id === tenantId);

            if (tenant?.leaseManaged) throw new Error('Vertragsparteien bleiben im Mietverhältnis erhalten.');

            // Update property occupant count before deleting
            if (tenant && tenant.propertyId && tenant.status === TENANT_STATUS.ACTIVE) {
                const property = properties.find(p => p.id === tenant.propertyId);
                if (property) {
                    await propertyService.update(property.id, {
                        occupants: Math.max(0, (property.occupants || 0) - 1)
                    });
                }
            }

            // Permanently delete tenant from database
            await tenantService.delete(tenantId);
            setTenants(prev => prev.filter(t => t.id !== tenantId));
        } catch (err) {
            console.error('Failed to delete tenant:', err);
            throw err;
        }
    };

    return {
        tenants,
        loading,
        error,
        addTenant,
        updateTenant,
        removeTenant,
        deleteTenant,
        refreshTenants: fetchTenants
    };
};

