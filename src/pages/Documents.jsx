import React, { useState } from 'react';
import { Search, Folder } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageHeader, CollapsiblePanel } from '../components/common';
import { useQuickAction } from '../hooks/useQuickAction';
import './Documents.css';
import DocumentWorkspace from './DocumentWorkspace';

const Documents = () => {
    const { documents } = useData();
    const [isAddingDocument, setIsAddingDocument] = useQuickAction();
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    const categories = ['All', 'Photos', 'FloorPlans', 'Energy', 'Leases', 'Invoices', 'Insurance', 'Misc'];

    return (
        <div className="documents-container">
            <PageHeader title="Documents" onAction={() => setIsAddingDocument(true)} />

            <CollapsiblePanel title="Upload Document" isOpen={isAddingDocument} onClose={() => setIsAddingDocument(false)}>
                <DocumentWorkspace showFiles={false} />
            </CollapsiblePanel>

            <div className="documents-layout">
                {/* Sidebar Filter */}
                <aside className="docs-sidebar">
                    <div className="search-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <nav className="category-nav">
                        <p className="nav-label">Categories</p>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                <Folder size={18} />
                                <span>{cat}</span>
                                {cat === 'All' && <span className="count">{documents.length}</span>}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Grid */}
                <main className="docs-grid-area">
                    <DocumentWorkspace showControls={false} categoryFilter={selectedCategory} searchTerm={searchTerm} />
                </main>
            </div>
        </div>
    );
};

export default Documents;
