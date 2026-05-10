import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, Box, ChevronLeft, ChevronRight, AlertCircle, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
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

const PRODUCT_NAME_MAX = 80;

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
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogViewMode, setCatalogViewMode] = useState('list');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const initialSupplierForm = {
    company_name: '', contact_person: '', contact_number: '',
    email_address: '', brand: '', address: '', is_active: true
  };
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [formErrors, setFormErrors] = useState({});

  const initialProductForm = {
    name: '', category_id: (categories || [])[0]?.category_id || 1,
    unit_of_measurement: 'pcs', stock_quantity: 0,
    low_stock_threshold: 10, price: 0, description: ''
  };
  const [productForm, setProductForm] = useState(initialProductForm);
  const [productThresholdError, setProductThresholdError] = useState('');

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

  const handleOpenCatalog = (supplier) => {
    if (!supplier) return;
    setSelectedSupplier(supplier);
    setCatalogViewMode('list');
    setProductForm(initialProductForm);
    setProductThresholdError('');
    setIsCatalogModalOpen(true);
  };

  const handleProductThresholdChange = (e) => {
    try {
      const raw = e.target.value;
      const val = parseFloat(raw);
      if (val < 0) {
        setProductThresholdError('Threshold cannot be negative.');
        setProductForm({ ...productForm, low_stock_threshold: raw });
        return;
      }
      if (!Number.isInteger(val) && raw !== '') {
        setProductThresholdError('Threshold must be a whole number (no decimals).');
        setProductForm({ ...productForm, low_stock_threshold: Math.floor(val) });
        return;
      }
      setProductThresholdError('');
      setProductForm({ ...productForm, low_stock_threshold: Math.floor(val) || 0 });
    } catch (err) {
      console.error("Threshold change error:", err);
    }
  };

  const handleAddProductToCatalog = async () => {
    const productName = (productForm.name || '').trim();
    if (!productName) return alert('Product name is required');
    if (!selectedSupplier?.supplier_id) return alert('No supplier selected.');

    const threshold = parseFloat(productForm.low_stock_threshold);
    if (isNaN(threshold) || threshold < 0) return alert('Threshold cannot be negative. Enter 0 or a positive whole number.');
    if (!Number.isInteger(threshold)) return alert('Threshold must be a whole number (no decimals).');

    const price = parseFloat(productForm.price);
    if (isNaN(price) || price < 0) return alert('Price must be a valid non-negative number.');

    const submitData = new FormData();
    submitData.append('name', productName);
    submitData.append('category_id', productForm.category_id);
    submitData.append('supplier_id', selectedSupplier.supplier_id);
    submitData.append('unit_of_measurement', productForm.unit_of_measurement);
    submitData.append('stock_quantity', Math.floor(productForm.stock_quantity || 0));
    submitData.append('low_stock_threshold', Math.floor(threshold));
    submitData.append('price', price);

    try {
      const res = await axios.post(API_BASE + '/api/products', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setProducts(prev => [...(prev || []), res.data.data]);
        setCatalogViewMode('list');
        setProductForm(initialProductForm);
        setProductThresholdError('');
        alert("Product successfully added to catalog!");
      } else {
        alert("Error: " + (res.data?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error(error);
      if (error.response?.status === 409) {
        alert("A product with this name already exists for this supplier.");
      } else if (error.response) {
        alert("Server error: " + (error.response.data?.message || error.response.statusText));
      } else {
        alert(`Connection error: ${error.message}`);
      }
    }
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
  const supplierProducts = selectedSupplier ? (products || []).filter(p => p.supplier_id === selectedSupplier.supplier_id) : [];

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
              <th style={{ cursor: 'pointer' }}>{thInner('ID', 'supplier_id')}</th>
              <th style={{ cursor: 'pointer' }}>{thInner('Company Name', 'company_name')}</th>
              <th style={{ cursor: 'pointer' }}>{thInner('Contact Person', 'contact_person')}</th>
              <th style={{ cursor: 'pointer' }}>{thInner('Phone', 'contact_number')}</th>
              <th style={{ cursor: 'pointer' }}>{thInner('Brand', 'brand')}</th>
              <th>Status</th>
              <th style={{ cursor: 'pointer' }}>{thInner('Updated', 'updated_at')}</th>
              <th style={{ cursor: 'pointer' }}>{thInner('Email', 'email_address')}</th>
              <th style={{ cursor: 'pointer' }}>{thInner('Catalog', 'products')}</th>
              <th>Actions</th>
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
                  <td style={{ color: textSecondary, fontSize: '0.8rem' }}>{`SUP00${s.supplier_id}`.slice(0, 7)}</td>
                  <td><strong style={{ fontSize: '0.9rem', color: textPrimary }}>{s.company_name}</strong></td>
                  <td style={{ fontSize: '0.875rem', color: textPrimary }}>{s.contact_person}</td>
                  <td style={{ fontSize: '0.875rem', color: textPrimary }}>{s.contact_number}</td>
                  <td style={{ fontSize: '0.875rem', color: textPrimary }}>{s.brand}</td>
                  <td><span className="status-pill active">Active</span></td>
                  <td style={{ color: textSecondary, fontSize: '0.8rem' }}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : 'N/A'}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    <a href={`mailto:${s.email_address}`} style={{ color: '#2563eb', textDecoration: 'none', wordBreak: 'break-all' }}>{s.email_address}</a>
                  </td>
                  <td>
                    <button className="catalog-badge-btn" onClick={() => handleOpenCatalog(s)}>
                      <Box size={13} /> {getProductCount(s.supplier_id)}
                    </button>
                  </td>
                  <td>
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

      {/* MODAL: CATALOG */}
      {isCatalogModalOpen && selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{ minHeight: '500px', background: cardBg }}>
            {catalogViewMode === 'list' && (
              <>
                <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', color: textPrimary }}>Catalog — {selectedSupplier.company_name}</h3>
                    <p style={{ color: textSecondary, fontSize: '0.9rem', marginTop: 4 }}>Add or view products from this supplier.</p>
                  </div>
                  <button onClick={() => setIsCatalogModalOpen(false)} style={{ background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} color="#475569" />
                  </button>
                </div>
                <div style={{ marginTop: '20px', marginBottom: '10px' }}><h4 style={{ fontSize: '0.95rem', color: textPrimary }}>Current Catalog ({supplierProducts.length} items)</h4></div>
                <div style={{ maxHeight: '350px', overflowY: 'auto', border: `1px solid ${cardBorder}`, borderRadius: '8px' }}>
                  {supplierProducts.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: textSecondary }}>No items in catalog yet.</div>
                  ) : (
                    supplierProducts.map(p => (
                      <div key={p.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${cardBorder}` }}>
                        <div>
                          <div style={{ fontWeight: 600, color: textPrimary }}>{p.name}</div>
                          <div style={{ fontSize: '0.8rem', color: textSecondary }}>{getCategoryName(p.category_id)} • {Math.floor(p.stock_quantity || 0)} {p.unit_of_measurement} • ₱{p.price}</div>
                        </div>
                        <span className={`status-pill ${(p.stock_quantity || 0) > 0 ? 'Active' : 'out-of-stock'}`}>{(p.stock_quantity || 0) > 0 ? 'In Stock' : 'Out of Stock'}</span>
                      </div>
                    ))
                  )}
                </div>
                <button onClick={() => setCatalogViewMode('add')} style={{ width: '100%', marginTop: '20px', padding: '12px', border: `1px dashed ${inputBorder}`, background: 'transparent', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, color: textPrimary }}>
                  <Plus size={16} /> Add New Item to Catalog
                </button>
              </>
            )}

            {catalogViewMode === 'add' && (
              <>
                <div className="modal-header">
                  <h3 style={{ color: textPrimary }}>Add New Item to Catalog</h3>
                  <button onClick={() => setCatalogViewMode('list')} style={{ background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} color="#475569" />
                  </button>
                </div>
                <div className="form-group">
                  <label style={{ color: textSecondary }}>Supplier (Read-only)</label>
                  <input value={selectedSupplier.company_name} disabled style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: isDark ? '#0f172a' : '#f8fafc', color: textSecondary }} />
                </div>
                <div className="form-group">
                  <label style={{ color: textSecondary }}>
                    Product Name *
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', float: 'right' }}>{(productForm.name || '').length}/{PRODUCT_NAME_MAX}</span>
                  </label>
                  <input
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary }}
                    value={productForm.name}
                    maxLength={PRODUCT_NAME_MAX}
                    onChange={e => setProductForm({ ...productForm, name: e.target.value.slice(0, PRODUCT_NAME_MAX) })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: textSecondary }}>Category *</label>
                    <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary }} value={productForm.category_id} onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}>
                      {(categories || []).map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: textSecondary }}>Unit</label>
                    <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary }} value={productForm.unit_of_measurement} onChange={e => setProductForm({ ...productForm, unit_of_measurement: e.target.value })}>
                      <option value="pcs">pcs</option><option value="pair">pair</option><option value="box">box</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: textSecondary }}>Cost Price (₱) * <span style={{fontSize:'0.72rem',color:'#94a3b8'}}>(max ₱99,999)</span></label>
                    <input
                      type="number" min="0" max="99999" step="0.01"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary }}
                      value={productForm.price}
                      onChange={e => {
                        let val = parseFloat(e.target.value);
                        if (isNaN(val) || val < 0) val = 0;
                        if (val > 99999) val = 99999;
                        setProductForm({ ...productForm, price: parseFloat(val.toFixed(2)) });
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: textSecondary }}>Initial Stock</label>
                    <input type="number" min="0" step="1" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary }} value={productForm.stock_quantity} onChange={e => setProductForm({ ...productForm, stock_quantity: Math.floor(Number(e.target.value)) || 0 })} />
                  </div>
                  <div className="form-group">
                    <label style={{ color: textSecondary }}>Re-order Level</label>
                    <input
                      type="number" min="0" step="1"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${productThresholdError ? '#ef4444' : inputBorder}`, background: inputBg, color: textPrimary }}
                      value={productForm.low_stock_threshold}
                      onChange={handleProductThresholdChange}
                    />
                    {productThresholdError && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, color: '#ef4444', fontSize: '0.78rem' }}>
                        <AlertCircle size={12} /> {productThresholdError}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="confirm-btn" style={{ background: '#2563eb' }} onClick={handleAddProductToCatalog}>Add Product</button>
                  <button className="cancel-btn" onClick={() => setCatalogViewMode('list')}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;