import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, AlertCircle, MinusCircle, Trash2, Plus, Phone, Mail } from 'lucide-react';
import { useData } from '../context/DataContext';
import { CollapsiblePanel, ConfirmModal, useToast, List, ListRow, ListEmpty, Badge } from '../components/common';
import './Tenants.css';

// Add form for the combined contacts page; `children` renders above the form (type switch).
export const TenantAddPanel = ({ isOpen, onClose, children }) => {
    const { t } = useTranslation();
    const { properties, addTenant } = useData();
    const { addToast } = useToast();
    const isAddingTenant = isOpen;
    const setIsAddingTenant = (open) => { if (!open) onClose(); };

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

    return (
            <CollapsiblePanel title={t("New Tenant")} isOpen={isAddingTenant} onClose={() => setIsAddingTenant(false)}>
                {children}
                <p>{t("Für Wohnungen mit bestätigten Mietverhältnissen neue Parteien über")}{" "}<Link to="/rentals">{t("Vermietungen")}</Link>{" "}{t("anlegen.")}</p>
                <form onSubmit={handleAddSubmit}>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Name")}</label>
                            <input
                                type="text"
                                required
                                value={newTenantData.name}
                                onChange={e => setNewTenantData({ ...newTenantData, name: e.target.value })}
                                className="edit-input"
                                placeholder={t("Full Name")}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Email")}</label>
                            <input
                                type="email"
                                required
                                value={newTenantData.email}
                                onChange={e => setNewTenantData({ ...newTenantData, email: e.target.value })}
                                className="edit-input"
                                placeholder={t("email@example.com")}
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Phone")}</label>
                            <input
                                type="tel"
                                value={newTenantData.phone}
                                onChange={e => setNewTenantData({ ...newTenantData, phone: e.target.value })}
                                className="edit-input"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Property")}</label>
                            <select
                                required
                                value={newTenantData.propertyId}
                                onChange={e => setNewTenantData({ ...newTenantData, propertyId: e.target.value })}
                                className="edit-select"
                            >
                                <option value="">{t("Select Property...")}</option>
                                {properties.filter(p => !p.leaseManaged).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Lease Start")}</label>
                            <input
                                type="date"
                                required
                                value={newTenantData.leaseStart}
                                onChange={e => setNewTenantData({ ...newTenantData, leaseStart: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Lease End")}</label>
                            <input
                                type="date"
                                value={newTenantData.leaseEnd}
                                onChange={e => setNewTenantData({ ...newTenantData, leaseEnd: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn-primary small">{t("Save Tenant")}</button>
                        <button type="button" className="btn-outline small" onClick={() => setIsAddingTenant(false)}>{t("Cancel")}</button>
                    </div>
                </form>
            </CollapsiblePanel>
    );
};

export const TenantList = () => {
    const { t } = useTranslation();
    const { tenants, properties, updateTenant, deleteTenant } = useData();
    const { addToast } = useToast();

    // Inline expansion state
    const [expandedTenantId, setExpandedTenantId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({ open: false, tenantId: null, tenantName: '' });

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
        <>
            {tenants.length === 0 && <ListEmpty>{t("Noch keine Mieter angelegt.")}</ListEmpty>}
            <List>
                    {tenants.map(tenant => {
                        const isExpanded = expandedTenantId === tenant.id;
                        return (
                            <ListRow
                                key={tenant.id}
                                expanded={isExpanded}
                                onToggle={() => toggleExpand(tenant)}
                                muted={tenant.status === 'Past'}
                                icon={getStatusIcon(tenant.status)}
                                title={tenant.name}
                                subtitle={tenant.propertyId ? (
                                    <Link to={`/properties/${tenant.propertyId}`}>
                                        {properties.find(p => p.id === tenant.propertyId)?.name || tenant.propertyName || t("Unknown Property")}
                                    </Link>
                                ) : t("No Property")}
                                meta={<>
                                    {tenant.phone && <a className="list-badge" href={`tel:${tenant.phone.replace(/[^\d+]/g, '')}`}><Phone size={14} aria-hidden="true" />{tenant.phone}</a>}
                                    {tenant.email && <a className="list-badge" href={`mailto:${tenant.email}`}><Mail size={14} aria-hidden="true" />{tenant.email}</a>}
                                    {(tenant.leaseStart || tenant.leaseEnd) && <Badge icon={Calendar}>{tenant.leaseStart || '…'} – {tenant.leaseEnd || t('unbefristet')}</Badge>}
                                </>}
                            >
                                        <form onSubmit={(e) => handleInlineSave(e, tenant.id)}>
                                            {tenant.leaseManaged && <p>{t("Zeitraum und Zuordnung unter")}{" "}<Link to={`/rentals?propertyId=${tenant.propertyId}`}>{t("Mietverhältnisse")}</Link>{" "}{t("verwalten.")}</p>}
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Name")}</label>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={editFormData.name}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Email")}</label>
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
                                                    <label>{t("Phone")}</label>
                                                    <input
                                                        type="tel"
                                                        name="phone"
                                                        value={editFormData.phone}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Property")}</label>
                                                    <select
                                                        name="propertyId" disabled={tenant.leaseManaged}
                                                        value={editFormData.propertyId}
                                                        onChange={handleEditFormChange}
                                                        className="edit-select"
                                                    >
                                                        <option value="">{t("Select Property...")}</option>
                                                        {properties.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Lease Start")}</label>
                                                    <input
                                                        type="date"
                                                        name="leaseStart" disabled={tenant.leaseManaged}
                                                        value={editFormData.leaseStart}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Lease End")}</label>
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
                                                <button type="submit" className="btn-primary small">{t("Save Changes")}</button>
                                                <button type="button" className="btn-outline small" onClick={() => setExpandedTenantId(null)}>{t("Cancel")}</button>
                                                <button
                                                    type="button"
                                                    className="btn-danger small" disabled={tenant.leaseManaged}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteModal({ open: true, tenantId: tenant.id, tenantName: tenant.name });
                                                    }}
                                                    style={{ marginLeft: 'auto' }}
                                                >
                                                    <Trash2 size={16} />{t("Delete")}</button>
                                            </div>
                                        </form>
                            </ListRow>
                        );
                    })}
            </List>

            <ConfirmModal
                isOpen={deleteModal.open}
                title={t("Delete Tenant")}
                message={t('Are you sure you want to permanently delete {name}? This action cannot be undone.', { name: deleteModal.tenantName })}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, tenantId: null, tenantName: '' })}
            />
        </>
    );
};
