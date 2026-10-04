import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useFileWorkspace } from '../hooks/domain/useFileWorkspace';
import { fileService } from '../db/services/fileService';
import './DocumentWorkspace.css';

const categories = { Misc: 'Sonstiges', Photos: 'Fotos', FloorPlans: 'Grundrisse', Energy: 'Energieausweise', Leases: 'Mietverträge', Invoices: 'Rechnungen', Insurance: 'Versicherungen' };

export default function DocumentWorkspace({ propertyId = '', showFiles = true, showControls = true, categoryFilter = 'All', searchTerm = '' }) {
    const { documents, properties, refreshDocuments } = useData();
    const workspace = useFileWorkspace(refreshDocuments);
    const [target, setTarget] = useState(propertyId);
    const [category, setCategory] = useState('Misc');
    const metadata = { propertyId: propertyId || target || null, category };
    const files = documents.filter(d => (!propertyId || d.propertyId === propertyId) && (categoryFilter === 'All' || d.category === categoryFilter) && d.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => Number(b.cover || false) - Number(a.cover || false) || (a.position || 0) - (b.position || 0));

    return <section className="document-workspace" aria-label="Dateien verwalten">
        {showControls && <div className="file-controls">
            {!propertyId && <label>Wohnung für neue Dateien
                <select value={target} onChange={e => setTarget(e.target.value)} disabled={workspace.busy}>
                    <option value="">Ohne Wohnungszuordnung</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </label>}
            <label>Kategorie für neue Dateien
                <select value={category} onChange={e => setCategory(e.target.value)} disabled={workspace.busy}>
                    {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
            </label>
            <label>Dateien hochladen (bis 20 MB je Datei)
                <input type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" disabled={workspace.busy} onChange={e => {
                    const selected = Array.from(e.target.files);
                    e.target.value = '';
                    if (selected.length) workspace.upload(selected, metadata);
                }} />
            </label>
            <button type="button" className="btn-outline" disabled={workspace.busy} onClick={workspace.scan}>Rohdaten einlesen</button>
        </div>}
        {workspace.busy && <p role="status">Dateien werden verarbeitet …</p>}
        {workspace.error && <p className="file-error" role="alert">{workspace.error}</p>}
        {workspace.message && <p role="status">{workspace.message}</p>}
        {workspace.rawFiles !== null && <div className="raw-file-list">
            <h3>Dateien aus rohdaten/</h3>
            <p className="text-muted">Wähle die passende Kategorie und importiere die gewünschte Datei. Originale bleiben erhalten.</p>
            {workspace.rawFiles.length === 0 && <p>Keine unterstützten Dateien gefunden.</p>}
            {workspace.rawFiles.map(file => <div className="raw-file-row" key={file.path}>
                <span>{file.path}</span>
                <button type="button" className="btn-outline" disabled={workspace.busy || file.bytes > 20 * 1024 * 1024} onClick={() => workspace.importRaw(file.path, metadata)}>
                    {file.bytes > 20 * 1024 * 1024 ? 'Größer als 20 MB' : 'Importieren'}
                </button>
            </div>)}
        </div>}
        {showFiles && <div className="managed-files">
            {files.length === 0 && <p className="text-muted">Noch keine Dateien zugeordnet.</p>}
            {files.map(file => <DocumentEditor key={`${file.id}-${file.propertyId}`} file={file} properties={properties} busy={workspace.busy} onSave={workspace.update} />)}
        </div>}
    </section>;
}

function DocumentEditor({ file, properties, busy, onSave }) {
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState({});
    const change = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
    return <article className="managed-file">
        {file.hasFile && file.type === 'image' && <img className="document-thumbnail" src={fileService.url(file.id, true)} alt={file.caption || file.name} loading="lazy" />}
        <div className="managed-file-content">
            <h3>{file.name}</h3>
            <p className="text-muted">{categories[file.category] || file.category} · {file.size} · {file.date}{file.version > 1 ? ` · Version ${file.version}` : ''}</p>
            {file.caption && <p>{file.caption}</p>}
            <p>{file.published ? 'Für Inserate freigegeben' : 'Intern'}{file.cover ? ' · Titelbild' : ''}</p>
            {file.hasFile ? <div className="file-actions">
                <a className="btn-outline" href={fileService.url(file.id)} download>Herunterladen</a>
                {['image', 'pdf'].includes(file.type) && <a className="btn-outline" href={fileService.url(file.id, true)} target="_blank" rel="noreferrer">Ansehen</a>}
            </div> : <p className="text-muted">Nur Metadaten vorhanden; Datei noch nicht hinterlegt.</p>}
            <button type="button" className="btn-outline" onClick={() => { setValues({ propertyId: file.propertyId || '', category: file.category || 'Misc', caption: file.caption || '', position: file.position || 0, published: file.published || false, cover: file.cover || false }); setEditing(!editing); }}>Angaben bearbeiten</button>
            {editing && <form className="file-controls" onSubmit={e => { e.preventDefault(); onSave(file.id, values); }}>
                <label>Wohnungszuordnung<select value={values.propertyId} onChange={e => change('propertyId', e.target.value)}><option value="">Keine</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <label>Kategorie<select value={values.category} onChange={e => change('category', e.target.value)}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label>Raum / Beschreibung<input maxLength={2000} value={values.caption} onChange={e => change('caption', e.target.value)} /></label>
                <label>Reihenfolge<input type="number" min="0" step="1" required value={values.position} onChange={e => change('position', Number(e.target.value))} /></label>
                <label className="file-checkbox"><input type="checkbox" checked={values.published} onChange={e => change('published', e.target.checked)} />Für Inserate freigegeben</label>
                {file.type === 'image' && <label className="file-checkbox"><input type="checkbox" checked={values.cover} onChange={e => change('cover', e.target.checked)} />Als Titelbild verwenden</label>}
                <button className="btn-primary" disabled={busy}>Speichern</button>
                <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Schließen</button>
            </form>}
        </div>
    </article>;
}
