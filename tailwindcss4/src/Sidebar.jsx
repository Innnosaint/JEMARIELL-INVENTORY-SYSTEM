import React from 'react';
import { LayoutDashboard, Package, Truck, Users, Settings, Store } from 'lucide-react'; // 👇 Idinagdag ang Store icon
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  // Listahan ng mga pages mo
  const menuItems = [
    { path: '/', name: 'Dashboard', icon: LayoutDashboard },
    { path: '/products', name: 'Products', icon: Package },
    { path: '/suppliers', name: 'Suppliers', icon: Truck },
    { path: '/storefront', name: 'Customer View', icon: Store }, 
    { path: '/settings', name: 'Settings', icon: Settings }
  ];

  return (
    <div style={{ 
      width: '260px', 
      backgroundColor: '#ffffff', // Clean white background
      borderRight: '1px solid #e2e8f0', // Manipis na linya sa gilid
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      position: 'sticky', 
      top: 0 
    }}>
      
      {/* Brand Section */}
      <div style={{ padding: '24px' }}>
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '1px' }}>JEMARIELL</h2>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>General Merchandising</span>
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
                backgroundColor: isActive ? '#ea580c' : 'transparent', // Orange kapag active
                color: isActive ? '#ffffff' : '#475569', // White text kapag active, dark gray kapag hindi
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