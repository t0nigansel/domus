import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Building, Ruler, Euro, AlertCircle } from 'lucide-react';
import { PageHeader, CollapsiblePanel, useToast, List, ListRow, ListEmpty, Badge } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import { ISSUE_STATUS } from '../constants/status';

const Properties = () => {
    const { t } = useTranslation();
    const { properties, issues, addProperty } = useData();
    const [isAddingProperty, setIsAddingProperty] = useQuickAction();
    const { addToast } = useToast();

    // New Property State
    const [newPropertyData, setNewPropertyData] = useState({
        name: '',
        location: '',
        size: '',
        status: 'Occupied',
        condition: 'Good',
        coldRent: '',
        nebenkosten: ''
    });

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            // Ensure numeric values are stored as numbers
            const propertyToAdd = {
                ...newPropertyData,
                size: newPropertyData.size ? Number(newPropertyData.size) : null,
                coldRent: newPropertyData.coldRent ? Number(newPropertyData.coldRent) : 0,
                nebenkosten: newPropertyData.nebenkosten ? Number(newPropertyData.nebenkosten) : 0
            };

            await addProperty(propertyToAdd);
            setIsAddingProperty(false);
            setNewPropertyData({
                name: '',
                location: '',
                size: '',
                status: 'Occupied',
                condition: 'Good',
                coldRent: '',
                nebenkosten: ''
            });
            addToast('Property added successfully');
        } catch {
            addToast('Failed to add property', 'error');
        }
    };

    return (
        <div className="page-container">
            <PageHeader title={t("Properties")} onAction={() => setIsAddingProperty(true)} />

            <CollapsiblePanel title={t("New Property")} isOpen={isAddingProperty} onClose={() => setIsAddingProperty(false)}>
                <form onSubmit={handleAddSubmit}>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Property Name")}</label>
                            <input
                                type="text"
                                required
                                value={newPropertyData.name}
                                onChange={e => setNewPropertyData({ ...newPropertyData, name: e.target.value })}
                                className="edit-input"
                                placeholder={t("e.g. Sunset Apartments, Apt 4")}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Location")}</label>
                            <input
                                type="text"
                                required
                                value={newPropertyData.location}
                                onChange={e => setNewPropertyData({ ...newPropertyData, location: e.target.value })}
                                className="edit-input"
                                placeholder={t("Address or Area")}
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Square Meter (m²)")}</label>
                            <input
                                type="number"
                                min="0"
                                value={newPropertyData.size}
                                onChange={e => setNewPropertyData({ ...newPropertyData, size: e.target.value })}
                                className="edit-input"
                                placeholder={t("e.g. 85")}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Status")}</label>
                            <select
                                value={newPropertyData.status}
                                onChange={e => setNewPropertyData({ ...newPropertyData, status: e.target.value })}
                                className="edit-select"
                            >
                                <option value="Occupied">{t("Occupied")}</option>
                                <option value="Vacant">{t("Vacant")}</option>
                                <option value="Maintenance">{t("Maintenance")}</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Condition")}</label>
                            <select
                                value={newPropertyData.condition}
                                onChange={e => setNewPropertyData({ ...newPropertyData, condition: e.target.value })}
                                className="edit-select"
                            >
                                <option value="Good">{t("Good")}</option>
                                <option value="Needs Repair">{t("Needs Repair")}</option>
                                <option value="Renovated">{t("Renovated")}</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Cold Rent (€)")}</label>
                            <input
                                type="number"
                                min="0"
                                value={newPropertyData.coldRent}
                                onChange={e => setNewPropertyData({ ...newPropertyData, coldRent: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>{t("Nebenkosten (€)")}</label>
                            <input
                                type="number"
                                min="0"
                                value={newPropertyData.nebenkosten}
                                onChange={e => setNewPropertyData({ ...newPropertyData, nebenkosten: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn-primary small">{t("Save Property")}</button>
                        <button type="button" className="btn-outline small" onClick={() => setIsAddingProperty(false)}>{t("Cancel")}</button>
                    </div>
                </form>
            </CollapsiblePanel>

            {properties.length > 0 ? (
                <List>
                    {properties.map(property => {
                        const openIssues = issues.filter(i => i.propertyId === property.id && i.status !== ISSUE_STATUS.CLOSED).length;
                        const nonRental = ['NonRental', 'Usufruct'].includes(property.occupancyKind);
                        const hasRent = Number.isFinite(property.coldRent) && Number.isFinite(property.nebenkosten);
                        return (
                            <ListRow
                                key={property.id}
                                to={`/properties/${property.id}`}
                                icon={<Building size={20} />}
                                title={property.name}
                                subtitle={property.location}
                                meta={<>
                                    {openIssues > 0 && <Badge icon={AlertCircle} tone="warning" title={t("Has Open Issues")}>{t('{count} offen', { count: openIssues })}</Badge>}
                                    {property.size && <Badge icon={Ruler}>{property.size} {t("m²")}</Badge>}
                                    <Badge icon={Euro} tone="strong">{nonRental ? t("Kein Mietverhältnis") : hasRent ? `${property.coldRent + property.nebenkosten} €` : t('Noch offen')}</Badge>
                                </>}
                            />
                        );
                    })}
                </List>
            ) : (
                <ListEmpty icon={<Building size={40} />}>{t("Noch keine Wohnungen angelegt.")}</ListEmpty>
            )}
        </div>
    );
};

export default Properties;
