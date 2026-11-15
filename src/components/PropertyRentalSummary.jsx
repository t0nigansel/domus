import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useData } from '../context/DataContext';
import { RENTAL_PHASES, LEASE_STATUSES } from '../domain/rentals';
import { amountLabel } from '../utils/rentalForms';
import '../pages/Rentals.css';

// Vermietung lives inside the property: current lease, running re-letting, and the entry points.
export default function PropertyRentalSummary({ property, workflow }) {
    const { t } = useTranslation();
    const { tenants } = useData();
    const leases = workflow.leases.filter(l => l.propertyId === property.id).sort((a, b) => b.start.localeCompare(a.start));
    const running = workflow.rentals.filter(r => r.propertyId === property.id);
    const overview = `/properties/${property.id}?tab=rental`;
    return (
        <section className="details-card">
            <h2 className="card-title">{t("Mietverhältnisse und Historie")}</h2>
            {workflow.error && <p role="alert" className="rental-error">{t(workflow.error)}</p>}
            {workflow.loading ? <p>{t("Lädt …")}</p> : <>
                {!leases.length && <p className="text-muted">{t("Noch kein Mietvertrag zugeordnet.")}</p>}
                {leases.map(lease => <article className="lease-card" key={lease.id}>
                    <h3>{lease.tenantIds.map(id => tenants.find(tenant => tenant.id === id)?.name || t('Vertragspartei')).join(' & ')} · {t(LEASE_STATUSES[lease.status])}</h3>
                    <p>{lease.start}{" "}{t("bis")}{" "}{lease.end || t("unbefristet")}{" "}{t("· Kaltmiete")}{" "}{amountLabel(lease.coldRentCents)}{" "}{t("· Nebenkosten")}{" "}{amountLabel(lease.utilitiesCents)}</p>
                </article>)}
                {running.map(r => <article className="rental-summary" key={r.id}>
                    <div><h3><Link to={`/rentals/${r.id}`}>{r.title}</Link></h3><p>{t(RENTAL_PHASES[r.phase] || r.phase)}</p></div>
                    <Link className="btn-outline" to={`/rentals/${r.id}`}>{t("Öffnen")}</Link>
                </article>)}
                <div className="rental-actions">
                    {!running.some(r => !['Completed', 'Archived'].includes(r.phase)) && <Link className="btn-outline" to={`${overview}&new=1`}>{t("Neu vermieten")}</Link>}
                    <Link className="btn-outline" to={overview}>{t("Mietverhältnisse und Historie")}</Link>
                </div>
            </>}
        </section>
    );
}
