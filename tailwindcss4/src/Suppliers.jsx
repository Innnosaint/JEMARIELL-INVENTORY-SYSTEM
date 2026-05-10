import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, Box, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

const Suppliers = ({ suppliers, setSuppliers, products, setProducts, categories }) => {
  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Modal States
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false); 
  const [isEditing, setIsEditing] = useState(false); 
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false); 
  const [catalogViewMode, setCatalogViewMode] = useState('list'); 
  
  // Selection States
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  
  // Form States
  const initialSupplierForm = { 
      company_name: '', contact_person: '', contact_number: '', 
      email_address: '', brand: '', address: '', is_active: true
  };
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);

  const initialProductForm = {
    name: '', category_id: categories[0]?.category_id || 1, 
    unit_of_measurement: 'pcs', stock_quantity: 0, 
    low_stock_threshold: 10, price: 0, description: ''
  };
  const [productForm, setProductForm] = useState(initialProductForm);

  // --- HELPERS ---
  const getProductCount = (supplierId) => products.filter(p => p.supplier_id === supplierId).length;
  const getCategoryName = (id) => categories.find(c => c.category_id === parseInt(id))?.category_name || 'Unknown';

  // --- HANDLERS: SUPPLIER CRUD ---
  const handleOpenAddSupplier = () => {
    setSupplierForm(initialSupplierForm);
    setIsEditing(false);
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier) => {
    setSupplierForm(supplier);
    setIsEditing(true);
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if(!supplierForm.company_name) return alert("Company Name is required");
    
    // GINAWA NATING 127.0.0.1 PARA HINDI MALITO ANG BROWSER
    if (isEditing) {
      try {
        const res = await axios.put(`http://127.0.0.1:5000/api/suppliers/${supplierForm.supplier_id}`, supplierForm);
        if (res.data.success) {
          setSuppliers(suppliers.map(s => s.supplier_id === supplierForm.supplier_id ? res.data.data : s));
          setIsSupplierModalOpen(false); 
          alert("Supplier successfully updated!");
        }
      } catch (error) {
        console.error(error);
        alert("Connection failed. Check server.");
      }
    } else {
      try {
        const res = await axios.post('http://127.0.0.1:5000/api/suppliers', supplierForm);
        if (res.data.success) {
          setSuppliers([...suppliers, res.data.data]);
          setIsSupplierModalOpen(false); 
          alert("Supplier successfully added!");
        }
      } catch (error) {
        console.error(error);
        alert("Connection failed. Check server.");
      }
    }
  };

  const handleDeleteSupplier = async (id) => {
    if(window.confirm('Are you sure you want to delete this supplier?')) {
        // Pwedeng idagdag ang delete API call dito sa susunod
        alert("Supplier deletion will be added soon!");
    }
  };

  // --- HANDLERS: CATALOG ---
  const handleOpenCatalog = (supplier) => {
    setSelectedSupplier(supplier);
    setCatalogViewMode('list');
    setIsCatalogModalOpen(true);
  };

  const handleAddProductToCatalog = async () => {
    if (!productForm.name) return alert('Name is required');

    // NAKA-FORMDATA NA ITO PARA MAINTINDIHAN NI PYTHON
    const submitData = new FormData();
    submitData.append('name', productForm.name);
    submitData.append('category_id', productForm.category_id);
    submitData.append('supplier_id', selectedSupplier.supplier_id);
    submitData.append('unit_of_measurement', productForm.unit_of_measurement);
    submitData.append('stock_quantity', productForm.stock_quantity);
    submitData.append('low_stock_threshold', productForm.low_stock_threshold);
    submitData.append('price', productForm.price);

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/products', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        setProducts([...products, res.data.data]);
        setCatalogViewMode('list');
        setProductForm(initialProductForm);
        alert("Product successfully added to catalog!");
      } else {
        alert("Error: " + res.data.message);
      }
    } catch (error) {
      console.error(error);
      alert(`Connection error: ${error.message}`);
    }
  };

  // --- FILTER & PAGINATION ---
  const filteredSuppliers = suppliers.filter(s => 
      s.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const supplierProducts = selectedSupplier ? products.filter(p => p.supplier_id === selectedSupplier.supplier_id) : [];

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div><h2>Suppliers</h2><p>Manage your supplier network</p></div>
        <button className="primary-btn" style={{background: '#0f172a', color: 'white'}} onClick={handleOpenAddSupplier}>
          <Plus size={16} /> Add Supplier
        </button>
      </div>
      
      {/* SEARCH */}
      <div className="search-input-wrapper">
        <Search size={18} color="#64748b" />
        <input type="text" placeholder="Search suppliers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {/* SUPPLIER TABLE */}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Company Name</th><th>Contact Person</th><th>Number</th>
              <th>Brand</th><th>Status</th><th>Updated</th><th>Contact</th><th>Catalog</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSuppliers.map(s => (
              <tr key={s.supplier_id}>
                <td style={{color: '#64748b', fontSize: '0.8rem'}}>{`SUP00${s.supplier_id}`.slice(0, 7)}</td>
                <td><strong>{s.company_name}</strong></td>
                <td>{s.contact_person}</td>
                <td>{s.contact_number}</td>
                <td>{s.brand}</td>
                <td><span className="status-pill active">active</span></td>
                <td style={{color: '#64748b', fontSize: '0.8rem'}}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString() : 'N/A'}</td>
                <td><a href={`mailto:${s.email_address}`} style={{color:'#2563eb', textDecoration:'none'}}>{s.email_address}</a></td>
                <td>
                  <button className="catalog-badge-btn" onClick={() => handleOpenCatalog(s)}>
                     <Box size={14} /> {getProductCount(s.supplier_id)} items
                  </button>
                </td>
                <td>
                  <div className="action-icons">
                    <button className="icon-btn edit" onClick={() => handleOpenEditSupplier(s)}><Edit2 size={16}/></button>
                    <button className="icon-btn delete" onClick={() => handleDeleteSupplier(s.supplier_id)}><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* PAGINATION */}
        <div className="pagination-container">
          <span className="page-info">Page {currentPage} of {totalPages || 1}</span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16}/></button>
            <button className="page-btn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16}/></button>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD/EDIT SUPPLIER */}
      {isSupplierModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={20}/></button>
            </div>
            <div className="form-group"><label>Company Name</label><input value={supplierForm.company_name} onChange={e => setSupplierForm({...supplierForm, company_name: e.target.value})} placeholder="e.g. Micsoft Industries"/></div>
            <div className="form-row">
                <div className="form-group"><label>Contact Person</label><input value={supplierForm.contact_person} onChange={e => setSupplierForm({...supplierForm, contact_person: e.target.value})}/></div>
                <div className="form-group"><label>Phone Number</label><input value={supplierForm.contact_number} onChange={e => setSupplierForm({...supplierForm, contact_number: e.target.value})}/></div>
            </div>
            <div className="form-group"><label>Email Address</label><input value={supplierForm.email_address} onChange={e => setSupplierForm({...supplierForm, email_address: e.target.value})}/></div>
            <div className="form-group"><label>Brand</label><input value={supplierForm.brand} onChange={e => setSupplierForm({...supplierForm, brand: e.target.value})}/></div>
            <div className="modal-footer">
              <button className="confirm-btn" style={{background: '#0f172a'}} onClick={handleSaveSupplier}>{isEditing ? 'Update Supplier' : 'Save Supplier'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGE CATALOG */}
      {isCatalogModalOpen && selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{minHeight: '500px'}}>
            {catalogViewMode === 'list' && (
              <>
                <div className="modal-header" style={{borderBottom:'none', paddingBottom: 0}}>
                   <div>
                      <h3 style={{fontSize: '1.2rem'}}>Manage Supplier Products - {selectedSupplier.company_name}</h3>
                      <p style={{color: '#64748b', fontSize: '0.9rem', marginTop: 4}}>Add or remove products from the supplier's catalog.</p>
                   </div>
                   <button onClick={() => setIsCatalogModalOpen(false)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={20}/></button>
                </div>
                <div style={{marginTop: '20px', marginBottom: '10px'}}><h4 style={{fontSize: '0.95rem'}}>Current Catalog</h4></div>
                <div className="catalog-list" style={{maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px'}}>
                   {supplierProducts.length === 0 ? (
                      <div style={{padding: '30px', textAlign: 'center', color: '#64748b'}}>No items in catalog yet.</div>
                   ) : (
                      supplierProducts.map(p => (
                        <div key={p.product_id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderBottom:'1px solid #f1f5f9'}}>
                           <div>
                              <div style={{fontWeight: 600}}>{p.name}</div>
                              <div style={{fontSize: '0.8rem', color: '#64748b'}}>{getCategoryName(p.category_id)} • {p.stock_quantity} {p.unit_of_measurement} • ₱{p.price}</div>
                           </div>
                           <span className={`status-pill ${p.stock_quantity > 0 ? 'active' : 'out-of-stock'}`}>{p.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}</span>
                        </div>
                      ))
                   )}
                </div>
                <button className="catalog-add-btn" onClick={() => setCatalogViewMode('add')} style={{width: '100%', marginTop: '20px', padding: '12px', border: '1px dashed #cbd5e1', background: 'white', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, color: '#0f172a'}}>
                   <Plus size={16}/> Add New Item to Catalog
                </button>
              </>
            )}

            {catalogViewMode === 'add' && (
               <>
                 <div className="modal-header">
                    <h3>Add New Item</h3>
                    <button onClick={() => setCatalogViewMode('list')} style={{background:'none', border:'none', cursor:'pointer'}}><X size={20}/></button>
                 </div>
                 <div className="form-group"><label>Supplier (Read-only)</label><input value={selectedSupplier.company_name} disabled style={{background: '#f8fafc', color: '#64748b'}}/></div>
                 <div className="form-group"><label>Product Name *</label><input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})}/></div>
                 <div className="form-row">
                    <div className="form-group">
                       <label>Category *</label>
                       <select value={productForm.category_id} onChange={e => setProductForm({...productForm, category_id: e.target.value})}>
                          {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                       </select>
                    </div>
                    <div className="form-group">
                       <label>Unit</label>
                       <select value={productForm.unit_of_measurement} onChange={e => setProductForm({...productForm, unit_of_measurement: e.target.value})}><option value="pcs">pcs</option><option value="pair">pair</option><option value="box">box</option></select>
                    </div>
                 </div>
                 <div className="form-row">
                    <div className="form-group"><label>Cost Price (₱) *</label><input type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})}/></div>
                 </div>
                 <div className="form-row">
                    <div className="form-group"><label>Initial Stock</label><input type="number" value={productForm.stock_quantity} onChange={e => setProductForm({...productForm, stock_quantity: e.target.value})}/></div>
                    <div className="form-group"><label>Re-order Level</label><input type="number" value={productForm.low_stock_threshold} onChange={e => setProductForm({...productForm, low_stock_threshold: e.target.value})}/></div>
                 </div>
                 <div className="modal-footer">
                    <button className="confirm-btn" style={{background: '#0f172a'}} onClick={handleAddProductToCatalog}>Add Product</button>
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