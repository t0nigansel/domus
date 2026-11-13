import { useTranslation } from '../i18n';
import React, { createContext, useContext } from 'react';
import { useProperties, useTenants, useIssues, useCosts, useContacts, useDocuments } from '../hooks/domain';
import { ToastProvider } from '../components/common';

const DataContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
    return useContext(DataContext);
};

export const DataProvider = ({ children }) => {
    const { t } = useTranslation();
    // Domain Hooks
    const {
        properties, loading: propertiesLoading, error: propertiesError,
        addProperty, updateProperty, refreshProperties
    } = useProperties();

    // Tenants need access to properties for "Unknown Property" fallback and occupant counting
    // Note: If properties are not loaded yet, tenants hook might get empty array initially, which is fine.
    const {
        tenants, loading: tenantsLoading, error: tenantsError,
        addTenant, updateTenant, removeTenant, deleteTenant, refreshTenants
    } = useTenants(properties);

    const {
        issues, loading: issuesLoading, error: issuesError,
        addIssue, updateIssue, resolveIssue, refreshIssues
    } = useIssues();

    const {
        costs, loading: costsLoading, error: costsError,
        addCost, updateCost, refreshCosts
    } = useCosts();

    const {
        contacts, loading: contactsLoading, error: contactsError,
        addContact, updateContact, deleteContact, refreshContacts
    } = useContacts();

    const {
        documents, loading: documentsLoading, error: documentsError,
        addDocument, refreshDocuments
    } = useDocuments();

    // Aggregate loading and error states
    // We consider it loading if ANY critical resource is loading.
    const loading = propertiesLoading || tenantsLoading || issuesLoading || costsLoading || contactsLoading || documentsLoading;

    // Aggregate errors
    const error = propertiesError || tenantsError || issuesError || costsError || contactsError || documentsError;

    const value = {
        // Data
        properties,
        tenants,
        documents,
        issues,
        costs,
        contacts,

        // UI State
        loading,
        error: error ? error.message : null,

        // Methods
        addProperty,
        updateProperty,
        addTenant,
        updateTenant,
        removeTenant,
        deleteTenant,
        addIssue,
        resolveIssue,
        updateIssue,
        addCost,
        updateCost,
        addContact,
        updateContact,
        deleteContact,
        addDocument,
        refreshDocuments,

        // Refresh Methods (exposed if needed for manual refreshes)
        refreshAll: () => Promise.all([
            refreshProperties(), refreshTenants(), refreshIssues(),
            refreshCosts(), refreshContacts(), refreshDocuments()
        ])
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>{t("Loading application data...")}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
                <h3>{t("Error loading data")}</h3>
                <p>{t(error.message || String(error))}</p>
                <p>{import.meta.env.MODE === 'cloud' ? t("Bitte lade die Seite erneut oder melde dich noch einmal an.") : t("Please ensure the API server is running (npm run dev)")}</p>
                <button className="btn-outline" onClick={() => window.location.reload()}>{t("Erneut laden")}</button>
            </div>
        )
    }

    return (
        <ToastProvider>
            <DataContext.Provider value={value}>
                {children}
            </DataContext.Provider>
        </ToastProvider>
    );
};


