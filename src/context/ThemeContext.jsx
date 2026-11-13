import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
    return useContext(ThemeContext);
};

export const ThemeProvider = ({ children }) => {
    const getInitialAppearance = () => {
        const storedTheme = localStorage.getItem('domus-theme');
        return ['light', 'dark', 'system'].includes(storedTheme) ? storedTheme : 'system';
    };

    const [appearance, setAppearance] = useState(getInitialAppearance);
    const [systemTheme, setSystemTheme] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const theme = appearance === 'system' ? systemTheme : appearance;

    useEffect(() => {
        const preference = window.matchMedia('(prefers-color-scheme: dark)');
        const updateSystemTheme = event => setSystemTheme(event.matches ? 'dark' : 'light');
        preference.addEventListener('change', updateSystemTheme);
        return () => preference.removeEventListener('change', updateSystemTheme);
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        root.setAttribute('data-theme', theme);
        localStorage.setItem('domus-theme', appearance);
    }, [theme, appearance]);

    const toggleTheme = () => {
        setAppearance(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, appearance, setAppearance }}>
            {children}
        </ThemeContext.Provider>
    );
};
