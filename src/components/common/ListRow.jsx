import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useTranslation } from '../../i18n';
import './ListRow.css';

// Klicks auf Links, Buttons oder Formularfelder in der Zusammenfassung klappen die Zeile nicht um.
const isInteractive = (event) => event.target.closest('a, button, input, select, textarea, label') !== null;

/**
 * Einheitliche Listenzeile für alle Hauptmasken.
 * - `to`: ganze Zeile ist ein Link (z. B. Wohnung → Detailseite)
 * - `onToggle` + `expanded`: Zeile klappt auf, `children` ist der Inhalt darunter (meist ein Formular)
 */
export const ListRow = ({ icon, title, titleExtra, subtitle, meta, to, expanded = false, onToggle, muted = false, children }) => {
    const { t } = useTranslation();
    const className = ['list-row', expanded && 'expanded', muted && 'muted', (to || onToggle) && 'interactive'].filter(Boolean).join(' ');

    const summaryContent = (
        <>
            <div className="list-row-identity">
                {icon && <div className="list-row-icon" aria-hidden="true">{icon}</div>}
                <div className="list-row-text">
                    <div className="list-row-title">
                        <h3>{title}</h3>
                        {titleExtra}
                    </div>
                    {subtitle && <div className="list-row-subtitle">{subtitle}</div>}
                </div>
            </div>
            {meta && <div className="list-row-meta">{meta}</div>}
        </>
    );

    if (to) {
        return (
            <div className={className}>
                <Link to={to} className="list-row-summary">
                    {summaryContent}
                    <ChevronRight size={20} className="list-row-chevron" aria-hidden="true" />
                </Link>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="list-row-summary" onClick={onToggle ? (e => { if (!isInteractive(e)) onToggle(); }) : undefined}>
                {summaryContent}
                {onToggle && (
                    <button type="button" className="list-row-toggle" aria-expanded={expanded} aria-label={expanded ? t('Zuklappen') : t('Bearbeiten')} onClick={onToggle}>
                        <ChevronDown size={20} aria-hidden="true" />
                    </button>
                )}
            </div>
            {expanded && children && <div className="list-row-body">{children}</div>}
        </div>
    );
};

export const List = ({ children }) => <div className="list">{children}</div>;

export const ListEmpty = ({ icon, children }) => (
    <div className="list-empty">
        {icon}
        <p>{children}</p>
    </div>
);

export const ListSection = ({ title, children }) => (
    <section className="list-section">
        {title && <h2>{title}</h2>}
        {children}
    </section>
);

/** Kleines Info-Kästchen in der Zeile (Betrag, Datum, Größe …). `tone`: strong | high | medium | low | primary | warning */
export const Badge = ({ icon: Icon, tone, title, children }) => (
    <span className={`list-badge${tone ? ` ${tone}` : ''}`} title={title}>
        {Icon && <Icon size={14} aria-hidden="true" />}
        {children}
    </span>
);

/** Suche und Filter-Chips, immer direkt unter dem Seitenkopf. `filters`: [[wert, label, anzahl?]] */
export const ListToolbar = ({ search, filters, filter, onFilter, filterLabel }) => {
    const { t } = useTranslation();
    return (
        <div className="list-toolbar">
            {search && (
                <label className="list-search">
                    <Search size={18} aria-hidden="true" />
                    <span className="visually-hidden">{search.placeholder}</span>
                    <input type="search" placeholder={search.placeholder} value={search.value} onChange={e => search.onChange(e.target.value)} />
                </label>
            )}
            {filters && (
                <div className="list-filters" role="group" aria-label={filterLabel || t('Filter')}>
                    {filters.map(([value, label, count]) => (
                        <button key={value} type="button" className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => onFilter(value)}>
                            {label}
                            {count !== undefined && <span className="list-filter-count">{count}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
