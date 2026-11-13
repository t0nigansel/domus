import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Euro, Home, User, FileText, Settings, Save, X, Activity, Users, PawPrint, Plus, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { issueStatusClass } from '../constants/status';
import './PropertyDetails.css';
import PropertyDossier from './PropertyDossier';
import PropertyRentalSummary from '../components/PropertyRentalSummary';

const PropertyDetails = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const { properties, tenants, issues, updateProperty, addTenant, removeTenant, addIssue, resolveIssue } = useData();
    const property = properties.find(p => p.id === id);
    const propertyTenants = tenants.filter(tenant => tenant.propertyId === id && tenant.status === 'Active');
    const propertyIssues = issues.filter(i => i.propertyId === id);

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});

    // Add Tenant State
    const [isAddingTenant, setIsAddingTenant] = useState(false);
    const [newTenantData, setNewTenantData] = useState({ name: '', email: '', phone: '' });

    // Add Issue State
    const [isAddingIssue, setIsAddingIssue] = useState(false);
    const [newIssueData, setNewIssueData] = useState({ title: '', description: '', priority: 'Medium' });

    const handleEdit = () => {
        if (property) {
            setFormData({
                name: property.name,
                location: property.location,
                coldRent: property.coldRent,
                nebenkosten: property.nebenkosten,
                status: property.status,
                condition: property.condition,
                occupants: property.occupants,
                pets: property.pets,
                notes: property.notes
            });
            setIsEditing(true);
        }
    };

    const handleSave = () => {
        updateProperty(property.id, formData);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: (name === 'coldRent' || name === 'nebenkosten' || name === 'occupants') ? parseFloat(value) : value
        }));
    };

    const handleAddTenantSubmit = (e) => {
        e.preventDefault();
        addTenant(property.id, newTenantData);
        setIsAddingTenant(false);
        setNewTenantData({ name: '', email: '', phone: '' });
    };

    const handleAddIssueSubmit = (e) => {
        e.preventDefault();
        addIssue({
            ...newIssueData,
            propertyId: property.id
        });
        setIsAddingIssue(false);
        setNewIssueData({ title: '', description: '', priority: 'Medium' });
    };

    if (!property) {
        return (
            <div className="property-not-found">
                <h2>{t("Property Not Found")}</h2>
                <Link to="/properties" className="btn-primary">{t("Back to Properties")}</Link>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'Occupied': return 'var(--status-success)';
            case 'Vacant': return 'var(--status-error)';
            case 'Maintenance': return 'var(--status-warning)';
            default: return 'var(--color-text-muted)';
        }
    };

    return (
        <div className="property-details-container">
            {/* Header / Breadcrumb */}
            <div className="details-header-nav">
                <Link to="/properties" className="back-link">
                    <ArrowLeft size={20} />
                    <span>{t("Back to Properties")}</span>
                </Link>
            </div>

            {/* Main Header */}
            <header className="details-header">
                <div style={{ flex: 1 }}>
                    <div className="title-row">
                        {isEditing ? (
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="edit-input title-input"
                            />
                        ) : (
                            <h1 className="details-title">{property.name}</h1>
                        )}

                        {isEditing ? (
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="edit-select status-select"
                            >
                                <option value="Occupied">{t("Occupied")}</option>
                                <option value="Vacant">{t("Vacant")}</option>
                                <option value="Maintenance">{t("Maintenance")}</option>
                            </select>
                        ) : (
                            <span
                                className="status-badge-large"
                                style={{
                                    backgroundColor: getStatusColor(property.status),
                                    color: property.status === 'Occupied' ? 'var(--color-success)' :
                                        property.status === 'Vacant' ? 'var(--color-danger)' : 'var(--color-warning)'
                                }}
                            >
                                {t(property.status)}
                            </span>
                        )}
                    </div>

                    <div className="address-row">
                        <MapPin size={18} className="text-muted" />
                        {isEditing ? (
                            <select
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                className="edit-select"
                            >
                                <option value="Bottom Left">{t("Bottom Left")}</option>
                                <option value="Bottom Right">{t("Bottom Right")}</option>
                                <option value="Top Left">{t("Top Left")}</option>
                                <option value="Top Right">{t("Top Right")}</option>
                            </select>
                        ) : (
                            <span className="text-muted">{property.location}</span>
                        )}
                    </div>
                </div>

                <div className="action-buttons-group">
                    {isEditing ? (
                        <>
                            <button className="btn-primary" onClick={handleSave}>
                                <Save size={18} />
                                <span>{t("Save")}</span>
                            </button>
                            <button className="btn-outline" onClick={handleCancel}>
                                <X size={18} />
                                <span>{t("Cancel")}</span>
                            </button>
                        </>
                    ) : (
                        <button className="btn-outline" onClick={handleEdit}>
                            <Settings size={18} />
                            <span>{t("Edit Property")}</span>
                        </button>
                    )}
                </div>
            </header>

            <PropertyDossier key={property.id} property={property} />
            <PropertyRentalSummary key={`rental-${property.id}`} property={property} />

            <div className="details-grid">
                {/* Left Column: Stats & Info */}
                <div className="details-main">
                    {/* Key Stats */}
                    <section className="details-card">
                        <h2 className="card-title">{t("Property Overview")}</h2>
                        <div className="stats-row">
                            {/* Rent Section */}
                            <div className="stat-item full-width-mobile">
                                <Euro className="stat-icon" />
                                <div>
                                    <p className="label">{t("Monthly Rent (Total)")}</p>
                                    <div className="value-group">
                                        {isEditing ? (
                                            <div className="rent-edit-group">
                                                <div className="input-group">
                                                    <label>{t("Cold")}</label>
                                                    <input
                                                        type="number"
                                                        name="coldRent"
                                                        value={formData.coldRent}
                                                        onChange={handleChange}
                                                        className="edit-input"
                                                        style={{ width: '80px' }}
                                                    />
                                                </div>
                                                <span>+</span>
                                                <div className="input-group">
                                                    <label>{t("Utils")}</label>
                                                    <input
                                                        type="number"
                                                        name="nebenkosten"
                                                        value={formData.nebenkosten}
                                                        onChange={handleChange}
                                                        className="edit-input"
                                                        style={{ width: '80px' }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="rent-display">
                                                <span className="value">{['NonRental', 'Usufruct'].includes(property.occupancyKind) ? t("Kein Mietverhältnis") : Number.isFinite(property.coldRent) && Number.isFinite(property.nebenkosten) ? `${property.coldRent + property.nebenkosten} €` : t("Noch offen")}</span>
                                                {Number.isFinite(property.coldRent) && Number.isFinite(property.nebenkosten) && <span className="small-detail">({property.coldRent} € + {property.nebenkosten} €)</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Condition */}
                            <div className="stat-item">
                                <Activity className="stat-icon" />
                                <div>
                                    <p className="label">{t("Condition")}</p>
                                    {isEditing ? (
                                        <select
                                            name="condition"
                                            value={formData.condition}
                                            onChange={handleChange}
                                            className="edit-select"
                                        >
                                            <option value="Good">{t("Good")}</option>
                                            <option value="Ok">{t("Ok")}</option>
                                            <option value="Bad">{t("Bad")}</option>
                                        </select>
                                    ) : (
                                        <p className="value">{t(property.condition)}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="stats-row mt-4">
                            {/* Occupants */}
                            <div className="stat-item">
                                <Users className="stat-icon" />
                                <div>
                                    <p className="label">{t("Occupants")}</p>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            name="occupants"
                                            value={formData.occupants}
                                            onChange={handleChange}
                                            className="edit-input"
                                            style={{ width: '60px' }}
                                        />
                                    ) : (
                                        <p className="value">{property.occupants}</p>
                                    )}
                                </div>
                            </div>

                            {/* Pets */}
                            <div className="stat-item">
                                <PawPrint className="stat-icon" />
                                <div>
                                    <p className="label">{t("Pets")}</p>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            name="pets"
                                            value={formData.pets}
                                            onChange={handleChange}
                                            className="edit-input"
                                            style={{ width: '120px' }}
                                        />
                                    ) : (
                                        <p className="value">{property.pets}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Tenant Information Multi-View */}
                    <section className="details-card">
                        <div className="card-header-row">
                            <h2 className="card-title">{t("Tenants (")}{propertyTenants.length})</h2>
                            {property.leaseManaged ? <Link className="btn-text" to={`/rentals?propertyId=${property.id}`}>{t("Mietverhältnisse verwalten")}</Link> : !isAddingTenant && (
                                <button className="btn-text" onClick={() => setIsAddingTenant(true)}>
                                    <Plus size={16} />{t("Add Tenant")}</button>
                            )}
                        </div>
                        {isAddingTenant && (
                            <form onSubmit={handleAddTenantSubmit} className="add-tenant-form">
                                <div className="form-row">
                                    <input
                                        type="text"
                                        placeholder={t("Full Name")}
                                        required
                                        value={newTenantData.name}
                                        onChange={e => setNewTenantData({ ...newTenantData, name: e.target.value })}
                                        className="edit-input"
                                    />
                                    <input
                                        type="email"
                                        placeholder={t("Email")}
                                        value={newTenantData.email}
                                        onChange={e => setNewTenantData({ ...newTenantData, email: e.target.value })}
                                        className="edit-input"
                                    />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" className="btn-primary small">{t("Add")}</button>
                                    <button type="button" className="btn-outline small" onClick={() => setIsAddingTenant(false)}>{t("Cancel")}</button>
                                </div>
                            </form>
                        )}
                        {propertyTenants.length > 0 ? (
                            <div className="tenant-list-grid">
                                {propertyTenants.map(tenant => (
                                    <div key={tenant.id} className="tenant-info-card">
                                        <div className="tenant-header">
                                            <div className="tenant-avatar">
                                                <User size={20} />
                                            </div>
                                            <div className="tenant-meta">
                                                <Link to={`/tenants/${tenant.id}`} className="tenant-link">
                                                    <h3>{tenant.name}</h3>
                                                </Link>
                                                <p className="text-muted small">{tenant.email || t("No email")}</p>
                                            </div>
                                            <button
                                                className="btn-icon-danger"
                                                title={tenant.leaseManaged ? t("Mietverhältnis unter Vermietungen beenden") : t("Remove Tenant")}
                                                disabled={tenant.leaseManaged}
                                                onClick={() => removeTenant(tenant.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-tenant-state">
                                <User size={48} className="text-muted" style={{ opacity: 0.3 }} />
                                <p>{t("No tenants assigned.")}</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Issues Section - Moved to main column for better visibility */}
                <div className="details-main" style={{ marginTop: 'var(--spacing-lg)' }}>
                    <section className="details-card">
                        <div className="card-header-row">
                            <h2 className="card-title">{t("Issues")}</h2>
                            {!isAddingIssue && (
                                <button className="btn-text" onClick={() => setIsAddingIssue(true)}>
                                    <Plus size={16} />{t("Report Issue")}</button>
                            )}
                        </div>

                        {isAddingIssue && (
                            <form onSubmit={handleAddIssueSubmit} className="add-tenant-form">
                                <div className="form-row">
                                    <input
                                        type="text"
                                        placeholder={t("Issue Title")}
                                        required
                                        value={newIssueData.title}
                                        onChange={e => setNewIssueData({ ...newIssueData, title: e.target.value })}
                                        className="edit-input"
                                        style={{ flex: 2 }}
                                    />
                                    <select
                                        value={newIssueData.priority}
                                        onChange={e => setNewIssueData({ ...newIssueData, priority: e.target.value })}
                                        className="edit-select"
                                        style={{ flex: 1 }}
                                    >
                                        <option value="Low">{t("Low Priority")}</option>
                                        <option value="Medium">{t("Medium Priority")}</option>
                                        <option value="High">{t("High Priority")}</option>
                                    </select>
                                </div>
                                <div className="form-row">
                                    <input
                                        type="text"
                                        placeholder={t("Description")}
                                        value={newIssueData.description}
                                        onChange={e => setNewIssueData({ ...newIssueData, description: e.target.value })}
                                        className="edit-input"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" className="btn-primary small">{t("Save Issue")}</button>
                                    <button type="button" className="btn-outline small" onClick={() => setIsAddingIssue(false)}>{t("Cancel")}</button>
                                </div>
                            </form>
                        )}

                        {propertyIssues.length > 0 ? (
                            <div className="issues-list-grid">
                                {propertyIssues.map(issue => (
                                    <div key={issue.id} className={`issue-card item-status-${issueStatusClass(issue.status)}`}>
                                        <div className="issue-header-row">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Activity size={16} className={issue.status === 'Closed' ? 'text-success' : 'text-warning'} />
                                                <h4 style={{ margin: 0 }}>{issue.title}</h4>
                                            </div>
                                            <span className={`priority-badge ${issue.priority.toLowerCase()}`}>{t(issue.priority)}</span>
                                        </div>
                                        <p className="text-muted small mt-2">{issue.description || t("No description")}</p>
                                        <div className="issue-footer-row mt-3">
                                            <span className="text-muted small">{t("Due:")}{" "}{issue.dueDate || t("No Date")}</span>
                                            {issue.status !== 'Closed' && (
                                                <button
                                                    className="btn-outline small"
                                                    onClick={() => resolveIssue(issue.id)}
                                                >{t("Mark Resolved")}</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>{t("No open issues for this property.")}</p>
                            </div>
                        )}
                    </section>
                </div>

                {/* Right Column: Documents & Tasks */}
                <div className="details-sidebar">
                    <section className="details-card">
                        <h2 className="card-title">{t("Notes")}</h2>
                        {isEditing ? (
                            <textarea
                                name="notes"
                                value={formData.notes || ''}
                                onChange={handleChange}
                                className="edit-textarea"
                                rows="4"
                            />
                        ) : (
                            <p className="text-muted small">
                                {property.notes || t("No notes added.")}
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default PropertyDetails;
