import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, Upload, Image as ImageIcon, AlertCircle, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import axios from 'axios';
import API_BASE from './Baseuri';

const Products = ({ products, setProducts, categories, suppliers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8; 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); 

  // FEATURE 6: threshold validation error state
  const [thresholdError, setThresholdError] = useState('');
  const [stockError, setStockError] = useState('');
  
  const initialForm = { 
    product_id: '', name: '', category_id: 1, supplier_id: 1, 
    unit_of_measurement: 'pcs', stock_quantity: 0, initial_inventory: 0,
    low_stock_threshold: 10, price: 0, is_active: true,
    image: null,
    rawFile: null
  };
  
  const [formData, setFormData] = useState(initialForm);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const getCategoryName = (id) => categories.find(c => c.category_id === parseInt(id))?.category_name || 'Unknown';
  const getSupplierName = (id) => suppliers.find(s => s.supplier_id === parseInt(id))?.company_name || 'Unknown';

  const getStatus = (p) => {
    if (p.stock_quantity === 0) return 'Out of Stock';
    if (p.stock_quantity <= p.low_stock_threshold) return 'Low Stock';
    return 'In Stock';
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
    setCurrentPage(1);
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <ChevronsUpDown size={13} style={{ opacity: 0.35, marginLeft: 4, flexShrink: 0 }} />;
    if (sortConfig.direction === 'asc') return <ChevronUp size={13} style={{ color: '#2563eb', marginLeft: 4, flexShrink: 0 }} />;
    return <ChevronDown size={13} style={{ color: '#2563eb', marginLeft: 4, flexShrink: 0 }} />;
  };

  const thStyle = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };
  const thInner = (label, colKey) => (
    <div onClick={() => handleSort(colKey)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
      {label}<SortIcon colKey={colKey} />
    </div>
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getCategoryName(p.category_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedProducts = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredProducts;
    return [...filteredProducts].sort((a, b) => {
      let aVal, bVal;
      const statusOrder = { 'Out of Stock': 0, 'Low Stock': 1, 'In Stock': 2 };
      switch (sortConfig.key) {
        case 'name':     aVal = (a.name || '').toLowerCase();                 bVal = (b.name || '').toLowerCase(); break;
        case 'category': aVal = getCategoryName(a.category_id).toLowerCase(); bVal = getCategoryName(b.category_id).toLowerCase(); break;
        case 'supplier': aVal = getSupplierName(a.supplier_id).toLowerCase(); bVal = getSupplierName(b.supplier_id).toLowerCase(); break;
        case 'stock':    aVal = a.stock_quantity || 0;                        bVal = b.stock_quantity || 0; break;
        case 'price':    aVal = a.price || 0;                                 bVal = b.price || 0; break;
        case 'status':   aVal = statusOrder[getStatus(a)] ?? 2;               bVal = statusOrder[getStatus(b)] ?? 2; break;
        default: return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortConfig]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);
  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData(initialForm);
    setThresholdError('');
    setStockError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setModalMode('edit');
    setFormData({ ...product, image: product.image_path, rawFile: null });
    setThresholdError('');
    setStockError('');
    setIsModalOpen(true);
  };

  // ✅ FIXED: setProducts is now inside try, only called on confirmed success.
  // An alert is shown to the user if the delete fails.
  const handleDelete = async (id) => {
    if (window.confirm('Delete this product?')) {
      try {
        const res = await axios.delete(`${API_BASE}/api/products/${id}`);
        if (res.data?.success) {
          setProducts(products.filter(p => p.product_id !== id));
        } else {
          alert('Failed to delete product: ' + (res.data?.message || 'Unknown error'));
        }
      } catch (err) {
        console.error('Delete product error:', err);
        alert('Failed to delete product. Please check your connection and try again.');
      }
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result, rawFile: file });
      };
      reader.readAsDataURL(file);
    }
  };

  // FEATURE 6: Validate threshold (no negative, no decimals)
  const handleThresholdChange = (e) => {
    const raw = e.target.value;
    const val = parseFloat(raw);
    
    if (raw === '' || raw === '-') {
      setThresholdError('Threshold cannot be empty or negative.');
      setFormData({...formData, low_stock_threshold: raw});
      return;
    }
    if (val < 0) {
      setThresholdError('Threshold cannot be negative.');
      setFormData({...formData, low_stock_threshold: raw});
      return;
    }
    if (!Number.isInteger(val)) {
      setThresholdError('Threshold must be a whole number (no decimals).');
      setFormData({...formData, low_stock_threshold: raw});
      return;
    }
    setThresholdError('');
    setFormData({...formData, low_stock_threshold: Math.floor(val)});
  };

  // FEATURE: Validate price — no negative, max 5 digits (0–99999)
  const handlePriceChange = (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 99999) val = 99999;
    // Round to 2 decimal places to avoid exponent notation
    setFormData({ ...formData, price: parseFloat(val.toFixed(2)) });
  };

  const NAME_MAX = 80; // max characters for product name
  const handleStockChange = (e) => {
    const raw = e.target.value;
    const val = parseFloat(raw);
    if (val < 0) {
      setStockError('Stock cannot be negative.');
      setFormData({...formData, stock_quantity: raw});
      return;
    }
    if (!Number.isInteger(val) && raw !== '') {
      setStockError('Stock must be a whole number.');
      setFormData({...formData, stock_quantity: Math.floor(val)});
      return;
    }
    setStockError('');
    setFormData({...formData, stock_quantity: Math.floor(val) || 0});
  };

  const handleSave = async () => {
    if (!formData.name) return alert('Product Name is required');
    
    // FEATURE 6: Block save if threshold is invalid
    const threshold = parseFloat(formData.low_stock_threshold);
    if (isNaN(threshold) || threshold < 0) {
      return alert('Low Stock Threshold cannot be negative. Please enter a valid whole number (0 or more).');
    }
    if (!Number.isInteger(threshold)) {
      return alert('Low Stock Threshold must be a whole number (no decimal points).');
    }

    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('category_id', formData.category_id);
    submitData.append('supplier_id', formData.supplier_id);
    submitData.append('unit_of_measurement', formData.unit_of_measurement);
    submitData.append('stock_quantity', Math.floor(formData.stock_quantity || 0));
    submitData.append('low_stock_threshold', Math.floor(threshold));
    submitData.append('price', formData.price);

    if (formData.rawFile) {
      submitData.append('image', formData.rawFile);
    }

    try {
      if (modalMode === 'add') {
        const res = await axios.post(API_BASE + '/api/products', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success) {
          setProducts([...products, res.data.data]);
          setIsModalOpen(false);
          alert("Product successfully added!");
        } else {
          alert("Error: " + res.data.message);
        }
      } else {
        const res = await axios.put(`${API_BASE}/api/products/${formData.product_id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (res.data.success) {
          setProducts(products.map(p => p.product_id === formData.product_id ? res.data.data : p));
          setIsModalOpen(false);
          alert("Product successfully updated!");
        } else {
          alert("Error: " + res.data.message);
        }
      }
    } catch (error) {
      console.error(error);
      alert("Connection failed. Cannot reach server.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Products</h2><p>Manage inventory items</p></div>
        <button className="primary-btn" style={{background: '#0f172a', color: 'white'}} onClick={handleOpenAdd}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="search-input-wrapper">
        <Search size={18} color="#64748b" />
        <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th style={thStyle}>{thInner('Name', 'name')}</th>
              <th style={thStyle}>{thInner('Category', 'category')}</th>
              <th style={thStyle}>{thInner('Supplier', 'supplier')}</th>
              <th style={thStyle}>{thInner('Stock', 'stock')}</th>
              <th>Unit</th>
              <th style={thStyle}>{thInner('Price', 'price')}</th>
              <th style={thStyle}>{thInner('Status', 'status')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Search size={32} color="#cbd5e1" />
                    <span style={{ fontWeight: 600, color: '#64748b', fontSize: '1rem' }}>
                      {searchQuery ? `No products found for "${searchQuery}"` : 'No products available.'}
                    </span>
                    {searchQuery && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Try adjusting your search.</span>}
                  </div>
                </td>
              </tr>
            ) : (
            paginatedProducts.map(p => {
              const status = getStatus(p);

              return (
                <tr key={p.product_id}>
                  <td>
                    <div style={{width: 40, height: 40, borderRadius: 6, background: '#f1f5f9', overflow: 'hidden', display:'flex', alignItems:'center', justifyContent:'center'}}>
                      {p.image_path ? <img src={p.image_path} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <ImageIcon size={16} color="#cbd5e1"/>}
                    </div>
                  </td>
                  <td><strong>{p.name}</strong></td>
                  <td>{getCategoryName(p.category_id)}</td>
                  <td style={{color: '#2563eb'}}>{getSupplierName(p.supplier_id)}</td>
                  {/* FEATURE 4: Display whole numbers only */}
                  <td style={{fontWeight: 600}}>{Math.floor(p.stock_quantity || 0)}</td>
                  <td style={{color: '#64748b'}}>{p.unit_of_measurement}</td>
                  <td>₱{p.price.toFixed(2)}</td>
                  <td><span className={`status-pill ${status.toLowerCase().replace(/\s/g, '-')}`}>{status}</span></td>
                  <td>
                    <div className="action-icons">
                      <button className="icon-btn edit" onClick={() => handleOpenEdit(p)}><Edit2 size={16}/></button>
                      <button className="icon-btn delete" onClick={() => handleDelete(p.product_id)}><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
        <div className="pagination-container">
          <span className="page-info">Page {currentPage} of {totalPages || 1}</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16}/></button>
            <button className="page-btn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16}/></button>
          </div>
        </div>
      </div>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'Add New Product' : 'Edit Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:'6px', cursor:'pointer', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <X size={18} color="#475569"/>
              </button>
            </div>
            
            {/* FEATURE 1: Image closer to the page details - side-by-side layout */}
            <div style={{display:'flex', gap:'20px', marginBottom:'20px', alignItems:'flex-start'}}>
              {/* Image Preview - left side */}
              <div style={{flexShrink:0}}>
                <label style={{display:'block', fontSize:'0.85rem', fontWeight:600, color:'#374151', marginBottom:'8px'}}>Product Image</label>
                <div style={{width:110, height:110, borderRadius:10, border:'2px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#f8fafc', position:'relative'}}>
                  {formData.image ? (
                    <img src={formData.image} alt="Preview" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                  ) : (
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                      <ImageIcon size={28} color="#94a3b8"/>
                      <span style={{fontSize:'0.65rem', color:'#94a3b8', textAlign:'center'}}>No image</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" id="prod-image-upload" style={{display:'none'}} onChange={handleImageUpload} />
                <label htmlFor="prod-image-upload" style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', marginTop:8, padding:'6px 12px', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6, fontSize:'0.8rem', fontWeight:600, color:'#334155'}}>
                  <Upload size={13}/> Upload
                </label>
                <p style={{fontSize:'0.7rem', color:'#94a3b8', marginTop:4}}>.jpg, .png</p>
              </div>

              {/* Product name - right of image */}
              <div style={{flex:1}}>
                <div className="form-group" style={{marginBottom:0}}>
                  <label>Product Name * <span style={{fontSize:'0.75rem',color:'#94a3b8',float:'right'}}>{(formData.name||'').length}/{NAME_MAX}</span></label>
                  <input
                    value={formData.name}
                    maxLength={NAME_MAX}
                    onChange={e => setFormData({...formData, name: e.target.value.slice(0, NAME_MAX)})}
                    placeholder="e.g. Hammer, Nails, Drill Bit..."
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                  {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Supplier</label>
                <select value={formData.supplier_id} onChange={e => setFormData({...formData, supplier_id: e.target.value})}>
                  {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.company_name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Unit Price (₱) <span style={{fontSize:'0.72rem',color:'#94a3b8'}}>(max ₱99,999)</span></label>
                <input type="number" min="0" max="99999" step="0.01" value={formData.price} onChange={handlePriceChange} />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <select value={formData.unit_of_measurement} onChange={e => setFormData({...formData, unit_of_measurement: e.target.value})}>
                  <option value="pcs">pcs</option>
                  <option value="pair">pair</option>
                  <option value="set">set</option>
                  <option value="box">box</option>
                  <option value="each">each</option>
                  <option value="dozen">dozen</option>
                  <option value="gross">gross</option>
                  <option value="foot">foot</option>
                  <option value="inch">inch</option>
                  <option value="meter">meter</option>
                  <option value="mm">millimeter</option>
                  <option value="yard">yard</option>
                  <option value="sqft">square foot</option>
                  <option value="sqm">square meter</option>
                  <option value="sheet">sheet</option>
                  <option value="kg">kilogram</option>
                  <option value="lb">pound</option>
                  <option value="oz">ounce</option>
                  <option value="ton">metric ton</option>
                  <option value="liter">liter</option>
                  <option value="gallon">gallon</option>
                  <option value="ml">milliliter</option>
                  <option value="cum">cubic meter</option>
                  <option value="cuyd">cubic yard</option>
                  <option value="carton">carton</option>
                  <option value="case">case</option>
                  <option value="roll">roll</option>
                  <option value="bag">bag</option>
                  <option value="bundle">bundle</option>
                  <option value="kit">kit</option>
                  <option value="tube">tube</option>
                  <option value="bucket">bucket</option>
                  <option value="lot">lot</option>
                  <option value="bdft">board foot</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              {/* FEATURE 4: Stock - whole numbers only */}
              <div className="form-group">
                <label>Stock (whole numbers)</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  value={formData.stock_quantity} 
                  onChange={handleStockChange}
                />
                {stockError && (
                  <div style={{display:'flex', alignItems:'center', gap:4, marginTop:4, color:'#ef4444', fontSize:'0.78rem'}}>
                    <AlertCircle size={12}/> {stockError}
                  </div>
                )}
              </div>

              {/* FEATURE 6: Threshold - no negative, no decimal */}
              <div className="form-group">
                <label>Low Stock Threshold</label>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  value={formData.low_stock_threshold} 
                  onChange={handleThresholdChange}
                  style={{borderColor: thresholdError ? '#ef4444' : undefined}}
                />
                {thresholdError && (
                  <div style={{display:'flex', alignItems:'center', gap:4, marginTop:4, color:'#ef4444', fontSize:'0.78rem'}}>
                    <AlertCircle size={12}/> {thresholdError}
                  </div>
                )}
                {!thresholdError && (
                  <p style={{fontSize:'0.72rem', color:'#94a3b8', marginTop:4}}>Must be 0 or a positive whole number.</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="confirm-btn" 
                style={{background: '#0f172a', opacity: thresholdError || stockError ? 0.6 : 1}} 
                onClick={handleSave}
                disabled={!!thresholdError || !!stockError}
              >
                Save Product
              </button>
              <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;