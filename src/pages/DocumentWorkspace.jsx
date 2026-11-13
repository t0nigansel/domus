import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { Download, Eye, FileText, Image, File, FolderOpen, Star, Globe, AlertCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useFileWorkspace } from '../hooks/domain/useFileWorkspace';
import { fileService } from '../db/services/fileService';
import { splitDocumentName, DOCUMENT_CATEGORIES as categories } from '../domain/documents';
import { List, ListRow, ListEmpty, Badge } from '../components/common';
import './DocumentWorkspace.css';


export default function DocumentWorkspace({ propertyId = '', showFiles = true, showControls = true, categoryFilter = 'All', searchTerm = '' }) {
    const { t } = useTranslation();
    const { documents, properties, refreshDocuments } = useData();
    const workspace = useFileWorkspace(refreshDocuments);
    const [target, setTarget] = useState(propertyId);
    const [category, setCategory] = useState('Misc');
    const [expandedId, setExpandedId] = useState(null);
    const metadata = { propertyId: propertyId || target || null, category };
    const files = documents.filter(d => (!propertyId || d.propertyId === propertyId) && (categoryFilter === 'All' || d.category === categoryFilter) && d.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => Number(b.cover || false) - Number(a.cover || false) || (a.position || 0) - (b.position || 0));

    return <section className="document-workspace" aria-label={t("Dateien verwalten")}>
        {showControls && <div className="form-row file-controls">
            {!propertyId && <div className="form-group">
                <label htmlFor="upload-target">{t("Wohnung für neue Dateien")}</label>
                <select id="upload-target" className="edit-select" value={target} onChange={e => setTarget(e.target.value)} disabled={workspace.busy}>
                    <option value="">{t("Ohne Wohnungszuordnung")}</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>}
            <div className="form-group">
                <label htmlFor="upload-category">{t("Kategorie für neue Dateien")}</label>
                <select id="upload-category" className="edit-select" value={category} onChange={e => setCategory(e.target.value)} disabled={workspace.busy}>
                    {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="upload-files">{t("Dateien hochladen (bis 20 MB je Datei)")}</label>
                <input id="upload-files" className="edit-input" type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" disabled={workspace.busy} onChange={e => {
                    const selected = Array.from(e.target.files);
                    e.target.value = '';
                    if (selected.length) workspace.upload(selected, metadata);
                }} />
            </div>
            {import.meta.env.MODE !== 'cloud' && <button type="button" className="btn-outline" disabled={workspace.busy} onClick={workspace.scan}>{t("Rohdaten einlesen")}</button>}
        </div>}
        {workspace.busy && <p className="file-status" role="status">{t("Dateien werden verarbeitet …")}</p>}
        {workspace.error && <p className="file-status file-error" role="alert">{t(workspace.error)}</p>}
        {workspace.message && <p className="file-status" role="status">{t(workspace.message)}</p>}
        {workspace.rawFiles !== null && <div className="raw-file-list">
            <h3>{t("Dateien aus rohdaten/")}</h3>
            <p className="text-muted">{t("Wähle die passende Kategorie und importiere die gewünschte Datei. Originale bleiben erhalten.")}</p>
            {workspace.rawFiles.length === 0 && <p>{t("Keine unterstützten Dateien gefunden.")}</p>}
            {workspace.rawFiles.map(file => <div className="raw-file-row" key={file.path}>
                <span>{file.path}</span>
                <button type="button" className="btn-outline" disabled={workspace.busy || file.bytes > 20 * 1024 * 1024} onClick={() => workspace.importRaw(file.path, metadata)}>
                    {file.bytes > 20 * 1024 * 1024 ? t("Größer als 20 MB") : t("Importieren")}
                </button>
            </div>)}
        </div>}
        {showFiles && (files.length === 0
            ? <ListEmpty icon={<FolderOpen size={40} />}>{t("Noch keine Dateien zugeordnet.")}</ListEmpty>
            : <List>
                {files.map(file => <DocumentRow
                    key={`${file.id}-${file.propertyId}`}
                    file={file}
                    properties={properties}
                    showProperty={!propertyId}
                    busy={workspace.busy}
                    expanded={expandedId === file.id}
                    onToggle={() => setExpandedId(expandedId === file.id ? null : file.id)}
                    onSave={workspace.update}
                />)}
            </List>)}
    </section>;
}

const FileIcon = ({ file }) => {
    if (file.hasFile && file.type === 'image') return <img src={fileService.url(file.id, true)} alt="" loading="lazy" />;
    if (file.type === 'pdf') return <FileText size={20} />;
    if (file.type === 'image') return <Image size={20} />;
    return <File size={20} />;
};

