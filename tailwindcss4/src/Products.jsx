import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight, Upload, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

const Products = ({ products, setProducts, categories, suppliers }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8; 

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); 
  
  // Form State
  const initialForm = { 
    product_id: '', name: '', category_id: 1, supplier_id: 1, 
    unit_of_measurement: 'pcs', stock_quantity: 0, initial_inventory: 0,
    low_stock_threshold: 10, price: 0, is_active: true,
    image: null, // Para sa preview sa screen
    rawFile: null // Para sa mismong file na ipapadala sa Supabase
  };
  
  const [formData, setFormData] = useState(initialForm);

  // Helpers
  const getCategoryName = (id) => categories.find(c => c.category_id === parseInt(id))?.category_name || 'Unknown';
  const getSupplierName = (id) => suppliers.find(s => s.supplier_id === parseInt(id))?.company_name || 'Unknown';

  // Filter & Pagination Logic
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    getCategoryName(p.category_id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- HANDLERS PARA BUMUKAS ANG POPUP ---
  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData(initialForm); // Nililinis ang form para sa bagong product
    setIsModalOpen(true);     // Pinapalabas ang popup
  };

  const handleOpenEdit = (product) => {
    setModalMode('edit');
    setFormData({ ...product, image: product.image_path, rawFile: null });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if(window.confirm('Delete this product?')) {
      setProducts(products.filter(p => p.product_id !== id));
    }
  };

  // --- IMAGE UPLOAD PREVIEW ---
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

  // --- SAVE TO SUPABASE ---
  const handleSave = async () => {
    if (!formData.name) return alert('Name is required');

    // Gumagawa tayo ng FormData dahil may kasamang picture (file)
    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('category_id', formData.category_id);
    submitData.append('supplier_id', formData.supplier_id);
    submitData.append('unit_of_measurement', formData.unit_of_measurement);
    submitData.append('stock_quantity', formData.stock_quantity);
    submitData.append('low_stock_threshold', formData.low_stock_threshold);
    submitData.append('price', formData.price);

    if (formData.rawFile) {
      submitData.append('image', formData.rawFile);
    }

    try {
      if (modalMode === 'add') {
        const res = await axios.post('http://127.0.0.1:5000/api/products', submitData, {
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
        const res = await axios.put(`http://127.0.0.1:5000/api/products/${formData.product_id}`, submitData, {
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
      alert("Connection failed. Hindi nakausap ang server.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Products</h2><p>Manage inventory items</p></div>
        {/* ITO ANG BUTTON NA MAGBUBUKAS SA POPUP */}
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
              <th>Name</th><th>Category</th><th>Supplier</th><th>Stock</th><th>Unit</th><th>Price</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map(p => {
               let status = 'In Stock';
               if(p.stock_quantity === 0) status = 'Out of Stock';
               else if(p.stock_quantity <= p.low_stock_threshold) status = 'Low Stock';

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
                  <td style={{fontWeight: 600}}>{p.stock_quantity}</td>
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
            })}
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

      {/* --- ADD/EDIT MODAL POPUP --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'Add New Product' : 'Edit Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={20}/></button>
            </div>
            
            <div className="form-group" style={{marginBottom: 20}}>
               <label>Product Image</label>
               <div style={{display:'flex', alignItems:'center', gap: 15}}>
                  <div style={{width: 80, height: 80, borderRadius: 8, border: '2px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background: '#f8fafc'}}>
                     {formData.image ? (
                       <img src={formData.image} alt="Preview" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                     ) : (
                       <ImageIcon size={24} color="#94a3b8"/>
                     )}
                  </div>
                  <div>
                     <input 
                       type="file" 
                       accept="image/*" 
                       id="prod-image-upload" 
                       style={{display:'none'}} 
                       onChange={handleImageUpload} 
                     />
                     <label htmlFor="prod-image-upload" className="btn-adjust" style={{display:'inline-flex', alignItems:'center', gap: 8, cursor:'pointer'}}>
                        <Upload size={14}/> Upload Photo
                     </label>
                     <p style={{fontSize:'0.75rem', color:'#64748b', marginTop: 4}}>Allowed: .jpg, .png</p>
                  </div>
               </div>
            </div>

            <div className="form-group"><label>Product Name</label><input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            
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
               <div className="form-group"><label>Unit Price (₱)</label><input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div>
               <div className="form-group"><label>Unit</label><select value={formData.unit_of_measurement} onChange={e => setFormData({...formData, unit_of_measurement: e.target.value})}><option value="pcs">pcs</option><option value="pair">pair</option><option value="set">set</option><option value="box">box</option></select></div>
            </div>

            <div className="form-row">
               <div className="form-group"><label>Stock</label><input type="number" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} /></div>
               <div className="form-group"><label>Low Threshold</label><input type="number" value={formData.low_stock_threshold} onChange={e => setFormData({...formData, low_stock_threshold: e.target.value})} /></div>
            </div>

            <div className="modal-footer">
              <button className="confirm-btn" style={{background: '#0f172a'}} onClick={handleSave}>Save Product</button>
              <button className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;