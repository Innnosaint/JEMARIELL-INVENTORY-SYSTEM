import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';

import Login from './Login';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import Products from './Products';
import Suppliers from './Suppliers';
import Users from './Users';
import Settings from './Settings';
import { ThemeProvider, useTheme } from './ThemeContext';

// ─────────────────────────────────────────────────────────────
// AXIOS GLOBAL CONFIG — attach JWT token to every request
// ─────────────────────────────────────────────────────────────
axios.defaults.timeout = 10000;

const setupAxiosAuth = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Response interceptor — handle 401 Unauthorized globally
  axios.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) {
        console.warn('Unauthorized. Clearing session.');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        sessionStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/login';
      }
      return Promise.reject(err);
    }
  );
};

setupAxiosAuth();

// ─────────────────────────────────────────────────────────────
// AUTH HELPERS
// ─────────────────────────────────────────────────────────────
const loadStoredUser = () => {
  const sources = [
    () => sessionStorage.getItem('user'),
    () => localStorage.getItem('currentUser'),
  ];

  for (const getItem of sources) {
    try {
      const raw = getItem();
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed?.admin_user || !parsed?.email) continue;
      return parsed;
    } catch {
      continue;
    }
  }
  return null;
};

// Token-based route guard
const ProtectedRoute = ({ user }) => {
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

// Retry helper for network flakiness
const axiosWithRetry = async (fn, retries = 2, delay = 1500) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isNetwork = !err.response;
      if ((isTimeout || isNetwork) && i < retries) {
        console.warn(`Retrying... attempt ${i + 1}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
};

// ─────────────────────────────────────────────────────────────
// APP SHELL — sidebar + header, rendered for all protected pages
// ─────────────────────────────────────────────────────────────
function AppShell({ user, connectionStatus, fetchData, handleLogout }) {
  const { isDark } = useTheme();

  const bg           = isDark ? '#0f172a' : '#f8fafc';
  const headerBg     = isDark ? '#1e293b' : '#ffffff';
  const headerBorder = isDark ? '#334155' : '#e2e8f0';
  const textColor    = isDark ? '#f1f5f9' : '#334155';
  const subText      = isDark ? '#94a3b8' : '#64748b';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: bg, transition: 'background-color 0.2s' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '14px 28px', backgroundColor: headerBg,
          borderBottom: `1px solid ${headerBorder}`, gap: '12px',
          transition: 'background-color 0.2s'
        }}>
          {connectionStatus === 'loading' && (
            <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 500, background: '#fffbeb', padding: '4px 10px', borderRadius: 20, border: '1px solid #fde68a' }}>
              ⏳ Connecting...
            </span>
          )}
          {connectionStatus === 'error' && (
            <span onClick={fetchData} style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 500, background: '#fef2f2', padding: '4px 10px', borderRadius: 20, border: '1px solid #fecaca', cursor: 'pointer' }}>
              ⚠️ Connection failed — Click to retry
            </span>
          )}
          {connectionStatus === 'ok' && (
            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 500, background: isDark ? '#022c22' : '#f0fdf4', padding: '4px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>
              ● Connected
            </span>
          )}

          <span style={{ fontWeight: 600, color: textColor }}>
            Hi, {user.admin_user || user.name}
          </span>

          <button onClick={handleLogout} style={{
            padding: '8px 16px', cursor: 'pointer', backgroundColor: '#ef4444',
            color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.875rem'
          }}>
            Logout
          </button>
        </header>

        {/* Page content — child routes render here */}
        <main style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP INNER
// ─────────────────────────────────────────────────────────────
function AppInner() {
  const [user, setUser]                         = useState(null);
  const [authChecked, setAuthChecked]           = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle');

  const [products, setProducts]               = useState([]);
  const [stockMovements, setStockMovements]   = useState([]);
  const [categories, setCategories]           = useState([]);
  const [suppliers, setSuppliers]             = useState([]);

  // ── Load user session ──
  useEffect(() => {
    const storedUser = loadStoredUser();
    if (storedUser) {
      setUser(storedUser);
      if (storedUser.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedUser.token}`;
      }
      sessionStorage.setItem('user', JSON.stringify(storedUser));
    }
    setAuthChecked(true);
  }, []);

  const fetchData = useCallback(async () => {
    setConnectionStatus('loading');
    try {
      const res = await axiosWithRetry(() => axios.get('http://127.0.0.1:5000/api/data'));
      setProducts(res.data.products || []);
      setStockMovements(res.data.stock_movements || []);
      setSuppliers(res.data.suppliers || []);
      setCategories(res.data.categories || []);
      setConnectionStatus('ok');
    } catch (err) {
      setConnectionStatus('error');
      const isTimeout = err.code === 'ECONNABORTED';
      console.error(isTimeout
        ? 'Database connection slow. Retried 2 times.'
        : 'Cannot reach server. Make sure Flask is running on port 5000.',
        err);
    }
  }, []);

  const fetchMovements = useCallback(async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/movements');
      if (res.data.success) setStockMovements(res.data.data || []);
    } catch (err) {
      console.error('Failed to refresh movements:', err);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const handleLogout = () => {
    sessionStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    window.location.href = '/login';
  };

  // Don't render until auth check is complete (prevents flash)
  if (!authChecked) return null;

  return (
    // ── Single Router wrapping the entire app ──
    <Router>
      <Routes>

        {/* Public route — redirect to home if already logged in */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login setUser={setUser} />}
        />

        {/* Protected layout — all children share the shell */}
        <Route element={<ProtectedRoute user={user} />}>
          <Route element={
            <AppShell
              user={user}
              connectionStatus={connectionStatus}
              fetchData={fetchData}
              handleLogout={handleLogout}
            />
          }>
            <Route path="/" element={
              <Dashboard
                products={products} setProducts={setProducts}
                stockMovements={stockMovements} setStockMovements={setStockMovements}
                categories={categories} fetchMovements={fetchMovements}
              />
            } />
            <Route path="/products"   element={<Products   products={products}   setProducts={setProducts}   categories={categories} suppliers={suppliers} />} />
            <Route path="/suppliers"  element={<Suppliers  suppliers={suppliers} setSuppliers={setSuppliers} products={products}     setProducts={setProducts} categories={categories} />} />
            <Route path="/users"      element={<Users />} />
            <Route path="/settings"   element={<Settings   categories={categories} setCategories={setCategories} />} />

            {/* Catch-all inside protected area — redirect home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>

      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

export default App;