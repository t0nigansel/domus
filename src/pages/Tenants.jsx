import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, AlertCircle, MinusCircle, Trash2, Plus } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageHeader, CollapsiblePanel, ConfirmModal, useToast } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import './Tenants.css';

const Tenants = () => {
    const { tenants, properties, addTenant, updateTenant, deleteTenant } = useData();
    const [isAddingTenant, setIsAddingTenant] = useQuickAction();
    const { addToast } = useToast();

    // Inline expansion state
    const [expandedTenantId, setExpandedTenantId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({ open: false, tenantId: null, tenantName: '' });

    // New Tenant State (Top Panel)
    const [newTenantData, setNewTenantData] = useState({
        name: '',
        email: '',
        phone: '',
        propertyId: '',
        leaseStart: '',
        leaseEnd: ''
    });

    // Handle "Add Tenant" (Top Panel)
    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            await addTenant(newTenantData.propertyId, newTenantData);
            setIsAddingTenant(false);
            setNewTenantData({
                name: '',
                email: '',
                phone: '',
                propertyId: '',
                leaseStart: '',
                leaseEnd: ''
            });
            addToast('Tenant added successfully');
        } catch {
            addToast('Failed to add tenant', 'error');
        }
    };

    // Handle Inline Edit Save
    const handleInlineSave = async (e, id) => {
        e.preventDefault();
        try {
            await updateTenant(id, editFormData);
            setExpandedTenantId(null);
            addToast('Tenant updated successfully');
        } catch {
            addToast('Failed to update tenant', 'error');
        }
    };

    const toggleExpand = (tenant) => {
        if (expandedTenantId === tenant.id) {
            setExpandedTenantId(null);
        } else {
            setExpandedTenantId(tenant.id);
            // Pre-fill form data for this tenant
            setEditFormData({
                name: tenant.name,
                email: tenant.email,
                phone: tenant.phone,
                propertyId: tenant.propertyId || '',
                leaseStart: tenant.leaseStart || '',
                leaseEnd: tenant.leaseEnd || ''
            });
        }
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    // Helper to determine status icon
    const getStatusIcon = (status) => {
        if (status === 'Active') return <CheckCircle size={20} className="text-success" />;
        if (status === 'Past') return <MinusCircle size={20} className="text-muted" />;
        return <AlertCircle size={20} className="text-warning" />;
    };

    const confirmDelete = async () => {
        try {
            await deleteTenant(deleteModal.tenantId);
            setExpandedTenantId(null);
            setDeleteModal({ open: false, tenantId: null, tenantName: '' });
            addToast('Tenant deleted successfully');
        } catch {
            addToast('Failed to delete tenant', 'error');
        }
    };

    return (
        <div className="tenants-container">
            <PageHeader title="Tenants" onAction={() => setIsAddingTenant(true)} />

            <CollapsiblePanel title="New Tenant" isOpen={isAddingTenant} onClose={() => setIsAddingTenant(false)}>
                <p>Für Wohnungen mit bestätigten Mietverhältnissen neue Parteien über <Link to="/rentals">Vermietungen</Link> anlegen.</p>
                <form onSubmit={handleAddSubmit}>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Name</label>
                            <input
                                type="text"
                                required
                                value={newTenantData.name}
                                onChange={e => setNewTenantData({ ...newTenantData, name: e.target.value })}
                                className="edit-input"
                                placeholder="Full Name"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Email</label>
                            <input
                                type="email"
                                required
                                value={newTenantData.email}
                                onChange={e => setNewTenantData({ ...newTenantData, email: e.target.value })}
                                className="edit-input"
                                placeholder="email@example.com"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={newTenantData.phone}
                                onChange={e => setNewTenantData({ ...newTenantData, phone: e.target.value })}
                                className="edit-input"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Property</label>
                            <select
                                required
                                value={newTenantData.propertyId}
                                onChange={e => setNewTenantData({ ...newTenantData, propertyId: e.target.value })}
                                className="edit-select"
                            >
                                <option value="">Select Property...</option>
                                {properties.filter(p => !p.leaseManaged).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Lease Start</label>
                            <input
                                type="date"
                                required
                                value={newTenantData.leaseStart}
                                onChange={e => setNewTenantData({ ...newTenantData, leaseStart: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Lease End</label>
                            <input
                                type="date"
                                value={newTenantData.leaseEnd}
                                onChange={e => setNewTenantData({ ...newTenantData, leaseEnd: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn-primary small">Save Tenant</button>
                        <button type="button" className="btn-outline small" onClick={() => setIsAddingTenant(false)}>Cancel</button>
                    </div>
                </form>
            </CollapsiblePanel>

            <div className="table-container" style={{ marginTop: 'var(--spacing-lg)', background: 'none', border: 'none' }}>
                <div className="tenant-list">
                    {tenants.map(tenant => {
                        const isExpanded = expandedTenantId === tenant.id;
                        return (
                            <div
                                key={tenant.id}
                                className={`tenant-row ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => toggleExpand(tenant)}
                            >
                                <div className="tenant-main-info">
                                    <div className="tenant-title-block">
                                        {getStatusIcon(tenant.status)}
                                        <div>
                                            <h3 className="tenant-title">{tenant.name}</h3>
                                            <p className="tenant-subtitle">
                                                {tenant.propertyId ? (
                                                    <Link to={`/properties/${tenant.propertyId}`} className="property-link" onClick={e => e.stopPropagation()}>
                                                        {properties.find(p => p.id === tenant.propertyId)?.name || tenant.propertyName || 'Unknown Property'}
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted">No Property</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="tenant-details-block">
                                        <span className="date-badge">
                                            <Calendar size={14} />
                                            {tenant.leaseStart} — {tenant.leaseEnd}
                                        </span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="tenant-edit-form" onClick={e => e.stopPropagation()}>
                                        <form onSubmit={(e) => handleInlineSave(e, tenant.id)}>
                                            {tenant.leaseManaged && <p>Zeitraum und Zuordnung unter <Link to={`/rentals?propertyId=${tenant.propertyId}`}>Mietverh?ltnisse</Link> verwalten.</p>}
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>Name</label>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={editFormData.name}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>Email</label>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        value={editFormData.email}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>Phone</label>
                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        value={editFormData.phone}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>Property</label>
                                                    <select
                                                        name="propertyId" disabled={tenant.leaseManaged}
                                                        value={editFormData.propertyId}
                                                        onChange={handleEditFormChange}
                                                        className="edit-select"
                                                    >
                                                        <option value="">Select Property...</option>
                                                        {properties.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>Lease Start</label>
                                                    <input
                                                        type="date"
                                                        name="leaseStart" disabled={tenant.leaseManaged}
                                                        value={editFormData.leaseStart}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>Lease End</label>
                                                    <input
                                                        type="date"
                                                        name="leaseEnd" disabled={tenant.leaseManaged}
                                                        value={editFormData.leaseEnd}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-actions">
                                                <button type="submit" className="btn-primary small">Save Changes</button>
                                                <button type="button" className="btn-outline small" onClick={() => setExpandedTenantId(null)}>Cancel</button>
                                                <button
                                                    type="button"
                                                    className="btn-danger small" disabled={tenant.leaseManaged}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteModal({ open: true, tenantId: tenant.id, tenantName: tenant.name });
                                                    }}
                                                    style={{ marginLeft: 'auto' }}
                                                >
                                                    <Trash2 size={16} />
                                                    Delete
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <ConfirmModal
                isOpen={deleteModal.open}
                title="Delete Tenant"
                message={`Are you sure you want to permanently delete ${deleteModal.tenantName}? This action cannot be undone.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, tenantId: null, tenantName: '' })}
            />
        </div>
    );
};

export default Tenants;
