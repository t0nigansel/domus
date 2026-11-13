import { useTranslation } from '../i18n';
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { PageHeader, CollapsiblePanel, ListToolbar } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import DocumentWorkspace from './DocumentWorkspace';
import { DOCUMENT_CATEGORIES } from '../domain/documents';

const Documents = () => {
    const { t } = useTranslation();
    const { documents } = useData();
    const [isAddingDocument, setIsAddingDocument] = useQuickAction();
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    // Gleiche Zuordnung wie der Filter in DocumentWorkspace (d.category === Kategorie).
    const categoryCounts = documents.reduce((counts, document) => {
        counts[document.category] = (counts[document.category] || 0) + 1;
        return counts;
    }, { All: documents.length });
    const filters = [['All', t('Alle'), documents.length], ...Object.entries(DOCUMENT_CATEGORIES).map(([key, label]) => [key, t(label), categoryCounts[key] || 0])];

    return (
        <div className="page-container">
            <PageHeader title={t("Documents")} onAction={() => setIsAddingDocument(true)} />

            <CollapsiblePanel title={t("Upload Document")} isOpen={isAddingDocument} onClose={() => setIsAddingDocument(false)}>
                <DocumentWorkspace showFiles={false} />
            </CollapsiblePanel>

            <ListToolbar
                search={{ value: searchTerm, onChange: setSearchTerm, placeholder: t("Search files...") }}
                filters={filters}
                filter={selectedCategory}
                onFilter={setSelectedCategory}
                filterLabel={t("Categories")}
            />

            <DocumentWorkspace showControls={false} categoryFilter={selectedCategory} searchTerm={searchTerm} />
        </div>
    );
};

export default Documents;