function DocumentRow({ file, properties, showProperty, busy, expanded, onToggle, onSave }) {
    const { t } = useTranslation();
    const propertyName = file.propertyId ? properties.find(p => p.id === file.propertyId)?.name : null;
    const subtitle = [
        t(categories[file.category] || file.category),
        showProperty && (propertyName || t("Ohne Wohnungszuordnung")),
        file.date,
    ].filter(Boolean).join(' · ');

    return <ListRow
        expanded={expanded}
        onToggle={onToggle}
        icon={<FileIcon file={file} />}
        title={file.name}
        subtitle={subtitle}
        meta={<>
            {file.cover && <Badge icon={Star} tone="primary">{t("Titelbild")}</Badge>}
            {file.published && <Badge icon={Globe} tone="primary" title={t("Für Inserate freigegeben")}>{t("Freigegeben")}</Badge>}
            {!file.hasFile && <Badge icon={AlertCircle} tone="warning" title={t("Nur Metadaten vorhanden; Datei noch nicht hinterlegt.")}>{t("Ohne Datei")}</Badge>}
            {file.version > 1 && <Badge>{`V${file.version}`}</Badge>}
            {file.size && <Badge>{file.size}</Badge>}
            {file.hasFile && <a className="list-badge" href={fileService.url(file.id)} download aria-label={t("Herunterladen")} title={t("Herunterladen")}><Download size={14} aria-hidden="true" /></a>}
        </>}
    >
        <DocumentEditor file={file} properties={properties} busy={busy} onSave={onSave} onClose={onToggle} />
    </ListRow>;
}

function DocumentEditor({ file, properties, busy, onSave, onClose }) {
    const { t } = useTranslation();
    // Die Dateiendung bleibt fest, nur der Name davor ist änderbar.
    const { base, extension } = splitDocumentName(file.name);
    const [values, setValues] = useState({ name: base, propertyId: file.propertyId || '', category: file.category || 'Misc', caption: file.caption || '', position: file.position || 0, published: file.published || false, cover: file.cover || false });
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    const id = (name) => `doc-${file.id}-${name}`;

    return <div className="document-editor">
        {file.hasFile ? <div className="document-preview">
            {file.type === 'image' && <img className="document-thumbnail" src={fileService.url(file.id, true)} alt={file.caption || file.name} loading="lazy" />}
            <div className="file-actions">
                <a className="btn-outline small" href={fileService.url(file.id)} download><Download size={16} aria-hidden="true" />{t("Herunterladen")}</a>
                {['image', 'pdf'].includes(file.type) && <a className="btn-outline small" href={fileService.url(file.id, true)} target="_blank" rel="noreferrer"><Eye size={16} aria-hidden="true" />{t("Ansehen")}</a>}
            </div>
        </div> : <p className="text-muted">{t("Nur Metadaten vorhanden; Datei noch nicht hinterlegt.")}</p>}

        <form onSubmit={e => { e.preventDefault(); onSave(file.id, { ...values, name: values.name.trim() + extension }); }}>
            <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={id('name')}>{t("Dokumentname")}</label>
                    <span className="file-name-input">
                        <input id={id('name')} className="edit-input" required maxLength={240 - extension.length} value={values.name} onChange={e => change('name', e.target.value)} />
                        {extension && <span className="file-name-extension">{extension}</span>}
                    </span>
                </div>
            </div>
            <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={id('property')}>{t("Wohnungszuordnung")}</label>
                    <select id={id('property')} className="edit-select" value={values.propertyId} onChange={e => change('propertyId', e.target.value)}>
                        <option value="">{t("Keine")}</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={id('category')}>{t("Kategorie")}</label>
                    <select id={id('category')} className="edit-select" value={values.category} onChange={e => change('category', e.target.value)}>
                        {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
                    </select>
                </div>
            </div>
            <div className="form-row">
                <div className="form-group" style={{ flex: 3 }}>
                    <label htmlFor={id('caption')}>{t("Raum / Beschreibung")}</label>
                    <input id={id('caption')} className="edit-input" maxLength={2000} value={values.caption} onChange={e => change('caption', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor={id('position')}>{t("Reihenfolge")}</label>
                    <input id={id('position')} className="edit-input" type="number" min="0" step="1" required value={values.position} onChange={e => change('position', Number(e.target.value))} />
                </div>
            </div>
            <div className="form-row file-checkboxes">
                <label className="file-checkbox"><input type="checkbox" checked={values.published} onChange={e => change('published', e.target.checked)} />{t("Für Inserate freigegeben")}</label>
                {file.type === 'image' && <label className="file-checkbox"><input type="checkbox" checked={values.cover} onChange={e => change('cover', e.target.checked)} />{t("Als Titelbild verwenden")}</label>}
            </div>
            <div className="form-actions">
                <button className="btn-primary small" disabled={busy}>{t("Speichern")}</button>
                <button type="button" className="btn-outline small" onClick={onClose}>{t("Cancel")}</button>
            </div>
        </form>
    </div>;
}
