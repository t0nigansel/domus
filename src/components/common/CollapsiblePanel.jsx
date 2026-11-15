import React from 'react';
import { useTranslation } from '../../i18n';
import { X } from 'lucide-react';

export const CollapsiblePanel = ({ title, isOpen, onClose, children }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div style={{
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-lg)',
            marginBottom: 'var(--spacing-xl)',
            animation: 'slideDown 0.2s ease-out'
        }}>
            <div className="collapsible-panel-heading">
                <h3>{t(title)}</h3>
                {onClose && <button type="button" className="btn-outline" onClick={onClose} aria-label={t('Schließen')}><X size={20} aria-hidden="true" /></button>}
            </div>
            {children}
        </div>
    );
};
