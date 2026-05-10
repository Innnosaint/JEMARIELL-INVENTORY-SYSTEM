import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import { 
  Package, TrendingUp, AlertTriangle, AlertCircle, 
  X, ChevronLeft, ChevronRight, Calendar, Filter, Download, FileText
} from 'lucide-react';

const socket = io("http://127.0.0.1:5000");

const Dashboard = ({ products, setProducts, stockMovements, setStockMovements, categories }) => {
  const ITEMS_PER_PAGE = 5;
  const MOVEMENTS_PER_PAGE = 5;

  // --- STATES ---
  const [filters, setFilters] = useState({ category_id: 'All', status: 'All' });
  const [invPage, setInvPage] = useState(1);
  const [movPage, setMovPage] = useState(1);

  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'Add', qty: '' });

  // --- REPORT STATES ---
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState({ dateRange: 'All Time', category: 'All', product: 'All' });

  // REAL-TIME LISTENER
  useEffect(() => {
    socket.on("stock_updated", (updatedProduct) => {
      setProducts((prev) => 
        prev.map((p) => p.product_id === updatedProduct.product_id ? { ...p, ...updatedProduct } : p)
      );
    });
    return () => socket.off("stock_updated");
  }, [setProducts]);

  const getCategoryName = (id) => categories?.find(c => c.category_id === id)?.category_name || 'Unknown';

  // --- DASHBOARD TABLE DATA ---
  const filteredProducts = products.filter(p => {
    let status = 'In Stock';
    const currentStock = p.stock_quantity || 0; 
    
    if (currentStock === 0) status = 'Out of Stock';
    else if (currentStock <= p.low_stock_threshold) status = 'Low Stock';

    const matchCat = filters.category_id === 'All' || p.category_id === parseInt(filters.category_id);
    const matchStat = filters.status === 'All' || status === filters.status;
    
    p.derivedStatus = status; 
    return matchCat && matchStat;
  });

  const totalInvPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((invPage - 1) * ITEMS_PER_PAGE, invPage * ITEMS_PER_PAGE);
  
  const totalMovPages = Math.ceil(stockMovements.length / MOVEMENTS_PER_PAGE);
  const paginatedMovements = stockMovements.slice((movPage - 1) * MOVEMENTS_PER_PAGE, movPage * MOVEMENTS_PER_PAGE);

  const totalValue = products.reduce((acc, p) => acc + ((p.stock_quantity || 0) * (p.price || 0)), 0);
  const lowStockCount = products.filter(p => (p.stock_quantity || 0) <= p.low_stock_threshold && (p.stock_quantity || 0) > 0).length;
  const outOfStockCount = products.filter(p => (p.stock_quantity || 0) === 0).length;
  const stockAlerts = products.filter(p => (p.stock_quantity || 0) <= p.low_stock_threshold);

  // --- DYNAMIC REPORT CALCULATIONS ---
  const filteredReportProducts = products.filter(p => {
    const matchCat = reportFilters.category === 'All' || p.category_id === parseInt(reportFilters.category);
    const matchProd = reportFilters.product === 'All' || p.product_id === parseInt(reportFilters.product);
    return matchCat && matchProd;
  });

  const reportData = {
    totalRevenue: filteredReportProducts.reduce((acc, p) => acc + ((p.sold_qty || 0) * (p.price || 0)), 0),
    totalUnitsSold: filteredReportProducts.reduce((acc, p) => acc + (p.sold_qty || 0), 0),
    totalProfit: filteredReportProducts.reduce((acc, p) => acc + ((p.sold_qty || 0) * (p.price || 0) * 0.3), 0),
    inventoryValue: filteredReportProducts.reduce((acc, p) => acc + ((p.stock_quantity || 0) * (p.price || 0)), 0)
  };

  // Compute Sales Per Category for Purple Section
  const categorySales = categories.map(cat => {
    const catProducts = filteredReportProducts.filter(p => p.category_id === cat.category_id);
    const sales = catProducts.reduce((acc, p) => acc + ((p.sold_qty || 0) * (p.price || 0)), 0);
    return { name: cat.category_name, sales: sales, id: cat.category_id };
  }).filter(c => c.sales > 0 || reportFilters.category === 'All'); 

  // --- HANDLERS ---
  const openAdjustModal = (product) => {
    setSelectedProduct(product);
    setAdjustForm({ type: 'Add', qty: '' });
    setIsAdjustOpen(true);
  };

  const handleConfirmAdjust = () => {
    if (!adjustForm.qty || parseInt(adjustForm.qty) <= 0) return alert("Enter valid quantity");
    
    const qty = parseInt(adjustForm.qty);
    const isAdd = adjustForm.type === 'Add';

    socket.emit('adjust_stock', { id: selectedProduct.product_id, qty: qty, type: adjustForm.type });

    const updatedProducts = products.map(p => {
      if (p.product_id === selectedProduct.product_id) {
        const currentStock = p.stock_quantity || 0;
        const newQty = isAdd ? currentStock + qty : Math.max(0, currentStock - qty);
        return { ...p, stock_quantity: newQty, final_cost: newQty * (p.price || 0) };
      }
      return p;
    });
    setProducts(updatedProducts);

    const newMovement = {
      movement_id: Date.now(),
      product_id: selectedProduct.product_id,
      movement_type: adjustForm.type,
      quantity_change: isAdd ? qty : -qty,
      updated_At: new Date().toLocaleString()
    };
    setStockMovements([newMovement, ...stockMovements]);
    setIsAdjustOpen(false);
  };

  return (
    <div className="dashboard-container">
      
      {/* ALERTS */}
      {stockAlerts.length > 0 && (
        <div className="alert-container">
          <div className="alert-title"><AlertCircle size={20} /> Stock Alerts</div>
          <div className="alert-list">
            {stockAlerts.map(item => (
              <div key={item.product_id} className="alert-row">
                <div>
                  <div style={{fontWeight: 700, fontSize: '0.9rem'}}>{item.name}</div>
                  <div style={{fontSize: '0.8rem', color: '#64748b'}}>Current: {item.stock_quantity || 0} | Reorder at: {item.low_stock_threshold}</div>
                </div>
                <span className={`status-pill ${item.stock_quantity === 0 ? 'out-of-stock' : 'low-stock'}`}>
                  {item.stock_quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS */}
      <section className="stats-grid">
         <div className="stat-card"><div className="stat-icon blue"><Package /></div><div><p>Total Products</p><h3>{products.length}</h3></div></div>
         <div className="stat-card"><div className="stat-icon green"><TrendingUp /></div><div><p>Total Value</p><h3>₱{totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3></div></div>
         <div className="stat-card"><div className="stat-icon yellow"><AlertTriangle /></div><div><p>Low Stock</p><h3>{lowStockCount}</h3></div></div>
         <div className="stat-card"><div className="stat-icon red"><AlertCircle /></div><div><p>Out of Stock</p><h3>{outOfStockCount}</h3></div></div>
      </section>

      {/* FILTER BAR WITH REPORTS BUTTON */}
      <div className="filter-bar-wrapper">
        <select className="filter-dropdown" value={filters.category_id} onChange={(e) => setFilters({...filters, category_id: e.target.value})}>
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </select>
        
        <select className="filter-dropdown" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
          <option value="All">All Status</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>

        {/* 👇 REPORTS BUTTON (Matches your first screenshot) 👇 */}
        <button 
          onClick={() => setIsReportOpen(true)} 
          style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}
        >
          <FileText size={16} color="#475569" /> Reports
        </button>
      </div>

      {/* INVENTORY TABLE */}
      <div className="table-card" style={{marginBottom: '2rem'}}>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>PRODUCT NAME</th><th>CATEGORY</th><th>UNIT PRICE</th><th>INITIAL</th><th>UNIT</th><th>SOLD</th><th>STOCK</th><th>FINAL COST</th><th>STATUS</th><th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map(p => (
              <tr key={p.product_id}>
                <td>{p.product_id}</td>
                <td><strong>{p.name}</strong></td>
                <td>{getCategoryName(p.category_id)}</td>
                <td>₱{p.price?.toFixed(2)}</td>
                <td>{p.initial_inventory}</td>
                <td>{p.unit_of_measurement || 'pc'}</td>
                <td>{p.sold_qty}</td>
                <td style={{fontWeight: 700, color: '#0f172a'}}>{p.stock_quantity || 0}</td>
                <td>₱{p.final_cost?.toFixed(2)}</td>
                <td><span className={`status-pill ${p.derivedStatus.toLowerCase().replace(/\s/g, '-')}`}>{p.derivedStatus}</span></td>
                <td><button className="btn-adjust" onClick={() => openAdjustModal(p)}>Adjust</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalInvPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '15px', alignItems: 'center', gap: '15px', borderTop: '1px solid #e2e8f0' }}>
             <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Page {invPage} of {totalInvPages}</span>
             <div style={{ display: 'flex', gap: '5px' }}>
               <button onClick={() => setInvPage(p => p - 1)} disabled={invPage === 1} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: invPage === 1 ? '#f1f5f9' : 'white', cursor: invPage === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={16} /></button>
               <button onClick={() => setInvPage(p => p + 1)} disabled={invPage === totalInvPages} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: invPage === totalInvPages ? '#f1f5f9' : 'white', cursor: invPage === totalInvPages ? 'not-allowed' : 'pointer' }}><ChevronRight size={16} /></button>
             </div>
          </div>
        )}
      </div>

      {/* MOVEMENTS TABLE */}
      <div className="table-card" style={{marginBottom: '2rem'}}>
         <div style={{padding:'15px 20px', borderBottom:'1px solid #e2e8f0', fontWeight:600}}>Recent Stock Movements</div>
         <table>
           <thead><tr><th>Movement ID</th><th>Product</th><th>Type</th><th>Qty</th><th>Date</th></tr></thead>
           <tbody>
             {paginatedMovements.map(m => {
               const matchedProduct = products.find(p => p.product_id === m.product_id);
               return (
                 <tr key={m.movement_id}>
                   <td>{m.movement_id}</td>
                   <td>{matchedProduct?.name || 'Unknown'}</td>
                   <td><span className={`badge-type ${m.movement_type?.toLowerCase()}`}>{m.movement_type}</span></td>
                   <td className={m.quantity_change > 0 ? 'text-green' : 'text-red'}>{m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}</td>
                   <td>{m.updated_At || m.created_at}</td>
                 </tr>
               )
             })}
           </tbody>
         </table>
      </div>

      {/* ========================================= */}
      {/* REPORT MODAL (Matches your 2nd screenshot)*/}
      {/* ========================================= */}
      {isReportOpen && (
        <div className="modal-overlay">
          <div className="modal-content report-modal">
            
            {/* Header Bar with FILTERS */}
            <div className="report-header-bar">
              <div className="report-title-group">
                 <TrendingUp className="report-title-icon" size={20} />
                 <h3 className="report-title">Stock & Sales Report</h3>
              </div>
              <div className="report-actions">
                 <div className="filter-group">
                    <Calendar size={14} className="filter-icon"/>
                    <select className="report-filter-select" value={reportFilters.dateRange} onChange={(e) => setReportFilters({...reportFilters, dateRange: e.target.value})}>
                        <option>All Time</option><option>This Month</option><option>This Year</option>
                    </select>
                 </div>
                 <div className="filter-group">
                    <Filter size={14} className="filter-icon"/>
                    <select className="report-filter-select" value={reportFilters.category} onChange={(e) => setReportFilters({...reportFilters, category: e.target.value})}>
                        <option value="All">All Categories</option>
                        {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                    </select>
                 </div>
                 <div className="filter-group">
                    <Package size={14} className="filter-icon"/>
                    <select className="report-filter-select" style={{maxWidth: 120}} value={reportFilters.product} onChange={(e) => setReportFilters({...reportFilters, product: e.target.value})}>
                        <option value="All">All Items</option>
                        {products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
                    </select>
                 </div>
                 <button className="btn-download" onClick={() => window.print()}><Download size={14}/> PDF</button>
                 <button onClick={() => setIsReportOpen(false)} className="btn-close-report"><X size={20}/></button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="report-body">
              
              {/* SECTION A: BLUE (Summary) */}
              <div className="report-card">
                 <div className="report-card-header header-blue">
                    <span>SUMMARY</span><span>VALUE</span>
                 </div>
                 <div className="report-row summary-row"><span className="summary-label">Total Sales Revenue</span><span className="summary-value">₱{reportData.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                 <div className="report-row summary-row"><span className="summary-label">Total Units Sold</span><span className="summary-value">{reportData.totalUnitsSold} units</span></div>
                 <div className="report-row summary-row"><span className="summary-label">Total Profit (Est. 30%)</span><span className="summary-value">₱{reportData.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
              </div>

              {/* SECTION B: GREEN (Product Breakdown) */}
              <div className="report-card">
                 <div className="report-card-header header-green">
                    <span>PRODUCT</span><span>SOLD</span><span>REVENUE</span><span>STOCK</span><span>STATUS</span>
                 </div>
                 {filteredReportProducts.map(p => {
                    const rev = (p.sold_qty || 0) * (p.price || 0);
                    return (
                      <div className="report-row product-grid-row" key={p.product_id}>
                        <span className="product-name">{p.name}</span>
                        <span>{p.sold_qty || 0}</span>
                        <span>₱{rev.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        <span style={{fontWeight: 600}}>{p.stock_quantity || 0}</span>
                        <span className={`status-pill ${p.derivedStatus?.toLowerCase().replace(/\s/g, '-') || 'in-stock'}`} style={{width: 'max-content'}}>
                          {p.derivedStatus || 'In Stock'}
                        </span>
                      </div>
                    )
                 })}
              </div>

              {/* SECTION C: PURPLE (Category Totals) */}
              <div className="report-card">
                 <div className="report-card-header header-purple">
                    <span>CATEGORY</span><span>TOTAL SALES</span>
                 </div>
                 {categorySales.map(c => (
                   <div className="report-row category-row" key={c.id}>
                      <span className="cat-name">{c.name}</span>
                      <span className="cat-val">₱{c.sales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                   </div>
                 ))}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ADJUST MODAL */}
      {isAdjustOpen && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
             <div className="modal-header">
               <h3>Adjust - {selectedProduct.name}</h3>
               <button onClick={() => setIsAdjustOpen(false)}><X size={20}/></button>
              </div>
             <div style={{padding: '24px'}}>
               <p>Current Stock: <strong>{selectedProduct.stock_quantity || 0}</strong></p>
               <div className="form-group"><label>Type</label><select value={adjustForm.type} onChange={e => setAdjustForm({...adjustForm, type: e.target.value})}><option value="Add">Add</option><option value="Deduct">Deduct</option></select></div>
               <div className="form-group"><label>Qty</label><input type="number" value={adjustForm.qty} onChange={e => setAdjustForm({...adjustForm, qty: e.target.value})} /></div>
             </div>
             <div className="modal-footer"><button className="confirm-btn" style={{width: '100%'}} onClick={handleConfirmAdjust}>Confirm</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;