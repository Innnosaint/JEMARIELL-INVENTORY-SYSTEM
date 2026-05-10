import React from 'react';
import { LayoutDashboard, Package, Truck, Users, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';

const Sidebar = () => {
  const location = useLocation();
  const { isDark } = useTheme();

  const menuItems = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/products', name: 'Products', icon: Package },
    { path: '/suppliers', name: 'Suppliers', icon: Truck },
    { path: '/settings', name: 'Settings', icon: Settings }
  ];

  return (
    <div style={{
      width: '260px',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderRight: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      transition: 'background-color 0.2s, border-color 0.2s'
    }}>

      {/* Brand Section */}
      <div style={{ padding: '24px' }}>
        <h2 style={{ margin: 0, color: isDark ? '#f1f5f9' : '#0f172a', fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '1px' }}>JEMARIELL</h2>
        <span style={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>General Merchandising</span>
      </div>

      {/* Navigation Links */}
      <nav style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                textDecoration: 'none',
                borderRadius: '8px',
                backgroundColor: isActive ? '#2563eb' : 'transparent',
                color: isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#475569'),
                fontWeight: isActive ? '600' : '500',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <Icon size={20} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;