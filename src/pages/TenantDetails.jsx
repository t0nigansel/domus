import { useTranslation } from '../i18n';
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, Home, Calendar, Clock } from 'lucide-react';
import { useData } from '../context/DataContext';
import './TenantDetails.css';

const TenantDetails = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const { tenants } = useData();
    const tenant = tenants.find(tenant => tenant.id === id);

    if (!tenant) {
        return (
            <div className="tenant-not-found">
                <h2>{t("Tenant Not Found")}</h2>
                <Link to="/contacts?filter=tenants" className="btn-primary">{t("Back to Tenants")}</Link>
            </div>
        );
    }

    return (
        <div className="tenant-details-container">
            <Link to="/contacts?filter=tenants" className="back-link">
                <ArrowLeft size={20} />
                <span>{t("Back to Tenants")}</span>
            </Link>

            <header className="tenant-header-main">
                <div className="profile-section">
                    <div className="profile-avatar-large">
                        <User size={40} />
                    </div>
                    <div>
                        <h1 className="tenant-name-large">{tenant.name}</h1>
                        <span className={`status-badge-small ${tenant.status.toLowerCase()}`}>
                            {t(tenant.status)}
                        </span>
                    </div>
                </div>
                <button className="btn-outline">{t("Edit Profile")}</button>
            </header>

            <div className="tenant-grid">
                {/* Contact & Lease Info */}
                <div className="left-col">
                    <section className="info-card">
                        <h3>{t("Contact Information")}</h3>
                        <div className="info-list">
                            <div className="info-row-detail">
                                <Mail size={18} className="text-muted" />
                                <span>{tenant.email}</span>
                            </div>
                            <div className="info-row-detail">
                                <Phone size={18} className="text-muted" />
                                <span>{tenant.phone}</span>
                            </div>
                        </div>
                    </section>

                    <section className="info-card">
                        <h3>{t("Lease Details")}</h3>
                        {tenant.leaseManaged && <Link className="btn-outline" to={`/rentals?propertyId=${tenant.propertyId}`}>{t("Mietverhältnisse und Historie")}</Link>}
                        <div className="info-list">
                            <div className="info-row-detail">
                                <Home size={18} className="text-muted" />
                                <Link to={`/properties/${tenant.propertyId}`} className="link-text">
                                    {tenant.propertyName}
                                </Link>
                            </div>
                            <div className="info-row-detail">
                                <Calendar size={18} className="text-muted" />
                                <span>{tenant.leaseStart} — {tenant.leaseEnd}</span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Payment History */}
                <div className="right-col">
                    <section className="info-card">
                        <div className="card-header-row">
                            <h3>{t("Payment History")}</h3>
                            <button className="btn-text">{t("Log Payment")}</button>
                        </div>
                        {tenant.paymentHistory.length > 0 ? (
                            <table className="payments-table">
                                <thead>
                                    <tr>
                                        <th>{t("Date")}</th>
                                        <th>{t("Amount")}</th>
                                        <th>{t("Status")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tenant.paymentHistory.map(payment => (
                                        <tr key={payment.id}>
                                            <td>{payment.date}</td>
                                            <td>${payment.amount}</td>
                                            <td>
                                                <span className="status-pd paid">{t("Paid")}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="empty-history">
                                <Clock size={24} className="text-muted" />
                                <p>{t("No payment history available.")}</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TenantDetails;
