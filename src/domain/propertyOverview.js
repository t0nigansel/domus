import { dossierValues } from './propertyDossier';

export function propertyOverview(property, tenants, leases) {
    const parties = tenants.filter(tenant => tenant.propertyId === property.id && tenant.status === 'Active');
    const activeLease = leases.find(lease => lease.propertyId === property.id && lease.status === 'Active');
    const residents = property.residents || [];
    const nonRental = ['NonRental', 'Usufruct'].includes(property.occupancyKind);
    const leaseNames = activeLease?.tenantIds.map(id => tenants.find(tenant => tenant.id === id)?.name).filter(Boolean).join(' & ');
    const tenantName = activeLease ? leaseNames : property.tenantName ?? (parties.length ? parties.map(party => party.name).join(' & ') : dossierValues(property).tenantName);
    const dates = [...new Set(parties.map(party => party.leaseStart).filter(Boolean))];
    const facts = { ...property, tenantName, moveInDate: activeLease?.start || (property.moveInDate !== undefined ? property.moveInDate : dates.length === 1 ? dates[0] : '') };
    if (activeLease) Object.assign(facts, { coldRent: activeLease.coldRentCents == null ? null : activeLease.coldRentCents / 100, nebenkosten: activeLease.utilitiesCents == null ? null : activeLease.utilitiesCents / 100 });
    const missing = ['size', ...(!nonRental && property.status === 'Occupied' ? ['tenantName', 'moveInDate', 'coldRent', 'nebenkosten'] : [])]
        .filter(key => facts[key] == null || facts[key] === '');
    const areaReview = (property.importReview || []).find(item => item.unit === 'm²');
    return { facts, parties, activeLease, residents, nonRental, missing, areaReview };
}
