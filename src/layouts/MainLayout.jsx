import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building, Users, FileText, Coins, Moon, Sun, AlertCircle, BookUser } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import './MainLayout.css';

const MainLayout = () => {
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();

    const navigation = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Properties', path: '/properties', icon: Building },
        { name: 'Vermietungen', path: '/rentals', icon: FileText },
        { name: 'Issues', path: '/issues', icon: AlertCircle },
        { name: 'Tenants', path: '/tenants', icon: Users },
        { name: 'Documents', path: '/documents', icon: FileText },
        { name: 'Costs', path: '/costs', icon: Coins },
        { name: 'Contacts', path: '/contacts', icon: BookUser },
    ];

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src="/logo.svg" alt="Domus Logo" style={{ width: '32px', height: '32px', marginRight: '12px' }} />
                    <span className="logo-text">Domus</span>
                </div>
                <nav className="sidebar-nav">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`nav-item ${isActive ? 'active' : ''}`}
                            >
                                <Icon size={20} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="sidebar-footer">
                    <button className="nav-item" onClick={toggleTheme} style={{ width: '100%', justifyContent: 'flex-start' }}>
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
