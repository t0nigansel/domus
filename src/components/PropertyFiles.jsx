import React, { useState } from 'react';
import { useTranslation } from '../i18n';
import { useData } from '../context/DataContext';
import { ListToolbar } from './common';
import DocumentWorkspace from '../pages/DocumentWorkspace';
import { DOCUMENT_CATEGORIES } from '../domain/documents';

export default function PropertyFiles({ property }) {
    const { t } = useTranslation();
    const { documents } = useData();
    const [uploading, setUploading] = useState(false);
    const [category, setCategory] = useState('All');
    const [search, setSearch] = useState('');
    const files = documents.filter(file => file.propertyId === property.id);
    const categories = ['Photos', 'Leases', 'FloorPlans', 'Energy', 'Invoices', 'Insurance', 'Misc', 'Exposes', 'Statements'].map(key => [key, DOCUMENT_CATEGORIES[key]]);
    return <section className="details-card" aria-label={t('Fotos & Dokumente')}>
        <div className="card-header-row"><h2 className="card-title">{t('Fotos & Dokumente')} ({files.length})</h2><button className="btn-outline" onClick={() => setUploading(!uploading)} aria-expanded={uploading}>{t('Dateien hinzufügen')}</button></div>
        {uploading && <DocumentWorkspace propertyId={property.id} showFiles={false} />}
        <ListToolbar search={{ value: search, onChange: setSearch, placeholder: t('Search files...') }} filters={[
            ['All', t('Alle'), files.length], ...categories.map(([key, label]) => [key, t(label), files.filter(file => file.category === key).length]),
        ]} filter={category} onFilter={setCategory} filterLabel={t('Categories')} />
        {files.length === 0 && <p className="text-muted">{t('Noch keine Dateien zugeordnet.')}</p>}
        {categories.filter(([key]) => (category === 'All' || category === key) && files.some(file => file.category === key && file.name.toLowerCase().includes(search.toLowerCase()))).map(([key, label]) => <div className="property-file-group" key={key}>
            <h3>{t(label)}</h3>
            <DocumentWorkspace propertyId={property.id} categoryFilter={key} searchTerm={search} showControls={false} gallery={key === 'Photos'} />
        </div>)}
        {files.length > 0 && !files.some(file => (category === 'All' || category === file.category) && file.name.toLowerCase().includes(search.toLowerCase())) && <p className="text-muted">{t('Keine passenden Dateien gefunden.')}</p>}
    </section>;
}
