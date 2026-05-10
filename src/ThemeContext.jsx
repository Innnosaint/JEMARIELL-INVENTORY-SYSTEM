import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('theme') === 'dark';
    } catch { return false; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
    const root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Inject CSS variables so ALL components (incl. CSS classes) react to theme
    if (isDark) {
      root.style.setProperty('--bg-page',       '#0f172a');
      root.style.setProperty('--bg-card',       '#1e293b');
      root.style.setProperty('--bg-input',      '#0f172a');
      root.style.setProperty('--bg-hover',      '#334155');
      root.style.setProperty('--border-color',  '#334155');
      root.style.setProperty('--text-primary',  '#f1f5f9');
      root.style.setProperty('--text-secondary','#94a3b8');
      root.style.setProperty('--text-muted',    '#64748b');
      root.style.setProperty('--shadow-color',  'rgba(0,0,0,0.4)');
      root.style.setProperty('--table-row-alt', '#162032');
      root.style.setProperty('--table-header',  '#0f172a');
      root.style.setProperty('--scrollbar-bg',  '#1e293b');
      root.style.setProperty('--scrollbar-thumb','#475569');
    } else {
      root.style.setProperty('--bg-page',       '#f8fafc');
      root.style.setProperty('--bg-card',       '#ffffff');
      root.style.setProperty('--bg-input',      '#ffffff');
      root.style.setProperty('--bg-hover',      '#f1f5f9');
      root.style.setProperty('--border-color',  '#e2e8f0');
      root.style.setProperty('--text-primary',  '#0f172a');
      root.style.setProperty('--text-secondary','#64748b');
      root.style.setProperty('--text-muted',    '#94a3b8');
      root.style.setProperty('--shadow-color',  'rgba(0,0,0,0.07)');
      root.style.setProperty('--table-row-alt', '#f8fafc');
      root.style.setProperty('--table-header',  '#f1f5f9');
      root.style.setProperty('--scrollbar-bg',  '#f1f5f9');
      root.style.setProperty('--scrollbar-thumb','#cbd5e1');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeContext;