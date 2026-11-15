import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { PageHeader, CollapsiblePanel, ListToolbar } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import DocumentWorkspace from './DocumentWorkspace';
import { DOCUMENT_CATEGORIES, documentInUploadRange } from '../domain/documents';

const Documents = () => {
    const { t } = useTranslation();
    const { documents } = useData();
    const [isAddingDocument, setIsAddingDocument] = useQuickAction();
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [uploadedFrom, setUploadedFrom] = useState('');
    const [uploadedTo, setUploadedTo] = useState('');
    const documentsInRange = documents.filter(document => documentInUploadRange(document, uploadedFrom, uploadedTo));

    // Gleiche Zuordnung wie der Filter in DocumentWorkspace (d.category === Kategorie).
    const categoryCounts = documentsInRange.reduce((counts, document) => {
        counts[document.category] = (counts[document.category] || 0) + 1;
        return counts;
    }, { All: documentsInRange.length });
    const filters = [['All', t('Alle'), documentsInRange.length], ...Object.entries(DOCUMENT_CATEGORIES).filter(([key]) => key === selectedCategory || categoryCounts[key]).map(([key, label]) => [key, t(label), categoryCounts[key] || 0])];

    return (
        <div className="page-container">
            <PageHeader title={t("Documents")} onAction={() => setIsAddingDocument(true)} />

            <CollapsiblePanel title={t("Upload Document")} isOpen={isAddingDocument} onClose={() => setIsAddingDocument(false)}>
                <DocumentWorkspace showFiles={false} />
            </CollapsiblePanel>

            {documents.length > 0 && <><ListToolbar
                search={{ value: searchTerm, onChange: setSearchTerm, placeholder: t("Search files...") }}
                filters={filters}
                filter={selectedCategory}
                onFilter={setSelectedCategory}
                filterLabel={t("Categories")}
            />

            <div className="document-date-filters" role="group" aria-label={t('Upload-Zeitraum')}>
                <label>
                    {t('Hochgeladen von')}
                    <input className="edit-input" type="date" value={uploadedFrom} max={uploadedTo || undefined} onChange={e => setUploadedFrom(e.target.value)} />
                </label>
                <label>
                    {t('Hochgeladen bis')}
                    <input className="edit-input" type="date" value={uploadedTo} min={uploadedFrom || undefined} onChange={e => setUploadedTo(e.target.value)} />
                </label>
                {(uploadedFrom || uploadedTo) && <button type="button" className="btn-outline" onClick={() => { setUploadedFrom(''); setUploadedTo(''); }}>{t('Zeitraum zurücksetzen')}</button>}
            </div>
            </>}

            <DocumentWorkspace showControls={false} categoryFilter={selectedCategory} searchTerm={searchTerm} uploadedFrom={uploadedFrom} uploadedTo={uploadedTo} />
        </div>
    );
};

export default Documents;
