import { useTranslation } from '../../i18n';
import React from 'react';
import { Plus } from 'lucide-react';

export const PageHeader = ({ title, description, actionLabel = 'Add', onAction }) => {
    const { t } = useTranslation();
    return (
        <header className="page-header">
            <div>
                <h1 className="page-title">{t(title)}</h1>
                {description && <p className="page-subtitle">{t(description)}</p>}
            </div>
            {onAction && (
                <button className="btn-primary" onClick={onAction}>
                    <Plus size={20} />
                    <span>{t(actionLabel)}</span>
                </button>
            )}
        </header>
    );
};
