import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { Link } from 'react-router-dom';
import { 
  Search, MapPin, Phone, Mail, ArrowRight, 
  Box, Calendar, UserCog, X, CheckCircle, AlertTriangle, AlertCircle,
  Facebook, Instagram, ChevronLeft, ChevronRight,
  ShieldCheck, Truck, CreditCard, Tag, Layers, Clock,
  Hammer, Wrench, HardHat, Zap, Anchor
} from 'lucide-react';

const CustomerLanding = ({ products, categories, suppliers = [] }) => {
  // --- STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8; 

  // --- NEW: REF FOR CATEGORY SLIDER ---
  const categoryScrollRef = useRef(null);

  // --- CONFIG ---
  const heroImages = [
    {
      url: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?q=80&w=2070&auto=format&fit=crop',
      title: "INDUSTRIAL GRADE INVENTORY",
      subtitle: "Equip your workforce with top-tier professional tools."
    },
    {
      url: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2070&auto=format&fit=crop',
      title: "CONSTRUCTION ESSENTIALS",
      subtitle: "Heavy duty materials for heavy duty jobs."
    },
    {
      url: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=2070&auto=format&fit=crop',
      title: "WAREHOUSE DIRECT PRICES",
      subtitle: "Get the best rates on bulk orders today."
    }
  ];

  const getCategoryStyle = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('hand')) return { icon: <Hammer size={32}/>, color: 'bg-blue-100 text-blue-600' };
    if (lower.includes('construction')) return { icon: <HardHat size={32}/>, color: 'bg-orange-100 text-orange-600' };
    if (lower.includes('power')) return { icon: <Zap size={32}/>, color: 'bg-yellow-100 text-yellow-600' };
    if (lower.includes('safety')) return { icon: <ShieldCheck size={32}/>, color: 'bg-green-100 text-green-600' };
    if (lower.includes('fastener')) return { icon: <Anchor size={32}/>, color: 'bg-gray-100 text-gray-600' };
    return { icon: <Wrench size={32}/>, color: 'bg-purple-100 text-purple-600' };
  };

  // --- EFFECTS ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 4000); 
    return () => clearInterval(timer);
  }, [heroImages.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  // --- HANDLERS ---
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    const gridElement = document.getElementById('product-grid-anchor');
    if(gridElement) gridElement.scrollIntoView({ behavior: 'smooth' });
  };

  // NEW: Scroll Function for Categories
  const scrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      const scrollAmount = 300; // Distance to scroll
      categoryScrollRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  // --- HELPERS ---
  const getCategoryName = (id) => categories.find(c => c.category_id === parseInt(id))?.category_name || 'General';
  const getSupplierInfo = (id) => {
    const supp = suppliers.find(s => s.supplier_id === parseInt(id));
    return supp ? { name: supp.company_name, brand: supp.brand } : { name: 'Verified Supplier', brand: 'Generic' };
  };
  const getStockStatus = (qty, threshold) => {
    if (qty === 0) return { label: "Out of Stock", color: "#dc3545", bg: "#fde8e8", icon: <AlertCircle size={14}/> };
    if (qty <= threshold) return { label: `Low Stock: ${qty} left`, color: "#d97706", bg: "#fef3c7", icon: <AlertTriangle size={14}/> };
    return { label: "In Stock", color: "#16a34a", bg: "#dcfce7", icon: <CheckCircle size={14}/> };
  };

  // 👇 ITO ANG INAYOS NATIN PARA TUMUGMA SA DATABASE 👇
  const filteredProducts = products.filter(product => {
    const catName = getCategoryName(product.category_id);
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || catName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Inayos ang logic dito para basahin nang tama ang "All" at ang ID
    const matchesCategory = selectedCategory === 'All' || product.category_id === parseInt(selectedCategory);
    
    return matchesSearch && matchesCategory && product.is_active;
  });

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="titan-wrapper">
      
      {/* HEADER */}
      <header className="titan-header">
        <div className="container header-grid">
          <div className="titan-logo"><h1>JEMARIELL</h1><span>HARDWARE & TRADING</span></div>
          <div className="titan-search">
            <div className="search-group">
              <select className="cat-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="All">All Categories</option>
                {categories.map(cat => (<option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>))}
              </select>
              <input type="text" placeholder="Search for tools..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
              <button><Search size={18} /></button>
            </div>
          </div>
          <div className="header-actions"><Link to="/" className="admin-btn-header"><UserCog size={16} /> Admin Login</Link></div>
        </div>
      </header>

      {/* HERO SLIDER */}
      <section className="titan-hero" style={{backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('${heroImages[currentHeroIndex].url}')`}}>
        <div className="container hero-container">
           <div className="hero-content fade-in-up" key={currentHeroIndex}>
             <h3>OFFICIAL DIGITAL CATALOG</h3>
             <h2>{heroImages[currentHeroIndex].title}</h2>
             <p>{heroImages[currentHeroIndex].subtitle}</p>
             <button className="btn-primary" onClick={() => handlePageChange(1)}>Browse Catalog <ArrowRight size={16}/></button>
           </div>
           <div className="hero-dots">{heroImages.map((_, idx) => (<span key={idx} className={`dot ${currentHeroIndex === idx ? 'active' : ''}`} onClick={() => setCurrentHeroIndex(idx)}></span>))}</div>
        </div>
      </section>

      {/* FEATURES STRIP */}
      <div className="titan-features">
        <div className="container feature-grid">
          <div className="feature-item"><div className="icon-wrap"><Truck size={28}/></div><div className="text"><h4>Nationwide Delivery</h4><p>Available for bulk orders</p></div></div>
          <div className="feature-item"><div className="icon-wrap"><ShieldCheck size={28}/></div><div className="text"><h4>Quality Guaranteed</h4><p>100% Authentic Brands</p></div></div>
          <div className="feature-item"><div className="icon-wrap"><CreditCard size={28}/></div><div className="text"><h4>Flexible Payment</h4><p>Bank Transfer & Checks</p></div></div>
        </div>
      </div>

      {/* --- CATEGORY SLIDER SECTION (UPDATED) --- */}
      <section className="titan-categories-section">
        <div className="container">
          <div className="section-header-row" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px'}}>
             <div className="section-title" style={{margin:0, textAlign:'left'}}><h2>Shop by Category</h2><div className="title-line" style={{left:0, transform:'none'}}></div></div>
             
             {/* Slider Arrows */}
             <div className="slider-controls">
                <button className="slider-btn" onClick={() => scrollCategories('left')}><ChevronLeft size={20}/></button>
                <button className="slider-btn" onClick={() => scrollCategories('right')}><ChevronRight size={20}/></button>
             </div>
          </div>
          
          {/* Scrollable Container */}
          <div className="category-slider-wrapper" ref={categoryScrollRef}>
            {categories.map(cat => {
              const style = getCategoryStyle(cat.category_name);
              return (
                <div 
                  key={cat.category_id} 
                  className={`visual-cat-card ${selectedCategory == cat.category_id ? 'active-cat' : ''}`}
                  onClick={() => setSelectedCategory(cat.category_id)}
                >
                  <div className={`cat-icon-circle ${style.color}`}>
                    {style.icon}
                  </div>
                  <h3>{cat.category_name}</h3>
                  <span className="shop-now-link">View Products <ChevronRight size={14}/></span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* PRODUCT GRID */}
      <main className="titan-main container" id="product-grid-anchor">
        <div className="section-title"><h2>Complete Product List</h2><div className="title-line"></div></div>

        <div className="product-grid">
          {paginatedProducts.length > 0 ? (
            paginatedProducts.map(product => {
              const status = getStockStatus(product.stock_quantity, product.low_stock_threshold);
              return (
                <div key={product.product_id} className="product-card">
                  <div className="img-wrapper" style={{height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', overflow: 'hidden'}}>
                     {/* 👇 ITO ANG INAYOS NATIN PARA LUMABAS ANG PICTURE 👇 */}
                     {product.image_path ? (
                        <img src={product.image_path} alt={product.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                     ) : (
                        <div className="no-image-placeholder"><Box size={48} /></div>
                     )}
                     <div className="hover-actions"><button className="btn-view-specs" onClick={() => setSelectedProduct(product)}>VIEW SPECS</button></div>
                  </div>
                  <div className="info-wrapper">
                    <span className="category">{getCategoryName(product.category_id)}</span>
                    <h3>{product.name}</h3>
                    <div className="stock-box"><span className="stock-pill" style={{background: status.bg, color: status.color}}>{status.icon} {status.label}</span></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state"><h3>No products found.</h3><p>Try adjusting your search or category filter.</p></div>
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="titan-pagination">
             <button className="titan-page-btn" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16}/> Previous</button>
             <span className="page-info">Page {currentPage} of {totalPages}</span>
             <button className="titan-page-btn" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next <ChevronRight size={16}/></button>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="titan-footer">
        <div className="container footer-grid">
           <div className="footer-col">
             <h4>JEMARIELL</h4>
             <p>Your trusted partner for industrial grade tools and hardware supplies.</p>
             <div className="social-row"><a href="#" className="social-icon"><Facebook size={20}/></a><a href="#" className="social-icon"><Instagram size={20}/></a></div>
           </div>
           <div className="footer-col">
             <h4>Contact Us</h4>
             <ul><li><Phone size={16}/> +63 917 123 4567</li><li><Mail size={16}/> sales@jemariell.com</li><li><MapPin size={16}/> 123 Industrial Ave, Manila</li></ul>
           </div>
           <div className="footer-col">
             <h4>Business Hours</h4>
             <ul><li>Mon - Fri: 8:00 AM - 6:00 PM</li><li>Saturday: 9:00 AM - 5:00 PM</li><li>Sunday: Closed</li></ul>
           </div>
        </div>
        <div className="footer-bottom">&copy; 2026 Jemariell General Merchandising. All rights reserved.</div>
      </footer>

      {/* MODAL */}
      {selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content product-modal">
             <div className="modal-header-custom"><h3>Technical Specifications</h3><button onClick={() => setSelectedProduct(null)} className="modal-close-btn"><X size={24} /></button></div>
             <div className="modal-body-custom">
                {/* 👇 ITO ANG INAYOS NATIN PARA LUMABAS ANG PICTURE SA LOOB NG POPUP 👇 */}
                <div className="modal-image-col">
                    {selectedProduct.image_path ? (
                        <img src={selectedProduct.image_path} alt={selectedProduct.name} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px'}} />
                    ) : (
                        <div style={{height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: '8px'}}><Box size={80} color="#cbd5e1" /></div>
                    )}
                </div>
                <div className="modal-details-col">
                    <div className="detail-header"><span className="detail-category">{getCategoryName(selectedProduct.category_id)}</span><h2>{selectedProduct.name}</h2><span className="detail-brand">Brand: {getSupplierInfo(selectedProduct.supplier_id).brand}</span></div>
                    {(() => {
                        const s = getStockStatus(selectedProduct.stock_quantity, selectedProduct.low_stock_threshold);
                        return (<div className="detail-stock-pill" style={{background: s.bg, color: s.color}}>{s.icon} {s.label}</div>)
                    })()}
                    <div className="specs-grid">
                        <div className="spec-item"><Tag size={16} /><div><span>Item Code</span><p>#{selectedProduct.product_id}</p></div></div>
                        <div className="spec-item"><Layers size={16} /><div><span>Unit Type</span><p>{selectedProduct.unit_of_measurement}</p></div></div>
                        <div className="spec-item"><Truck size={16} /><div><span>Supplier</span><p>{getSupplierInfo(selectedProduct.supplier_id).name}</p></div></div>
                        <div className="spec-item"><Clock size={16} /><div><span>Exact Stock</span><p>{selectedProduct.stock_quantity} units</p></div></div>
                    </div>
                    <div className="detail-desc"><h5>Description</h5><p>{selectedProduct.description || "Industrial-grade quality. Contact for specification sheet."}</p></div>
                    
                    {/* 👇 ITO ANG BAGONG FUNCTIONAL BUTTONS 👇 */}
                    <div className="modal-actions">
                        <button 
                            className="action-btn call" 
                            onClick={() => window.location.href = "tel:+639171234567"}
                        >
                            <Phone size={16}/> Call to Order
                        </button>
                        
                        <button 
                            className="action-btn email" 
                            onClick={() => {
                                const email = "sales@jemariell.com";
                                const subject = encodeURIComponent(`Product Inquiry: ${selectedProduct.name}`);
                                const body = encodeURIComponent(`Hello Jemariell General Merchandising,\n\nI would like to request a quote or ask for more details about:\n\nProduct Name: ${selectedProduct.name}\nItem Code: #${selectedProduct.product_id}\n\nPlease let me know the pricing and availability.\n\nThank you!`);
                                window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
                            }}
                        >
                            <Mail size={16}/> Email Quote
                        </button>
                    </div>

                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerLanding;