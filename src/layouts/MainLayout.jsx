import React from 'react';
import { useTranslation } from '../i18n';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building, FileText, Coins, AlertCircle, BookUser } from 'lucide-react';
import AccountMenu from '../components/AccountMenu';
import GlobalSearch from '../components/GlobalSearch';
import DomusLogo from '../components/DomusLogo';
import './MainLayout.css';

const MainLayout = () => {
    const { t } = useTranslation();
    const location = useLocation();

    const navigation = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Properties', path: '/properties', icon: Building },
        { name: 'Issues', path: '/issues', icon: AlertCircle },
        { name: 'Documents', path: '/documents', icon: FileText },
        { name: 'Costs', path: '/costs', icon: Coins },
        { name: 'Contacts', path: '/contacts', icon: BookUser },
    ];

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <DomusLogo size={32} className="sidebar-logo" />
                    <span className="logo-text">Domus</span>
                </div>
                <GlobalSearch />
                <nav className="sidebar-nav">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.path)
                                // Vermietung is part of the property, not its own menu entry.
                                || (item.path === '/properties' && location.pathname.startsWith('/rentals'))
                                || (item.path === '/contacts' && location.pathname.startsWith('/tenants'));
                        return (
                            <Link
                                key={t(item.name)}
                                to={item.path}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                            >
                                <Icon size={20} />
                                <span>{t(item.name)}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="sidebar-footer">
                    <AccountMenu />
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
