import { useTranslation } from '../i18n';
import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, icon, trend, color = 'primary', ...props }) => {
    const { t } = useTranslation();
    const IconComponent = icon;
    return (
        <div className="stat-card" {...props}>
            <div className={`icon-container bg-${color}`}>
                <IconComponent size={24} color={`var(--color-${color})`} />
            </div>
            <div className="stat-content">
                <p className="stat-title">{t(title)}</p>
                <h3 className="stat-value">{value}</h3>
                {trend && <span className="stat-trend">{t(trend)}</span>}
            </div>
        </div>
    );
};

export default StatCard;
