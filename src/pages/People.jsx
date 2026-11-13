import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useData } from '../context/DataContext';
import { PageHeader, ListToolbar, ListSection } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import { TenantAddPanel, TenantList } from './Tenants';
import { ContactAddPanel, ContactList } from './Contacts';
import './People.css';

const FILTERS = [['all', 'Alle'], ['tenants', 'Mieter'], ['other', 'Weitere Kontakte']];

// One address book for everyone: tenants and other contacts stay separate records, shown together.
export default function People() {
    const { t } = useTranslation();
    const { tenants, contacts } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = FILTERS.some(([key]) => key === searchParams.get('filter')) ? searchParams.get('filter') : 'all';
    const [isAdding, setIsAdding] = useQuickAction();
    const [addType, setAddType] = useState(filter === 'tenants' ? 'tenant' : 'contact');
    const close = () => setIsAdding(false);
    const counts = { all: tenants.length + contacts.length, tenants: tenants.length, other: contacts.length };
    const typeSwitch = (
        <div className="people-switch" role="group" aria-label={t("Art des Kontakts")}>
            {[['tenant', 'Mieter'], ['contact', 'Sonstiger Kontakt']].map(([key, label]) => (
                <button key={key} type="button" className={addType === key ? 'active' : ''} aria-pressed={addType === key} onClick={() => setAddType(key)}>{t(label)}</button>
            ))}
        </div>
    );
    return (
        <div className="page-container">
            <PageHeader title="Contacts" onAction={() => { setAddType(filter === 'tenants' ? 'tenant' : 'contact'); setIsAdding(true); }} />
            <TenantAddPanel isOpen={isAdding && addType === 'tenant'} onClose={close}>{typeSwitch}</TenantAddPanel>
            <ContactAddPanel isOpen={isAdding && addType === 'contact'} onClose={close}>{typeSwitch}</ContactAddPanel>
            <ListToolbar
                filters={FILTERS.map(([key, label]) => [key, t(label), counts[key]])}
                filter={filter}
                onFilter={key => setSearchParams(key === 'all' ? {} : { filter: key })}
            />
            {filter !== 'other' && (
                <ListSection title={filter === 'all' ? t("Mieter") : null}>
                    <TenantList />
                </ListSection>
            )}
            {filter !== 'tenants' && (
                <ListSection title={filter === 'all' ? t("Weitere Kontakte") : null}>
                    <ContactList />
                </ListSection>
            )}
        </div>
    );
}
