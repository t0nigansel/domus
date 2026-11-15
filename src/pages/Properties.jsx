import { useTranslation } from '../i18n';
import Buildings from './Buildings';
import React, { useState } from 'react';
import { useNavigate, useMatch, useSearchParams } from 'react-router-dom';
import { PropertyPage } from './PropertyDetails';
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
    const expandedId = useMatch('/properties/:id')?.params.id;
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

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
                            <label htmlFor="new-property-name">{t("Property Name")}</label>
                            <input
                                id="new-property-name"
                                type="text"
                                required
                                value={newPropertyData.name}
                                onChange={e => setNewPropertyData({ ...newPropertyData, name: e.target.value })}
                                className="edit-input"
                                placeholder={t("e.g. Sunset Apartments, Apt 4")}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label htmlFor="new-property-location">{t("Location")}</label>
                            <input
                                id="new-property-location"
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
                            <label htmlFor="new-property-size">{t("Square Meter (m²)")}</label>
                            <input
                                id="new-property-size"
                                type="number"
                                min="0"
                                value={newPropertyData.size}
                                onChange={e => setNewPropertyData({ ...newPropertyData, size: e.target.value })}
                                className="edit-input"
                                placeholder={t("e.g. 85")}
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label htmlFor="new-property-status">{t("Status")}</label>
                            <select
                                id="new-property-status"
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
                            <label htmlFor="new-property-condition">{t("Condition")}</label>
                            <select
                                id="new-property-condition"
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
                            <label htmlFor="new-property-rent">{t("Cold Rent (€)")}</label>
                            <input
                                id="new-property-rent"
                                type="number"
                                min="0"
                                value={newPropertyData.coldRent}
                                onChange={e => setNewPropertyData({ ...newPropertyData, coldRent: e.target.value })}
                                className="edit-input"
                            />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label htmlFor="new-property-utilities">{t("Nebenkosten (€)")}</label>
                            <input
                                id="new-property-utilities"
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

            <Buildings />
            {expandedId && !properties.some(property => property.id === expandedId) && <p role="alert">{t('Wohnung nicht gefunden.')}</p>}
            {properties.length > 0 ? (
                <List>
                    {properties.map(property => {
                        const openIssues = issues.filter(i => i.propertyId === property.id && i.status !== ISSUE_STATUS.CLOSED).length;
                        const nonRental = ['NonRental', 'Usufruct'].includes(property.occupancyKind);
                        const hasRent = Number.isFinite(property.coldRent) && Number.isFinite(property.nebenkosten);
                        return (
                            <ListRow
                                key={property.id}
                                expanded={expandedId === property.id}
                                onToggle={() => navigate(expandedId === property.id ? '/properties' : `/properties/${property.id}`, { preventScrollReset: true })}
                                icon={<Building size={20} />}
                                title={property.name}
                                subtitle={property.location}
                                meta={<>
                                    {openIssues > 0 && <Badge icon={AlertCircle} tone="warning" title={t("Has Open Issues")}>{t('{count} offen', { count: openIssues })}</Badge>}
                                    {property.size && <Badge icon={Ruler}>{property.size} {t("m²")}</Badge>}
                                    <Badge icon={Euro} tone="strong">{nonRental ? t("Kein Mietverhältnis") : hasRent ? `${property.coldRent + property.nebenkosten} €` : t('Noch offen')}</Badge>
                                </>}
                            >
                                <PropertyPage
                                    key={`${property.id}-${searchParams.get('tab')}-${searchParams.get('new')}`}
                                    property={property}
                                    embedded
                                    initialTab={searchParams.get('tab')}
                                    startNew={searchParams.get('new') === '1'}
                                />
                            </ListRow>
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
