import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { Mail, Phone, MapPin, BookUser, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { CollapsiblePanel, ConfirmModal, useToast, List, ListRow, ListEmpty, Badge } from '../components/common';
import './Contacts.css';

const emptyContact = { name: '', role: '', description: '', phone: '', email: '', address: '' };

// Ältere Kontakte haben Telefon oder E-Mail nur im Sammelfeld contactInfo.
const toFormData = (contact) => {
    const legacy = (contact.contactInfo || '').trim();
    const legacyIsEmail = legacy.includes('@');
    return {
        name: contact.name || '',
        role: contact.role || '',
        description: contact.description || '',
        phone: contact.phone || (!legacyIsEmail ? legacy : ''),
        email: contact.email || (legacyIsEmail ? legacy : ''),
        address: contact.address || ''
    };
};

// Beim Speichern ist contactInfo in phone/email aufgegangen und wird geleert.
const toPayload = (data) => ({ ...data, contactInfo: '' });

const ContactFields = ({ data, onChange, idPrefix }) => {
    const { t } = useTranslation();
    const field = (name) => ({
        id: `${idPrefix}-${name}`,
        name,
        value: data[name],
        onChange,
        className: 'edit-input'
    });
    return (
        <>
            <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-name`}>
                        {t("Name")} <span className="required-mark" aria-hidden="true">*</span>
                        <span className="visually-hidden"> ({t("Required")})</span>
                    </label>
                    <input {...field('name')} type="text" required maxLength={240} placeholder={t("Full Name or Company")} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-role`}>{t("Function")}</label>
                    <input {...field('role')} type="text" placeholder={t("Electrician, Plumber, etc.")} />
                </div>
            </div>
            <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-phone`}>{t("Phone")}</label>
                    <input {...field('phone')} type="tel" autoComplete="tel" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-email`}>{t("Email")}</label>
                    <input {...field('email')} type="email" autoComplete="email" />
                </div>
            </div>
            <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-address`}>{t("Address")}</label>
                    <textarea {...field('address')} className="edit-textarea" rows={2} autoComplete="street-address" placeholder={t("Street, postal code, city")} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-description`}>{t("Description")}</label>
                    <textarea {...field('description')} className="edit-textarea" rows={2} placeholder={t("Additional notes")} />
                </div>
            </div>
        </>
    );
};

// Add form for the combined contacts page; `children` renders above the form (type switch).
export const ContactAddPanel = ({ isOpen, onClose, children }) => {
    const { t } = useTranslation();
    const { addContact } = useData();
    const { addToast } = useToast();
    const isAddingContact = isOpen;
    const setIsAddingContact = (open) => { if (!open) onClose(); };

    // New Contact State
    const [newContactData, setNewContactData] = useState(emptyContact);

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        try {
            await addContact(toPayload(newContactData));
            setIsAddingContact(false);
            setNewContactData(emptyContact);
            addToast('Contact added successfully');
        } catch {
            addToast('Failed to add contact', 'error');
        }
    };

    const handleNewChange = (e) => {
        const { name, value } = e.target;
        setNewContactData(prev => ({ ...prev, [name]: value }));
    };

    return (
            <CollapsiblePanel title={t("New Contact")} isOpen={isAddingContact} onClose={() => setIsAddingContact(false)}>
                {children}
                <form onSubmit={handleAddSubmit}>
                    <ContactFields data={newContactData} onChange={handleNewChange} idPrefix="new-contact" />
                    <div className="form-actions">
                        <button type="submit" className="btn-primary small">{t("Save Contact")}</button>
                        <button type="button" className="btn-outline small" onClick={() => setIsAddingContact(false)}>{t("Cancel")}</button>
                    </div>
                </form>
            </CollapsiblePanel>
    );
};

export const ContactList = () => {
    const { t } = useTranslation();
    const { contacts, updateContact, deleteContact } = useData();
    const { addToast } = useToast();

    // Inline expansion state
    const [expandedContactId, setExpandedContactId] = useState(null);
    const [editFormData, setEditFormData] = useState(emptyContact);

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({ open: false, contactId: null, contactName: '' });

    const handleInlineSave = async (e, id) => {
        e.preventDefault();
        try {
            await updateContact(id, toPayload(editFormData));
            setExpandedContactId(null);
            addToast('Contact updated successfully');
        } catch {
            addToast('Failed to update contact', 'error');
        }
    };

    const toggleExpand = (contact) => {
        if (expandedContactId === contact.id) {
            setExpandedContactId(null);
        } else {
            setExpandedContactId(contact.id);
            setEditFormData(toFormData(contact));
        }
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const confirmDelete = async () => {
        try {
            await deleteContact(deleteModal.contactId);
            setExpandedContactId(null);
            setDeleteModal({ open: false, contactId: null, contactName: '' });
            addToast('Contact deleted successfully');
        } catch {
            addToast('Failed to delete contact', 'error');
        }
    };

    return (
        <>
            {contacts.length === 0 && <ListEmpty icon={<BookUser size={40} />}>{t("Noch keine weiteren Kontakte.")}</ListEmpty>}
            <List>
                {contacts.map(contact => {
                    const isExpanded = expandedContactId === contact.id;
                    const { phone, email, address } = toFormData(contact);
                    return (
                        <ListRow
                            key={contact.id}
                            expanded={isExpanded}
                            onToggle={() => toggleExpand(contact)}
                            icon={<BookUser size={20} />}
                            title={contact.name}
                            titleExtra={contact.role && <Badge tone="primary">{contact.role}</Badge>}
                            subtitle={contact.description}
                            meta={<>
                                {phone && <a className="list-badge" href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone size={14} aria-hidden="true" />{phone}</a>}
                                {email && <a className="list-badge" href={`mailto:${email}`}><Mail size={14} aria-hidden="true" />{email}</a>}
                                {address && <Badge icon={MapPin}>{address.split(/\s*\n\s*/).join(', ')}</Badge>}
                            </>}
                        >
                                    <form onSubmit={(e) => handleInlineSave(e, contact.id)}>
                                        <ContactFields data={editFormData} onChange={handleEditFormChange} idPrefix={`contact-${contact.id}`} />
                                        <div className="form-actions">
                                            <button type="submit" className="btn-primary small">{t("Save Changes")}</button>
                                            <button type="button" className="btn-outline small" onClick={() => setExpandedContactId(null)}>{t("Cancel")}</button>
                                            <button
                                                type="button"
                                                className="btn-danger small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteModal({ open: true, contactId: contact.id, contactName: contact.name });
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
                title={t("Delete Contact")}
                message={t('Are you sure you want to permanently delete {name}?', { name: deleteModal.contactName })}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteModal({ open: false, contactId: null, contactName: '' })}
            />
        </>
    );
};
