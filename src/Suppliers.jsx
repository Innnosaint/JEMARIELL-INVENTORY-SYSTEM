import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { useTheme } from './ThemeContext';
import API_BASE from './Baseuri';

const CHAR_LIMITS = {
  company_name: 80,
  contact_person: 50,
  contact_number: 11,   // max 11 digits for PH phone numbers
  email_address: 100,
  brand: 50,
  address: 150,
};

const CharCount = ({ value = '', limit }) => {
  const len = (value || '').length;
  const near = len >= limit * 0.85;
  const over = len > limit;
  return (
    <span style={{ fontSize: '0.72rem', color: over ? '#ef4444' : near ? '#f59e0b' : '#94a3b8', float: 'right', fontWeight: over ? 700 : 400 }}>
      {len}/{limit}
    </span>
  );
};

const Suppliers = ({ suppliers, setSuppliers, products, setProducts, categories }) => {
  const { isDark } = useTheme();
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0f172a' : '#ffffff';
  const inputBorder = isDark ? '#334155' : '#cbd5e1';

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Sortation state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
  const [paymentsTab, setPaymentsTab] = useState('current'); // 'current' | 'history'
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Current input state: { [product_id]: { days_remaining, total_amount } }
  const [paymentData, setPaymentData] = useState({});

  // Persistent history: { [supplier_id]: [ { product_id, product_name, days_remaining, total_amount, saved_at } ] }
  const STORAGE_KEY = 'jemariell_payment_history';
  const loadHistory = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  };
  const [paymentHistory, setPaymentHistory] = useState(loadHistory);

  const savePaymentHistory = (supplierId, supplierProds) => {
    const now = new Date().toLocaleString();
    const newEntries = supplierProds
      .filter(p => {
        const pd = paymentData[p.product_id];
        return pd && (pd.days_remaining || pd.total_amount);
      })
      .map(p => ({
        product_id: p.product_id,
        product_name: p.name,
        days_remaining: parseInt(paymentData[p.product_id]?.days_remaining) || 0,
        total_amount: parseFloat(paymentData[p.product_id]?.total_amount) || 0,
        saved_at: now,
      }));
    if (newEntries.length === 0) return alert('No payment data entered yet.');
    const updated = { ...loadHistory(), [supplierId]: [
      ...newEntries,
      ...((loadHistory()[supplierId]) || []),
    ].slice(0, 50) }; // keep last 50 entries per supplier
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPaymentHistory(updated);
    alert('Payment records saved to history!');
  };

  const initialSupplierForm = {
    company_name: '', contact_person: '', contact_number: '',
    email_address: '', brand: '', address: '', is_active: true
  };
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [formErrors, setFormErrors] = useState({});

  const getProductCount = (supplierId) => {
    try { return (products || []).filter(p => p.supplier_id === supplierId).length; } catch { return 0; }
  };
  const getCategoryName = (id) => {
    try { return (categories || []).find(c => c.category_id === parseInt(id))?.category_name || 'Unknown'; } catch { return 'Unknown'; }
  };

  const handleSupplierFieldChange = (field, value) => {
    try {
      const limit = CHAR_LIMITS[field];
      const errors = { ...formErrors };
      if (limit && (value || '').length > limit) {
        errors[field] = `Max ${limit} characters`;
      } else {
        delete errors[field];
      }
      setFormErrors(errors);
      setSupplierForm({ ...supplierForm, [field]: (value || '').slice(0, limit) });
    } catch (err) {
      console.error("Field change error:", err);
    }
  };

  const handleOpenAddSupplier = () => {
    setSupplierForm(initialSupplierForm);
    setFormErrors({});
    setIsEditing(false);
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier) => {
    if (!supplier) return;
    setSupplierForm({ ...supplier });
    setFormErrors({});
    setIsEditing(true);
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    const name = (supplierForm.company_name || '').trim();
    if (!name) return alert("Company Name is required");
    if (Object.keys(formErrors).length > 0) return alert("Please fix the highlighted errors before saving.");

    try {
      if (isEditing) {
        if (!supplierForm.supplier_id) return alert("Invalid supplier ID.");
        const res = await axios.put(`${API_BASE}/api/suppliers/${supplierForm.supplier_id}`, { ...supplierForm, company_name: name });
        if (res.data?.success) {
          setSuppliers(prev => (prev || []).map(s => s.supplier_id === supplierForm.supplier_id ? res.data.data : s));
          setIsSupplierModalOpen(false);
          alert("Supplier successfully updated!");
        } else {
          alert("Error: " + (res.data?.message || 'Unknown error'));
        }
      } else {
        const res = await axios.post(API_BASE + '/api/suppliers', { ...supplierForm, company_name: name });
        if (res.data?.success) {
          setSuppliers(prev => [...(prev || []), res.data.data]);
          setIsSupplierModalOpen(false);
          alert("Supplier successfully added!");
        } else {
          alert("Error: " + (res.data?.message || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error(error);
      if (error.response?.status === 409) {
        alert("A supplier with this name already exists.");
      } else if (error.response) {
        alert("Server error: " + (error.response.data?.message || error.response.statusText));
      } else {
        alert("Connection failed. Check server.");
      }
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!id) return alert("Invalid supplier.");
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      alert("Supplier deletion will be added soon!");
    }
  };

  const handleOpenPayments = (supplier) => {
    if (!supplier) return;
    setSelectedSupplier(supplier);
    setPaymentsTab('current');
    const supplierProds = (products || []).filter(p => p.supplier_id === supplier.supplier_id);
    // Load last saved values from history as defaults
    const history = loadHistory();
    const lastEntries = (history[supplier.supplier_id] || []);
    const init = {};
    supplierProds.forEach(p => {
      const last = lastEntries.find(e => e.product_id === p.product_id);
      init[p.product_id] = paymentData[p.product_id] || (last
        ? { days_remaining: last.days_remaining, total_amount: last.total_amount }
        : { days_remaining: '', total_amount: '' });
    });
    setPaymentData(init);
    setIsPaymentsModalOpen(true);
  };

  const handlePaymentChange = (productId, field, value) => {
    setPaymentData(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value }
    }));
  };

  // SORT HANDLER
  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
    setCurrentPage(1);
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <ChevronsUpDown size={12} style={{ opacity: 0.35, marginLeft: 3, flexShrink: 0 }} />;
    if (sortConfig.direction === 'asc') return <ChevronUp size={12} style={{ color: '#2563eb', marginLeft: 3, flexShrink: 0 }} />;
    return <ChevronDown size={12} style={{ color: '#2563eb', marginLeft: 3, flexShrink: 0 }} />;
  };

  const thInner = (label, colKey) => (
    <div onClick={() => handleSort(colKey)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label}<SortIcon colKey={colKey} />
    </div>
  );

  const filteredSuppliers = (suppliers || []).filter(s => {
    try {
      return (s.company_name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    } catch { return false; }
  });

  const sortedSuppliers = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredSuppliers;
    return [...filteredSuppliers].sort((a, b) => {
      let aVal, bVal;
      try {
        switch (sortConfig.key) {
          case 'supplier_id': aVal = a.supplier_id || 0; bVal = b.supplier_id || 0; break;
          case 'company_name': aVal = (a.company_name || '').toLowerCase(); bVal = (b.company_name || '').toLowerCase(); break;
          case 'contact_person': aVal = (a.contact_person || '').toLowerCase(); bVal = (b.contact_person || '').toLowerCase(); break;
          case 'contact_number': aVal = (a.contact_number || '').toLowerCase(); bVal = (b.contact_number || '').toLowerCase(); break;
          case 'brand': aVal = (a.brand || '').toLowerCase(); bVal = (b.brand || '').toLowerCase(); break;
          case 'email_address': aVal = (a.email_address || '').toLowerCase(); bVal = (b.email_address || '').toLowerCase(); break;
          case 'updated_at': aVal = new Date(a.updated_at || 0).getTime(); bVal = new Date(b.updated_at || 0).getTime(); break;
          case 'products': aVal = getProductCount(a.supplier_id); bVal = getProductCount(b.supplier_id); break;
          default: return 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      } catch { return 0; }
    });
  }, [filteredSuppliers, sortConfig]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const totalPages = Math.ceil(sortedSuppliers.length / ITEMS_PER_PAGE);
  const paginatedSuppliers = sortedSuppliers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, boxSizing: 'border-box' };

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h2 style={{ color: textPrimary }}>Suppliers</h2>
          <p style={{ color: textSecondary }}>Manage your supplier network</p>
        </div>
        <button className="primary-btn" style={{ background: '#2563eb', color: 'white' }} onClick={handleOpenAddSupplier}>
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      {/* SEARCH */}
      <div className="search-input-wrapper" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
        <Search size={18} color="#64748b" />
        <input type="text" placeholder="Search suppliers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: 'transparent', color: textPrimary, border: 'none', outline: 'none' }} />
      </div>

      {/* TABLE */}
      <div className="table-card" style={{ width: '100%', background: cardBg, border: `1px solid ${cardBorder}` }}>
        <table style={{ width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '7%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('ID', 'supplier_id')}</th>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('Company Name', 'company_name')}</th>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('Contact Person', 'contact_person')}</th>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('Phone', 'contact_number')}</th>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('Brand', 'brand')}</th>
              <th style={{ textAlign: "center" }}>Status</th>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('Updated', 'updated_at')}</th>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('Email', 'email_address')}</th>
              <th style={{  cursor: 'pointer', textAlign: "center" }}>{thInner('Sum of Payments', 'products')}</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSuppliers.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '30px', color: textSecondary }}>
                  No suppliers found.
                </td>
              </tr>
            ) : (
              paginatedSuppliers.map(s => (
                <tr key={s.supplier_id}>
                  <td style={{  color: textSecondary, fontSize: '0.8rem', textAlign: "center" }}>{`SUP00${s.supplier_id}`.slice(0, 7)}</td>
                  <td style={{ textAlign: "center" }}><strong style={{ fontSize: '0.9rem', color: textPrimary }}>{s.company_name}</strong></td>
                  <td style={{  fontSize: '0.875rem', color: textPrimary, textAlign: "center" }}>{s.contact_person}</td>
                  <td style={{  fontSize: '0.875rem', color: textPrimary, textAlign: "center" }}>{s.contact_number}</td>
                  <td style={{  fontSize: '0.875rem', color: textPrimary, textAlign: "center" }}>{s.brand}</td>
                  <td style={{ textAlign: "center" }}><span className="status-pill active">Active</span></td>
                  <td style={{  color: textSecondary, fontSize: '0.8rem', textAlign: "center" }}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : 'N/A'}</td>
                  <td style={{  fontSize: '0.8rem', textAlign: "center" }}>
                    <a href={`mailto:${s.email_address}`} style={{ color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' }}>{s.email_address}</a>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button className="catalog-badge-btn" onClick={() => handleOpenPayments(s)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                      💳 {getProductCount(s.supplier_id)} items
                    </button>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div className="action-icons">
                      <button className="icon-btn edit" onClick={() => handleOpenEditSupplier(s)}><Edit2 size={15} /></button>
                      <button className="icon-btn delete" onClick={() => handleDeleteSupplier(s.supplier_id)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination-container" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <span className="page-info" style={{ color: textSecondary }}>
              Page {currentPage} of {totalPages} ({sortedSuppliers.length} suppliers)
            </span>
            <div className="pagination-controls">
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16} /></button>
              <button className="page-btn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ADD/EDIT SUPPLIER */}
      {isSupplierModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', background: cardBg }}>
            <div className="modal-header">
              <h3 style={{ color: textPrimary }}>{isEditing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} style={{ background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#475569" />
              </button>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ color: textSecondary }}>Company Name *</label>
                <CharCount value={supplierForm.company_name} limit={CHAR_LIMITS.company_name} />
              </div>
              <input
                style={{ ...inputStyle, borderColor: formErrors.company_name ? '#ef4444' : inputBorder }}
                value={supplierForm.company_name}
                onChange={e => handleSupplierFieldChange('company_name', e.target.value)}
                placeholder="e.g. Micsoft Industries"
                maxLength={CHAR_LIMITS.company_name}
              />
              {formErrors.company_name && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{formErrors.company_name}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{ color: textSecondary }}>Contact Person</label>
                  <CharCount value={supplierForm.contact_person} limit={CHAR_LIMITS.contact_person} />
                </div>
                <input style={inputStyle} value={supplierForm.contact_person} onChange={e => handleSupplierFieldChange('contact_person', e.target.value)} maxLength={CHAR_LIMITS.contact_person} />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{ color: textSecondary }}>Phone Number</label>
                  <CharCount value={supplierForm.contact_number} limit={CHAR_LIMITS.contact_number} />
                </div>
                <input style={inputStyle} value={supplierForm.contact_number} onChange={e => handleSupplierFieldChange('contact_number', e.target.value)} maxLength={CHAR_LIMITS.contact_number} />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ color: textSecondary }}>Email Address</label>
                <CharCount value={supplierForm.email_address} limit={CHAR_LIMITS.email_address} />
              </div>
              <input type="email" style={inputStyle} value={supplierForm.email_address} onChange={e => handleSupplierFieldChange('email_address', e.target.value)} maxLength={CHAR_LIMITS.email_address} />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ color: textSecondary }}>Brand</label>
                <CharCount value={supplierForm.brand} limit={CHAR_LIMITS.brand} />
              </div>
              <input style={inputStyle} value={supplierForm.brand} onChange={e => handleSupplierFieldChange('brand', e.target.value)} maxLength={CHAR_LIMITS.brand} />
            </div>

            <div className="modal-footer">
              <button className="confirm-btn" style={{ background: '#2563eb' }} onClick={handleSaveSupplier}>
                {isEditing ? 'Update Supplier' : 'Save Supplier'}
              </button>
              <button className="cancel-btn" onClick={() => setIsSupplierModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUM OF PAYMENTS */}
      {isPaymentsModalOpen && selectedSupplier && (() => {
        const supplierProds = (products || []).filter(p => p.supplier_id === selectedSupplier.supplier_id);
        const historyEntries = (paymentHistory[selectedSupplier.supplier_id] || []);

        return (
          <div className="modal-overlay">
            <div className="modal-content large" style={{ minHeight: '460px', background: cardBg, maxWidth: '700px', width: '95vw' }}>

              {/* Modal Header */}
              <div className="modal-header" style={{ textAlign: 'center', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingBottom: '12px', borderBottom: `1px solid ${cardBorder}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.2rem', color: textPrimary, margin: 0 }}>💳 Sum of Payments</h3>
                    <p style={{ color: textSecondary, fontSize: '0.85rem', marginTop: 4 }}>{selectedSupplier.company_name}</p>
                  </div>
                  <button onClick={() => setIsPaymentsModalOpen(false)} style={{ background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <X size={18} color="#475569" />
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
                  {['current', 'history'].map(tab => (
                    <button key={tab} onClick={() => setPaymentsTab(tab)} style={{
                      padding: '7px 22px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                      background: paymentsTab === tab ? '#2563eb' : (isDark ? '#0f172a' : '#f1f5f9'),
                      color: paymentsTab === tab ? 'white' : textSecondary,
                      transition: 'all 0.15s'
                    }}>
                      {tab === 'current' ? '📋 Current Entry' : `🕘 History (${historyEntries.length})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── TAB: CURRENT ENTRY ── */}
              {paymentsTab === 'current' && (
                <>
                  {supplierProds.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: textSecondary }}>No products linked to this supplier yet.</div>
                  ) : (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
                      {/* Column headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: '10px', padding: '8px 14px', background: isDark ? '#0f172a' : '#f8fafc', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                        <span style={{ textAlign: 'center' }}>Product</span>
                        <span style={{ textAlign: 'center' }}>Days Remaining</span>
                        <span style={{ textAlign: 'center' }}>Amount (₱)</span>
                      </div>

                      {supplierProds.map(p => {
                        const pd = paymentData[p.product_id] || { days_remaining: '', total_amount: '' };
                        const days = parseInt(pd.days_remaining) || 0;
                        const amount = parseFloat(pd.total_amount) || 0;
                        const isUrgent = days > 0 && days <= 30;
                        return (
                          <div key={p.product_id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px', gap: '10px', alignItems: 'center', padding: '12px 14px', background: cardBg, border: `1px solid ${isUrgent ? '#fecaca' : cardBorder}`, borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 600, color: textPrimary, fontSize: '0.9rem' }}>{p.name}</div>
                              <div style={{ fontSize: '0.75rem', color: textSecondary }}>{getCategoryName(p.category_id)}</div>
                              {days > 0 && amount > 0 && (
                                <div style={{ fontSize: '0.72rem', marginTop: '4px', color: isUrgent ? '#ef4444' : '#10b981', fontWeight: 600, lineHeight: 1.4 }}>
                                  {selectedSupplier.company_name} — {p.name}<br />
                                  = {days} DAYS REMAINING = ₱{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                              )}
                            </div>
                            <input
                              type="number" min="0" placeholder="e.g. 240"
                              value={pd.days_remaining}
                              onChange={e => handlePaymentChange(p.product_id, 'days_remaining', e.target.value)}
                              style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${isUrgent ? '#fca5a5' : inputBorder}`, background: inputBg, color: textPrimary, width: '100%', boxSizing: 'border-box', fontSize: '0.875rem', textAlign: 'center' }}
                            />
                            <input
                              type="number" min="0" step="0.01" placeholder="e.g. 250000"
                              value={pd.total_amount}
                              onChange={e => handlePaymentChange(p.product_id, 'total_amount', e.target.value)}
                              style={{ padding: '8px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, width: '100%', boxSizing: 'border-box', fontSize: '0.875rem', textAlign: 'center' }}
                            />
                          </div>
                        );
                      })}

                      {/* Summary total */}
                      {supplierProds.some(p => parseFloat((paymentData[p.product_id] || {}).total_amount) > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 14px', background: isDark ? '#0f172a' : '#f0fdf4', border: `1px solid #bbf7d0`, borderRadius: '8px', gap: '12px' }}>
                          <span style={{ fontWeight: 600, color: textSecondary, fontSize: '0.85rem' }}>TOTAL PAYABLE:</span>
                          <span style={{ fontWeight: 800, color: '#059669', fontSize: '1.1rem' }}>
                            ₱{supplierProds.reduce((sum, p) => sum + (parseFloat((paymentData[p.product_id] || {}).total_amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${cardBorder}` }}>
                    <button
                      onClick={() => savePaymentHistory(selectedSupplier.supplier_id, supplierProds)}
                      style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      💾 Save to History
                    </button>
                    <button onClick={() => setIsPaymentsModalOpen(false)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Done</button>
                  </div>
                </>
              )}

              {/* ── TAB: HISTORY ── */}
              {paymentsTab === 'history' && (
                <>
                  {historyEntries.length === 0 ? (
                    <div style={{ padding: '50px 20px', textAlign: 'center', color: textSecondary }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🕘</div>
                      <div style={{ fontWeight: 600 }}>No history yet</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Enter payment data and click "Save to History" to record entries.</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                      {/* History column headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 140px', gap: '8px', padding: '8px 14px', background: isDark ? '#0f172a' : '#f8fafc', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                        <span>Product</span>
                        <span>Days</span>
                        <span>Amount (₱)</span>
                        <span>Saved At</span>
                      </div>
                      {historyEntries.map((entry, i) => {
                        const isUrgent = entry.days_remaining > 0 && entry.days_remaining <= 30;
                        return (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 130px 140px', gap: '8px', alignItems: 'center', padding: '10px 14px', background: cardBg, border: `1px solid ${isUrgent ? '#fecaca' : cardBorder}`, borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 600, color: textPrimary, fontSize: '0.875rem' }}>{entry.product_name}</div>
                              <div style={{ fontSize: '0.7rem', color: textSecondary }}>{selectedSupplier.company_name}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: isUrgent ? '#ef4444' : textPrimary, fontSize: '0.9rem' }}>
                              {entry.days_remaining}
                              <div style={{ fontSize: '0.68rem', color: isUrgent ? '#ef4444' : textSecondary, fontWeight: 400 }}>days</div>
                            </div>
                            <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.9rem' }}>
                              ₱{(entry.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: textSecondary }}>{entry.saved_at}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {historyEntries.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${cardBorder}` }}>
                      <button
                        onClick={() => {
                          if (!window.confirm('Clear all history for this supplier?')) return;
                          const updated = { ...loadHistory() };
                          delete updated[selectedSupplier.supplier_id];
                          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                          setPaymentHistory(updated);
                        }}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
                      >
                        🗑 Clear History
                      </button>
                      <button onClick={() => setIsPaymentsModalOpen(false)} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>Done</button>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Suppliers;