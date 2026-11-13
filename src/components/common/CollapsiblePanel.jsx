import React from 'react';
import { useTranslation } from '../../i18n';

export const CollapsiblePanel = ({ title, isOpen, children }) => {
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
            <h3 style={{ marginBottom: 'var(--spacing-md)', fontSize: '1.125rem' }}>{t(title)}</h3>
            {children}
        </div>
    );
};
