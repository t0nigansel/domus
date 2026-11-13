import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Calendar, CheckCircle, AlertCircle, XCircle, Euro, Users, Paperclip, X } from 'lucide-react';
import { PageHeader, CollapsiblePanel, useToast, List, ListRow, ListEmpty, Badge } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import { COST_RECURRENCES } from '../domain/costs';
import './Costs.css';

const recurrenceLabels = { none: 'One-off', monthly: 'Monthly', yearly: 'Yearly' };

function RecurrenceField({ id, value, onChange }) {
    const { t } = useTranslation();
    return <div className="form-group">
        <label htmlFor={id}>{t('Recurrence')}</label>
        <select id={id} name="recurrence" className="edit-select" value={value} onChange={onChange} aria-describedby={`${id}-hint`}>
            {COST_RECURRENCES.map(recurrence => <option key={recurrence} value={recurrence}>{t(recurrenceLabels[recurrence])}</option>)}
        </select>
        <p id={`${id}-hint`} className="cost-subtitle">{t(value === 'none'
            ? 'Select a recurrence for regularly occurring costs.'
            : 'The amount applies per due date. The recurrence is saved; further cost entries are not created automatically.')}</p>
    </div>;
}

const Costs = () => {
    const { t, locale } = useTranslation();
    const { costs, tenants, properties, issues, addCost, updateCost } = useData();
    const [isAddingCost, setIsAddingCost] = useQuickAction();
    const { addToast } = useToast();

    // Inline expansion state
    const [expandedCostId, setExpandedCostId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    // New Cost State (Top Panel)
    const [newCostData, setNewCostData] = useState({
        name: '',
        description: '',
        amount: '',
        dueDate: '',
        paidDate: '',
        recurrence: 'none',
        utilityBillable: false,
        tenantIds: [],
        propertyIds: [],
        issueIds: [],
        attachments: []
    });

    // Handle "Add Cost" (Top Panel)
    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            await addCost({
                ...newCostData,
                amount: parseFloat(newCostData.amount),
                paidDate: newCostData.paidDate || null
            });
            setIsAddingCost(false);
            setNewCostData({
                name: '',
                description: '',
                amount: '',
                dueDate: '',
                paidDate: '',
                recurrence: 'none',
                utilityBillable: false,
                tenantIds: [],
                propertyIds: [],
                issueIds: [],
                attachments: []
            });
            addToast('Cost added successfully');
        } catch {
            addToast('Failed to add cost', 'error');
        }
    };

    // Handle Inline Edit Save
    const handleInlineSave = async (e, id) => {
        e.preventDefault();
        try {
            await updateCost(id, {
                ...editFormData,
                amount: parseFloat(editFormData.amount)
            });
            setExpandedCostId(null);
            addToast('Cost updated successfully');
        } catch {
            addToast('Failed to update cost', 'error');
        }
    };

    const toggleExpand = (cost) => {
        if (expandedCostId === cost.id) {
            setExpandedCostId(null);
        } else {
            setExpandedCostId(cost.id);
            // Pre-fill form data for this cost
            setEditFormData({
                name: cost.name,
                description: cost.description,
                amount: cost.amount,
                dueDate: cost.dueDate,
                paidDate: cost.paidDate || '',
                recurrence: cost.recurrence || 'none',
                utilityBillable: cost.utilityBillable,
                tenantIds: cost.tenantIds || [],
                propertyIds: cost.propertyIds || [],
                issueIds: cost.issueIds || [],
                attachments: cost.attachments || []
            });
        }
    };

    const handleEditFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleTenantSelection = (tenantId, isEditing = false) => {
        const setter = isEditing ? setEditFormData : setNewCostData;
        setter(prev => {
            const currentTenantIds = prev.tenantIds || [];
            const newTenantIds = currentTenantIds.includes(tenantId)
                ? currentTenantIds.filter(id => id !== tenantId)
                : [...currentTenantIds, tenantId];
            return { ...prev, tenantIds: newTenantIds };
        });
    };

    const handlePropertySelection = (propertyId, isEditing = false) => {
        const setter = isEditing ? setEditFormData : setNewCostData;
        setter(prev => {
            const currentPropertyIds = prev.propertyIds || [];
            const newPropertyIds = currentPropertyIds.includes(propertyId)
                ? currentPropertyIds.filter(id => id !== propertyId)
                : [...currentPropertyIds, propertyId];
            return { ...prev, propertyIds: newPropertyIds };
        });
    };

    const handleIssueSelection = (issueId, isEditing = false) => {
        const setter = isEditing ? setEditFormData : setNewCostData;
        setter(prev => {
            const currentIssueIds = prev.issueIds || [];
            const newIssueIds = currentIssueIds.includes(issueId)
                ? currentIssueIds.filter(id => id !== issueId)
                : [...currentIssueIds, issueId];
            return { ...prev, issueIds: newIssueIds };
        });
    };

    const handleFileAttachment = (fileName, isEditing = false) => {
        const setter = isEditing ? setEditFormData : setNewCostData;
        setter(prev => ({
            ...prev,
            attachments: [...(prev.attachments || []), fileName]
        }));
    };

    const removeAttachment = (index, isEditing = false) => {
        const setter = isEditing ? setEditFormData : setNewCostData;
        setter(prev => ({
            ...prev,
            attachments: (prev.attachments || []).filter((_, i) => i !== index)
        }));
    };

    // Helper to determine status icon
    const getStatusIcon = (cost) => {
        if (cost.paidDate) return <CheckCircle size={20} className="text-success" />;

        const today = new Date();
        const dueDate = new Date(cost.dueDate);

        if (dueDate < today) return <XCircle size={20} className="text-danger" />;
        return <AlertCircle size={20} className="text-warning" />;
    };

    const getStatusText = (cost) => {
        if (cost.paidDate) return t('Paid on {date}', { date: cost.paidDate });

        const today = new Date();
        const dueDate = new Date(cost.dueDate);

        if (dueDate < today) return t('Overdue');
        return t('Unpaid');
    };

    const formatAmount = (amount) => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    };

    return (
        <div className="page-container">
            <PageHeader title={t("Costs")} onAction={() => setIsAddingCost(true)} />

            <CollapsiblePanel title={t("New Cost")} isOpen={isAddingCost} onClose={() => setIsAddingCost(false)}>
                <form onSubmit={handleAddSubmit}>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 2 }}>
                            <label>{t("Name")}</label>
                            <input
                                type="text"
                                required
                                value={newCostData.name}
                                onChange={e => setNewCostData({ ...newCostData, name: e.target.value })}
                                className="edit-input"
                                placeholder={t("e.g., Property Insurance")}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Amount (€)")}</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={newCostData.amount}
                                onChange={e => setNewCostData({ ...newCostData, amount: e.target.value })}
                                className="edit-input"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Description")}</label>
                            <textarea
                                value={newCostData.description}
                                onChange={e => setNewCostData({ ...newCostData, description: e.target.value })}
                                className="edit-textarea"
                                placeholder={t("Detailed description...")}
                                rows="2"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Due Date")}</label>
                            <input
                                type="date"
                                required
                                value={newCostData.dueDate}
                                onChange={e => setNewCostData({ ...newCostData, dueDate: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Paid Date (Optional)")}</label>
                            <input
                                type="date"
                                value={newCostData.paidDate}
                                onChange={e => setNewCostData({ ...newCostData, paidDate: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label className="checkbox-label-inline">
                                <span>{t("Utility Billable (can be passed to tenants)")}</span>
                                <input
                                    type="checkbox"
                                    checked={newCostData.utilityBillable}
                                    onChange={e => setNewCostData({ ...newCostData, utilityBillable: e.target.checked })}
                                />
                            </label>
                        </div>
                    </div>
                    <RecurrenceField id="new-cost-recurrence" value={newCostData.recurrence}
                        onChange={e => setNewCostData({ ...newCostData, recurrence: e.target.value })} />
                    <div className="form-group">
                        <label>{t("Associations (Optional)")}</label>
                        <div className="associations-container">
                            {/* Tenants */}
                            <div className="association-group">
                                <div className="association-label">{t("Tenants")}</div>
                                <div className="tenant-selection">
                                    {tenants.filter(tenant => tenant.status === 'Active').map(tenant => (
                                        <label key={tenant.id} className="tenant-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={newCostData.tenantIds.includes(tenant.id)}
                                                onChange={() => handleTenantSelection(tenant.id, false)}
                                            />
                                            <span>{tenant.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Properties */}
                            <div className="association-group">
                                <div className="association-label">{t("Properties")}</div>
                                <div className="tenant-selection">
                                    {properties.map(property => (
                                        <label key={property.id} className="tenant-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={newCostData.propertyIds.includes(property.id)}
                                                onChange={() => handlePropertySelection(property.id, false)}
                                            />
                                            <span>{property.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Issues */}
                            <div className="association-group">
                                <div className="association-label">{t("Issues")}</div>
                                <div className="tenant-selection">
                                    {issues.filter(i => i.status !== 'Closed').map(issue => (
                                        <label key={issue.id} className="tenant-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={newCostData.issueIds.includes(issue.id)}
                                                onChange={() => handleIssueSelection(issue.id, false)}
                                            />
                                            <span>{issue.title}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>{t("Attachments (Invoices, etc.)")}</label>
                        <div className="attachment-section">
                            <input
                                type="text"
                                placeholder={t("Enter file name (e.g., invoice_2024.pdf)")}
                                className="edit-input"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (e.target.value.trim()) {
                                            handleFileAttachment(e.target.value.trim(), false);
                                            e.target.value = '';
                                        }
                                    }
                                }}
                            />
                            {newCostData.attachments && newCostData.attachments.length > 0 && (
                                <div className="attachment-list">
                                    {newCostData.attachments.map((file, index) => (
                                        <div key={index} className="attachment-item">
                                            <Paperclip size={14} />
                                            <span>{file}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttachment(index, false)}
                                                className="remove-attachment"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn-primary small">{t("Save Cost")}</button>
                        <button type="button" className="btn-outline small" onClick={() => setIsAddingCost(false)}>{t("Cancel")}</button>
                    </div>
                </form>
            </CollapsiblePanel>

            {costs.length > 0 ? (
                <List>
                    {costs.map(cost => {
                        const isExpanded = expandedCostId === cost.id;
                        return (
                            <ListRow
                                key={cost.id}
                                expanded={isExpanded}
                                onToggle={() => toggleExpand(cost)}
                                icon={getStatusIcon(cost)}
                                title={cost.name}
                                subtitle={getStatusText(cost)}
                                meta={<>
                                    {cost.utilityBillable && <Badge tone="primary">{t("Utility Billable")}</Badge>}
                                    <Badge icon={Calendar}>{t("Due:")} {cost.dueDate}</Badge>
                                    <Badge icon={Euro} tone="strong">
                                        {formatAmount(cost.amount)}
                                        {cost.recurrence === 'monthly' && ` ${t('/ month')}`}
                                        {cost.recurrence === 'yearly' && ` ${t('/ year')}`}
                                    </Badge>
                                </>}
                            >
                                        {isExpanded && <form onSubmit={(e) => handleInlineSave(e, cost.id)}>
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 2 }}>
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
                                                    <label>{t("Amount (€)")}</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        name="amount"
                                                        value={editFormData.amount}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Description")}</label>
                                                    <textarea
                                                        name="description"
                                                        value={editFormData.description}
                                                        onChange={handleEditFormChange}
                                                        className="edit-textarea"
                                                        rows="2"
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Due Date")}</label>
                                                    <input
                                                        type="date"
                                                        name="dueDate"
                                                        value={editFormData.dueDate}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label>{t("Paid Date")}</label>
                                                    <input
                                                        type="date"
                                                        name="paidDate"
                                                        value={editFormData.paidDate}
                                                        onChange={handleEditFormChange}
                                                        className="edit-input"
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <label className="checkbox-label-inline">
                                                        <span>{t("Utility Billable")}</span>
                                                        <input
                                                            type="checkbox"
                                                            name="utilityBillable"
                                                            checked={editFormData.utilityBillable}
                                                            onChange={handleEditFormChange}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <RecurrenceField id={`cost-${cost.id}-recurrence`} value={editFormData.recurrence} onChange={handleEditFormChange} />
                                            <div className="form-group">
                                                <label>{t("Associations")}</label>
                                                <div className="associations-container">
                                                    {/* Tenants */}
                                                    <div className="association-group">
                                                        <div className="association-label">{t("Tenants")}</div>
                                                        <div className="tenant-selection">
                                                            {tenants.filter(tenant => tenant.status === 'Active').map(tenant => (
                                                                <label key={tenant.id} className="tenant-checkbox">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editFormData.tenantIds.includes(tenant.id)}
                                                                        onChange={() => handleTenantSelection(tenant.id, true)}
                                                                    />
                                                                    <span>{tenant.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Properties */}
                                                    <div className="association-group">
                                                        <div className="association-label">{t("Properties")}</div>
                                                        <div className="tenant-selection">
                                                            {properties.map(property => (
                                                                <label key={property.id} className="tenant-checkbox">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editFormData.propertyIds.includes(property.id)}
                                                                        onChange={() => handlePropertySelection(property.id, true)}
                                                                    />
                                                                    <span>{property.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Issues */}
                                                    <div className="association-group">
                                                        <div className="association-label">{t("Issues")}</div>
                                                        <div className="tenant-selection">
                                                            {issues.filter(i => i.status !== 'Closed').map(issue => (
                                                                <label key={issue.id} className="tenant-checkbox">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editFormData.issueIds.includes(issue.id)}
                                                                        onChange={() => handleIssueSelection(issue.id, true)}
                                                                    />
                                                                    <span>{issue.title}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>{t("Attachments (Invoices, etc.)")}</label>
                                                <div className="attachment-section">
                                                    <input
                                                        type="text"
                                                        placeholder={t("Enter file name (e.g., invoice_2024.pdf)")}
                                                        className="edit-input"
                                                        onKeyPress={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (e.target.value.trim()) {
                                                                    handleFileAttachment(e.target.value.trim(), true);
                                                                    e.target.value = '';
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    {editFormData.attachments && editFormData.attachments.length > 0 && (
                                                        <div className="attachment-list">
                                                            {editFormData.attachments.map((file, index) => (
                                                                <div key={index} className="attachment-item">
                                                                    <Paperclip size={14} />
                                                                    <span>{file}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeAttachment(index, true)}
                                                                        className="remove-attachment"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="form-actions">
                                                <button type="submit" className="btn-primary small">{t("Save Changes")}</button>
                                                <button type="button" className="btn-outline small" onClick={() => setExpandedCostId(null)}>{t("Cancel")}</button>
                                            </div>
                                        </form>}
                            </ListRow>
                        );
                    })}
                </List>
            ) : (
                <ListEmpty icon={<Euro size={40} />}>{t("Noch keine Kosten erfasst.")}</ListEmpty>
            )}
        </div>
    );
};

export default Costs;
