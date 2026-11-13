import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useData } from '../context/DataContext';
import { useRentals } from '../hooks/domain/useRentals';
import { RENTAL_PHASES, LEASE_STATUSES } from '../domain/rentals';
import { amountLabel } from '../utils/rentalForms';
import '../pages/Rentals.css';

// Vermietung lives inside the property: current lease, running re-letting, and the entry points.
export default function PropertyRentalSummary({ property }) {
    const { t } = useTranslation();
    const { tenants, refreshAll } = useData();
    const workflow = useRentals(refreshAll);
    const leases = workflow.leases.filter(l => l.propertyId === property.id && l.status !== 'Ended');
    const running = workflow.rentals.filter(r => r.propertyId === property.id && !['Completed', 'Archived'].includes(r.phase));
    const overview = `/rentals?propertyId=${property.id}`;
    return (
        <section className="details-card">
            <h2>{t("Vermietung und Mietverhältnisse")}</h2>
            {workflow.error && <p role="alert" className="rental-error">{t(workflow.error)}</p>}
            {workflow.loading ? <p>{t("Lädt …")}</p> : <>
                {!leases.length && <p>{t("Kein laufendes Mietverhältnis.")}</p>}
                {leases.map(lease => <article className="lease-card" key={lease.id}>
                    <h3>{lease.tenantIds.map(id => tenants.find(tenant => tenant.id === id)?.name || t('Vertragspartei')).join(' & ')} · {t(LEASE_STATUSES[lease.status])}</h3>
                    <p>{lease.start}{" "}{t("bis")}{" "}{lease.end || t("unbefristet")}{" "}{t("· Kaltmiete")}{" "}{amountLabel(lease.coldRentCents)}{" "}{t("· Nebenkosten")}{" "}{amountLabel(lease.utilitiesCents)}</p>
                </article>)}
                {running.map(r => <article className="rental-summary" key={r.id}>
                    <div><h3><Link to={`/rentals/${r.id}`}>{r.title}</Link></h3><p>{t(RENTAL_PHASES[r.phase])}</p></div>
                    <Link className="btn-outline" to={`/rentals/${r.id}`}>{t("Öffnen")}</Link>
                </article>)}
                <div className="rental-actions">
                    {!running.length && <Link className="btn-outline" to={`${overview}&new=1`}>{t("Neu vermieten")}</Link>}
                    <Link className="btn-outline" to={overview}>{t("Mietverhältnisse und Historie")}</Link>
                </div>
            </>}
        </section>
    );
}
