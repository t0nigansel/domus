export const euros = cents => cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
export const amountLabel = cents => cents === null || cents === undefined ? 'Noch offen' : `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`;
export const newParty = () => ({ name: '', email: '', phone: '' });
export function rentalForm(rental, property) {
    return {
        propertyId: rental?.propertyId || property?.id || '', title: rental?.title || `Neuvermietung ${property?.name || ''}`.trim(),
        availableFrom: rental?.availableFrom || '', coldRent: rental ? euros(rental.coldRentCents) : String(property?.coldRent ?? ''),
        utilities: rental ? euros(rental.utilitiesCents) : String(property?.nebenkosten ?? ''), deposit: rental ? euros(rental.depositCents) : '',
        included: rental?.included || '', notes: rental?.notes || '', listing: rental?.listing || '',
    };
}
export function leaseForm(rental, property) {
    return { start: rental?.availableFrom || '', end: '', coldRent: rental ? euros(rental.coldRentCents) : String(property?.coldRent ?? ''),
        utilities: rental ? euros(rental.utilitiesCents) : String(property?.nebenkosten ?? ''), deposit: rental ? euros(rental.depositCents) : '', included: rental?.included || '' };
}
