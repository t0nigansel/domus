import { useRef, useState } from 'react';
import { File, Paperclip, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import { fileService } from '../db/services/fileService';
import { ISSUE_STATUS, PRIORITY_LEVEL } from '../constants/status';

/**
 * Formular für Anlegen und Bearbeiten eines Anliegens.
 * Felder: Name, Priorität, Beschreibung, Status, Fälligkeit, Anhänge, Betrifft (Haus oder Wohnung).
 */
export default function IssueForm({ value, onChange, properties, onSubmit, onCancel, submitLabel, idPrefix, children, onError }) {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const set = (key, next) => onChange({ ...value, [key]: next });
    const field = (key) => ({ id: `${idPrefix}-${key}`, name: key, value: value[key] ?? '', onChange: e => set(key, e.target.value) });

    const addAttachment = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        if (import.meta.env.MODE === 'cloud') {
            setUploading(true);
            try {
                const { document } = await fileService.upload(file, { propertyId: value.propertyId || null, category: 'Misc' });
                onChange({ ...value, attachments: [...value.attachments, { id: document.id, name: document.name, type: document.type, url: fileService.url(document.id) }] });
            } catch (error) {
                onError?.(error.message);
            } finally {
                setUploading(false);
            }
            return;
        }
        onChange({ ...value, attachments: [...value.attachments, { id: `f${Date.now()}`, name: file.name, url: URL.createObjectURL(file), type: file.type }] });
    };

    return (
        <form className="issue-form" onSubmit={e => { e.preventDefault(); onSubmit(); }} onClick={e => e.stopPropagation()}>
            <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                    <label htmlFor={`${idPrefix}-title`}>{t("Name")} <span className="required-mark" aria-hidden="true">*</span></label>
                    <input {...field('title')} type="text" required maxLength={240} className="edit-input" placeholder={t("z. B. Heizung im Bad tropft")} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-propertyId`}>{t("Betrifft")}</label>
                    <select {...field('propertyId')} className="edit-select">
                        <option value="">{t("Haus")}</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-priority`}>{t("Priority")}</label>
                    <select {...field('priority')} className="edit-select">
                        <option value={PRIORITY_LEVEL.HIGH}>{t("High")}</option>
                        <option value={PRIORITY_LEVEL.MEDIUM}>{t("Medium")}</option>
                        <option value={PRIORITY_LEVEL.LOW}>{t("Low")}</option>
                    </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-status`}>{t("Status")}</label>
                    <select {...field('status')} className="edit-select">
                        <option value={ISSUE_STATUS.OPEN}>{t("Open")}</option>
                        <option value={ISSUE_STATUS.IN_PROGRESS}>{t("In Progress")}</option>
                        <option value={ISSUE_STATUS.CLOSED}>{t("Closed")}</option>
                    </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={`${idPrefix}-dueDate`}>{t("Due Date")} <span className="optional-mark">({t("optional")})</span></label>
                    <input {...field('dueDate')} type="date" className="edit-input" />
                </div>
            </div>

            <div className="form-group">
                <label htmlFor={`${idPrefix}-description`}>{t("Description")}</label>
                <textarea {...field('description')} className="edit-textarea" rows="3" placeholder={t("Was ist passiert, wo genau, seit wann?")} />
            </div>

            <div className="form-group">
                <div className="issue-attachments-header">
                    <span className="issue-form-label">{t("Attachments")} <span className="optional-mark">({t("optional")})</span></span>
                    <input type="file" ref={fileInputRef} hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={addAttachment} />
                    <button type="button" className="btn-text small" disabled={uploading} onClick={() => fileInputRef.current.click()}>
                        <Paperclip size={14} />{uploading ? t("Uploading …") : t("Add File")}
                    </button>
                </div>
                <div className="attachments-list">
                    {value.attachments.length > 0 ? value.attachments.map(file => (
                        <div key={file.id} className="attachment-item">
                            <div className="file-info">
                                <File size={16} className="text-muted" />
                                <a href={file.url} className="file-link" target="_blank" rel="noopener noreferrer">{file.name}</a>
                            </div>
                            <button type="button" className="btn-icon-danger" aria-label={t("Remove")} onClick={() => set('attachments', value.attachments.filter(f => f.id !== file.id))}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    )) : <p className="text-muted small">{t("No attachments.")}</p>}
                </div>
            </div>

            <div className="form-actions">
                <button type="submit" className="btn-primary small" disabled={uploading}>{submitLabel}</button>
                <button type="button" className="btn-outline small" onClick={onCancel}>{t("Cancel")}</button>
                {children}
            </div>
        </form>
    );
}
