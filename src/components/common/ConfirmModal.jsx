import { useTranslation } from '../../i18n';
import React from 'react';
import { AlertCircle } from 'lucide-react';

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Delete', confirmType = 'danger' }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--color-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
        }} onClick={onCancel}>
            <div style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-xl)',
                width: '100%',
                maxWidth: '400px',
                boxShadow: 'var(--shadow-xl)',
                animation: 'scaleIn 0.2s ease-out'
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                    <div style={{
                        padding: '8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: confirmType === 'danger' ? 'var(--color-danger-soft)' : 'var(--color-primary-soft)',
                        color: confirmType === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)'
                    }}>
                        <AlertCircle size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem' }}>{t(title)}</h3>
                </div>

                <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-xl)', lineHeight: '1.6' }}>
                    {t(message)}
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)' }}>
                    <button className="btn-outline" onClick={onCancel}>{t("Cancel")}</button>
                    <button
                        className={confirmType === 'danger' ? 'btn-danger' : 'btn-primary'}
                        onClick={onConfirm}
                    >
                        {t(confirmText)}
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
