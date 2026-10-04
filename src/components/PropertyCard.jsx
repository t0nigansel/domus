import React from 'react';
import { Link } from 'react-router-dom';
import { Home, User, Calendar, DollarSign, Search, AlertCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import './PropertyCard.css';

const PropertyCard = ({ property }) => {
    // We ideally should use context here to check active issues
    // Since we are in the card, we need to import useData.
    // However, hooks can't be used conditionally or inside loop if we were iterating differently, but here it's a component.
    const { issues } = useData();
    const hasOpenIssues = issues.some(i => i.propertyId === property.id && i.status === 'Open');

    const nonRental = ['NonRental', 'Usufruct'].includes(property.occupancyKind);
    const totalRent = Number.isFinite(property.coldRent) && Number.isFinite(property.nebenkosten)
        ? `${property.coldRent + property.nebenkosten} €` : 'Noch offen';

    return (
        <div className="property-card">
            <div className="card-header">
                <Link to={`/properties/${property.id}`} className="icon-wrapper clickable">
                    <Search size={24} color="var(--color-primary)" />
                </Link>
                <div className="header-info">
                    <h3>{property.name}</h3>
                </div>
                {hasOpenIssues && (
                    <div className="alert-badge" title="Has Open Issues">
                        <AlertCircle size={18} color="var(--color-warning)" fill="var(--color-warning)" style={{ color: 'white' }} />
                    </div>
                )}
            </div>

            <div className="card-content">
                <div className="property-meta">
                    <div className="meta-item">
                        <span className="label">Rent</span>
                        <span className="value">{nonRental ? 'Kein Mietverhältnis' : totalRent}</span>
                    </div>
                    {property.size && (
                        <div className="meta-item">
                            <span className="label">Size</span>
                            <span className="value">{property.size} m²</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PropertyCard;
