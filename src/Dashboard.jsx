import React, { useState, useEffect, useMemo } from 'react';
import { io } from "socket.io-client";
import {
  Package, TrendingUp, AlertTriangle, AlertCircle,
  X, ChevronLeft, ChevronRight, Calendar, Filter, Download, FileText, ShoppingCart,
  ChevronsUpDown, ChevronUp, ChevronDown, Search, CheckSquare, Square, Trash2, Plus
} from 'lucide-react';
import axios from 'axios';
import { useTheme } from './ThemeContext';

const socket = io("http://127.0.0.1:5000");

const Dashboard = ({ products, setProducts, stockMovements, setStockMovements, categories, fetchMovements }) => {
  const ITEMS_PER_PAGE = 10;
  const MOVEMENTS_PER_PAGE = 5;
  const { isDark } = useTheme();

  const [filters, setFilters] = useState({ category_id: 'All', status: 'All' });
  const [searchQuery, setSearchQuery] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [movPage, setMovPage] = useState(1);

  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'Add', qty: '' });

  const [isSellOpen, setIsSellOpen] = useState(false);
  const [sellProduct, setSellProduct] = useState(null);
  const [sellQty, setSellQty] = useState('');

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState({ dateRange: 'All Time', category: 'All', product: 'All', include_movements: 'yes' });
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [movSortConfig, setMovSortConfig] = useState({ key: null, direction: null });

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkQtyMap, setBulkQtyMap] = useState({});  // { product_id: qty }
  const [bulkAdjustType, setBulkAdjustType] = useState('Add');

  // Theme helpers
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0f172a' : '#ffffff';

  useEffect(() => {
    socket.on("stock_updated", (updatedProduct) => {
      setProducts((prev) =>
        prev.map((p) => p.product_id === updatedProduct.product_id ? { ...p, ...updatedProduct } : p)
      );
    });
    return () => socket.off("stock_updated");
  }, [setProducts]);

  const getCategoryName = (id) => {
    try {
      return categories?.find(c => c.category_id === id)?.category_name || 'Unknown';
    } catch { return 'Unknown'; }
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key: null, direction: null };
      return { key, direction: 'asc' };
    });
    setInvPage(1);
  };

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) return <ChevronsUpDown size={13} style={{ opacity: 0.35, marginLeft: 4, flexShrink: 0 }} />;
    if (sortConfig.direction === 'asc') return <ChevronUp size={13} style={{ color: '#2563eb', marginLeft: 4, flexShrink: 0 }} />;
    return <ChevronDown size={13} style={{ color: '#2563eb', marginLeft: 4, flexShrink: 0 }} />;
  };

  const handleMovSort = (key) => {
    setMovSortConfig(prev => {
      if (prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return { key: null, direction: null };
    });
    setMovPage(1);
  };

  const MovSortIcon = ({ colKey }) => {
    if (movSortConfig.key !== colKey) return <ChevronsUpDown size={13} style={{ opacity: 0.35, marginLeft: 4, flexShrink: 0 }} />;
    if (movSortConfig.direction === 'asc') return <ChevronUp size={13} style={{ color: '#2563eb', marginLeft: 4, flexShrink: 0 }} />;
    return <ChevronDown size={13} style={{ color: '#2563eb', marginLeft: 4, flexShrink: 0 }} />;
  };

  const movThInner = (label, colKey) => (
    <div onClick={() => handleMovSort(colKey)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {label}<MovSortIcon colKey={colKey} />
    </div>
  );

  const filteredProducts = (products || []).filter(p => {
    try {
      let status = 'In Stock';
      const currentStock = p.stock_quantity || 0;
      if (currentStock === 0) status = 'Out of Stock';
      else if (currentStock <= (p.low_stock_threshold || 0)) status = 'Low Stock';

      const matchCat = filters.category_id === 'All' || p.category_id === parseInt(filters.category_id);
      const matchStat = filters.status === 'All' || status === filters.status;
      const matchSearch = !searchQuery ||
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        getCategoryName(p.category_id).toLowerCase().includes(searchQuery.toLowerCase());

      p.derivedStatus = status;
      return matchCat && matchStat && matchSearch;
    } catch { return false; }
  });

  useEffect(() => { setInvPage(1); }, [searchQuery, filters]);

  const sortedProducts = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredProducts;
    return [...filteredProducts].sort((a, b) => {
      let aVal, bVal;
      try {
        switch (sortConfig.key) {
          case 'product_id': aVal = a.product_id; bVal = b.product_id; break;
          case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); break;
          case 'category_id': aVal = getCategoryName(a.category_id).toLowerCase(); bVal = getCategoryName(b.category_id).toLowerCase(); break;
          case 'price': aVal = a.price || 0; bVal = b.price || 0; break;
          case 'initial_inventory': aVal = a.initial_inventory || 0; bVal = b.initial_inventory || 0; break;
          case 'unit_of_measurement': aVal = (a.unit_of_measurement || '').toLowerCase(); bVal = (b.unit_of_measurement || '').toLowerCase(); break;
          case 'sold_qty': aVal = a.sold_qty || 0; bVal = b.sold_qty || 0; break;
          case 'stock_quantity': aVal = a.stock_quantity || 0; bVal = b.stock_quantity || 0; break;
          case 'final_cost': aVal = (a.sold_qty || 0) * (a.price || 0); bVal = (b.sold_qty || 0) * (b.price || 0); break;
          case 'status':
            const order = { 'Out of Stock': 0, 'Low Stock': 1, 'In Stock': 2 };
            aVal = order[a.derivedStatus] ?? 2; bVal = order[b.derivedStatus] ?? 2; break;
          default: return 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      } catch { return 0; }
    });
  }, [filteredProducts, sortConfig]);

  const totalInvPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice((invPage - 1) * ITEMS_PER_PAGE, invPage * ITEMS_PER_PAGE);

  const totalMovPages = Math.ceil((stockMovements || []).length / MOVEMENTS_PER_PAGE);

  const sortedMovements = useMemo(() => {
    const movements = stockMovements || [];

    // Priority sort helper: products with Out of Stock first, then Low Stock, then In Stock
    const getProductPriority = (productId) => {
      const p = (products || []).find(x => x.product_id === productId);
      if (!p) return 3;
      const qty = p.stock_quantity || 0;
      if (qty === 0) return 0;                              // OUT OF STOCK — highest priority
      if (qty <= (p.low_stock_threshold || 0)) return 1;   // LOW STOCK
      return 2;                                             // IN STOCK
    };

    if (!movSortConfig.key || !movSortConfig.direction) {
      // Default: sort by stock priority
      return [...movements].sort((a, b) => getProductPriority(a.product_id) - getProductPriority(b.product_id));
    }
    return [...movements].sort((a, b) => {
      let aVal, bVal;
      try {
        switch (movSortConfig.key) {
          case 'movement_id': aVal = a.movement_id || 0; bVal = b.movement_id || 0; break;
          case 'product':
            aVal = ((products || []).find(p => p.product_id === a.product_id)?.name || '').toLowerCase();
            bVal = ((products || []).find(p => p.product_id === b.product_id)?.name || '').toLowerCase(); break;
          case 'type': aVal = (a.movement_type || '').toLowerCase(); bVal = (b.movement_type || '').toLowerCase(); break;
          case 'qty': aVal = a.quantity_change || 0; bVal = b.quantity_change || 0; break;
          case 'date': aVal = new Date(a.updated_at || a.created_at || 0).getTime(); bVal = new Date(b.updated_at || b.created_at || 0).getTime(); break;
          default: return 0;
        }
        if (aVal < bVal) return movSortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return movSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      } catch { return 0; }
    });
  }, [stockMovements, movSortConfig, products]);

  const paginatedMovements = sortedMovements.slice((movPage - 1) * MOVEMENTS_PER_PAGE, movPage * MOVEMENTS_PER_PAGE);

  const totalValue = (products || []).reduce((acc, p) => {
    try { return acc + ((p.sold_qty || 0) * (p.price || 0)); } catch { return acc; }
  }, 0);
  const totalInStock = (products || []).reduce((acc, p) => {
    try { return acc + (p.stock_quantity || 0); } catch { return acc; }
  }, 0);
  const lowStockCount = (products || []).filter(p => {
    try { return (p.stock_quantity || 0) <= (p.low_stock_threshold || 0) && (p.stock_quantity || 0) > 0; } catch { return false; }
  }).length;
  const outOfStockCount = (products || []).filter(p => {
    try { return (p.stock_quantity || 0) === 0; } catch { return false; }
  }).length;
  const stockAlerts = (products || []).filter(p => {
    try { return (p.stock_quantity || 0) <= (p.low_stock_threshold || 0); } catch { return false; }
  });

  const filteredReportProducts = (products || []).filter(p => {
    try {
      const matchCat = reportFilters.category === 'All' || p.category_id === parseInt(reportFilters.category);
      const matchProd = reportFilters.product === 'All' || p.product_id === parseInt(reportFilters.product);
      return matchCat && matchProd;
    } catch { return false; }
  });

  const reportData = {
    totalRevenue: filteredReportProducts.reduce((acc, p) => acc + ((p.sold_qty || 0) * (p.price || 0)), 0),
    totalUnitsSold: filteredReportProducts.reduce((acc, p) => acc + (p.sold_qty || 0), 0),
    totalProfit: filteredReportProducts.reduce((acc, p) => acc + ((p.sold_qty || 0) * (p.price || 0) * 0.3), 0),
    inventoryValue: filteredReportProducts.reduce((acc, p) => acc + ((p.stock_quantity || 0) * (p.price || 0)), 0)
  };

  const categorySales = (categories || []).map(cat => {
    const catProducts = filteredReportProducts.filter(p => p.category_id === cat.category_id);
    const sales = catProducts.reduce((acc, p) => acc + ((p.sold_qty || 0) * (p.price || 0)), 0);
    return { name: cat.category_name, sales, id: cat.category_id };
  }).filter(c => c.sales > 0 || reportFilters.category === 'All');

  const openAdjustModal = (product) => {
    if (!product) return;
    setSelectedProduct(product);
    setAdjustForm({ type: 'Add', qty: '' });
    setIsAdjustOpen(true);
  };

  const handleConfirmAdjust = async () => {
    try {
      const qty = parseInt(adjustForm.qty);
      if (!qty || qty <= 0) return alert("Enter a valid whole number quantity.");
      if (!selectedProduct?.product_id) return alert("No product selected.");

      socket.emit('adjust_stock', { id: selectedProduct.product_id, qty, type: adjustForm.type });

      const updatedProducts = (products || []).map(p => {
        if (p.product_id === selectedProduct.product_id) {
          const currentStock = p.stock_quantity || 0;
          const newQty = adjustForm.type === 'Add' ? currentStock + qty : Math.max(0, currentStock - qty);
          return { ...p, stock_quantity: newQty };
        }
        return p;
      });
      setProducts(updatedProducts);
      if (fetchMovements) await fetchMovements();
      setIsAdjustOpen(false);
    } catch (err) {
      console.error("Adjust stock error:", err);
      alert("Failed to adjust stock. Please try again.");
    }
  };

  const openSellModal = (product) => {
    if (!product) return;
    setSellProduct(product);
    setSellQty('');
    setIsSellOpen(true);
  };

  const handleConfirmSell = async () => {
    try {
      const qty = parseInt(sellQty);
      if (!qty || qty <= 0) return alert("Enter a valid quantity.");
      if (!sellProduct?.product_id) return alert("No product selected.");
      if (qty > (sellProduct.stock_quantity || 0)) return alert("Not enough stock!");

      const res = await fetch(`http://127.0.0.1:5000/api/products/${sellProduct.product_id}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return alert(errData.message || "Sale failed. Server error.");
      }

      const result = await res.json();
      if (!result.success) return alert(result.message || "Sale failed.");

      const newStock = (sellProduct.stock_quantity || 0) - qty;
      const newSold = (sellProduct.sold_qty || 0) + qty;

      setProducts((products || []).map(p =>
        p.product_id === sellProduct.product_id
          ? { ...p, stock_quantity: newStock, sold_qty: newSold, final_cost: newSold * (p.price || 0) }
          : p
      ));
      if (fetchMovements) await fetchMovements();
      setIsSellOpen(false);
    } catch (err) {
      console.error("Sell error:", err);
      alert("Connection error. Sale not saved. Please check your server connection.");
    }
  };

  const currentPageIds = paginatedProducts.map(p => p.product_id);
  const allCurrentSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkAction = (action) => {
    if (selectedIds.length === 0) return alert("Select at least one product first.");
    setBulkAction(action);
    setBulkQtyMap({});
    setBulkAdjustType('Add');
    setIsBulkModalOpen(true);
  };

  const handleConfirmBulk = async () => {
    try {
      if (bulkAction === 'delete') {
        if (!window.confirm(`Delete ${selectedIds.length} product(s)? This cannot be undone.`)) return;
        // Actually delete from DB
        for (const id of selectedIds) {
          try {
            await fetch(`http://127.0.0.1:5000/api/products/${id}`, { method: 'DELETE' });
          } catch (err) {
            console.error(`Failed to delete product ${id}:`, err);
          }
        }
        setProducts((products || []).filter(p => !selectedIds.includes(p.product_id)));
        setSelectedIds([]);
        setIsBulkModalOpen(false);
        return;
      }

      // Validate that every selected item has a qty entered
      const missing = selectedIds.filter(id => !bulkQtyMap[id] || parseInt(bulkQtyMap[id]) <= 0);
      if (missing.length > 0) {
        return alert(`Please enter a valid quantity (> 0) for all ${missing.length} item(s).`);
      }

      if (bulkAction === 'add') {
        const updated = (products || []).map(p => {
          if (selectedIds.includes(p.product_id)) {
            const qty = parseInt(bulkQtyMap[p.product_id] || 0);
            const newQty = bulkAdjustType === 'Add'
              ? (p.stock_quantity || 0) + qty
              : Math.max(0, (p.stock_quantity || 0) - qty);
            socket.emit('adjust_stock', { id: p.product_id, qty, type: bulkAdjustType });
            return { ...p, stock_quantity: newQty };
          }
          return p;
        });
        setProducts(updated);
        if (fetchMovements) await fetchMovements();
      }

      if (bulkAction === 'sell') {
        let errors = [];
        const updated = [...(products || [])];
        for (const id of selectedIds) {
          const product = updated.find(p => p.product_id === id);
          if (!product) continue;
          const qty = parseInt(bulkQtyMap[id] || 0);
          if (qty > (product.stock_quantity || 0)) {
            errors.push(`"${product.name}" only has ${product.stock_quantity} in stock.`);
            continue;
          }
          try {
            const res = await fetch(`http://127.0.0.1:5000/api/products/${id}/sell`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ qty })
            });
            const result = await res.json();
            if (result.success) {
              const idx = updated.findIndex(p => p.product_id === id);
              if (idx !== -1) {
                updated[idx] = {
                  ...updated[idx],
                  stock_quantity: (updated[idx].stock_quantity || 0) - qty,
                  sold_qty: (updated[idx].sold_qty || 0) + qty,
                };
              }
            } else {
              errors.push(`Failed to sell "${product.name}": ${result.message || 'Unknown error'}`);
            }
          } catch (err) {
            errors.push(`Failed to sell "${product?.name || 'Unknown'}": Connection error.`);
          }
        }
        setProducts(updated);
        if (fetchMovements) await fetchMovements();
        if (errors.length > 0) alert("Some items had issues:\n" + errors.join('\n'));
      }

      setSelectedIds([]);
      setIsBulkModalOpen(false);
    } catch (err) {
      console.error("Bulk action error:", err);
      alert("Bulk action failed. Please try again.");
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const res = await fetch('http://127.0.0.1:5000/api/report/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: reportFilters.category,
          product: reportFilters.product,
          dateRange: reportFilters.dateRange,
          include_movements: reportFilters.include_movements === 'yes',
          generated_by: currentUser.admin_user || 'Admin',
        }),
      });
      if (!res.ok) throw new Error('Server error generating PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jemariell_stock_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate PDF. Make sure Flask is running and reportlab is installed.\n\nInstall: pip install reportlab');
      console.error(err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const thStyle = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };
  const thInner = (label, colKey) => (
    <div onClick={() => handleSort(colKey)} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
      {label}<SortIcon colKey={colKey} />
    </div>
  );

  // STAT CARD component — centered, polished
  const StatCard = ({ icon, label, value, colorClass }) => (
    <div className="stat-card" style={{
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: '12px',
      padding: '28px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: '12px',
      flex: 1,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'background 0.2s'
    }}>
      <div className={`stat-icon ${colorClass}`} style={{ margin: '0 auto' }}>{icon}</div>
      <div>
        <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: textSecondary }}>{label}</p>
        <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: textPrimary, lineHeight: 1 }}>{value}</h3>
      </div>
    </div>
  );

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
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Current: {item.stock_quantity || 0} | Reorder at: {item.low_stock_threshold}</div>
                </div>
                <span className={`status-pill ${(item.stock_quantity || 0) === 0 ? 'out-of-stock' : 'low-stock'}`}>
                  {(item.stock_quantity || 0) === 0 ? 'Out of Stock' : 'Low Stock'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STATS — centered cards */}
      <section style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard icon={<Package />} label="Total Products" value={products.length} colorClass="blue" />
        <StatCard icon={<TrendingUp />} label="Total Value" value={`₱${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} colorClass="green" />
        <StatCard icon={<Package />} label="Total In Stock Items" value={totalInStock.toLocaleString()} colorClass="blue" />
        <StatCard icon={<AlertTriangle />} label="Low Stock" value={lowStockCount} colorClass="yellow" />
        <StatCard icon={<AlertCircle />} label="Out of Stock" value={outOfStockCount} colorClass="red" />
      </section>

      {/* FILTER + SEARCH BAR */}
      <div className="filter-bar-wrapper" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '8px', padding: '8px 14px', flex: '1', minWidth: '200px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '0.875rem', color: textPrimary, background: 'transparent', width: '100%' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={14} color="#94a3b8" />
            </button>
          )}
        </div>

        <select className="filter-dropdown" value={filters.category_id} onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}>
          <option value="All">All Categories</option>
          {(categories || []).map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </select>

        <select className="filter-dropdown" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="All">All Status</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>

        <button
          onClick={() => setIsReportOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: textPrimary, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
        >
          <FileText size={16} color="#475569" /> Reports
        </button>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: isDark ? '#1e3a5f' : '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', marginBottom: '12px' }}>
          <span style={{ fontWeight: 600, color: '#0369a1', fontSize: '0.875rem' }}>
            {selectedIds.length} product{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button onClick={() => handleBulkAction('add')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
              <Plus size={14} /> Bulk Adjust
            </button>
            <button onClick={() => handleBulkAction('sell')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
              <ShoppingCart size={14} /> Bulk Sell
            </button>
            <button onClick={() => handleBulkAction('delete')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
              <Trash2 size={14} /> Delete Selected
            </button>
            <button onClick={() => setSelectedIds([])} style={{ padding: '7px 12px', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', color: textSecondary, fontSize: '0.8rem' }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* INVENTORY TABLE */}
      <div className="table-card" style={{ marginBottom: '2rem', background: cardBg, border: `1px solid ${cardBorder}` }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {allCurrentSelected ? <CheckSquare size={17} color="#2563eb" /> : <Square size={17} color="#94a3b8" />}
                </button>
              </th>
              <th style={thStyle}>{thInner('ID', 'product_id')}</th>
              <th style={thStyle}>{thInner('PRODUCT NAME', 'name')}</th>
              <th style={thStyle}>{thInner('CATEGORY', 'category_id')}</th>
              <th style={thStyle}>{thInner('UNIT PRICE', 'price')}</th>
              <th style={thStyle}>{thInner('INITIAL', 'initial_inventory')}</th>
              <th style={thStyle}>{thInner('UNIT', 'unit_of_measurement')}</th>
              <th style={thStyle}>{thInner('SOLD', 'sold_qty')}</th>
              <th style={thStyle}>{thInner('STOCK', 'stock_quantity')}</th>
              <th style={thStyle}>{thInner('FINAL COST', 'final_cost')}</th>
              <th style={thStyle}>{thInner('STATUS', 'status')}</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Search size={32} color="#cbd5e1" />
                    <span style={{ fontWeight: 600, color: '#64748b', fontSize: '1rem' }}>
                      {searchQuery ? `No products found for "${searchQuery}"` : 'No products match the selected filters.'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Try adjusting your search or filter criteria.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedProducts.map(p => {
                const computedFinalCost = (p.sold_qty || 0) * (p.price || 0);
                const isSelected = selectedIds.includes(p.product_id);
                return (
                  <tr key={p.product_id} style={{ background: isSelected ? (isDark ? '#1e3a5f' : '#eff6ff') : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => toggleSelectOne(p.product_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        {isSelected ? <CheckSquare size={16} color="#2563eb" /> : <Square size={16} color="#cbd5e1" />}
                      </button>
                    </td>
                    <td>{p.product_id}</td>
                    <td><strong>{p.name}</strong></td>
                    <td>{getCategoryName(p.category_id)}</td>
                    <td>₱{(p.price || 0).toFixed(2)}</td>
                    <td>{Math.floor(p.initial_inventory || 0)}</td>
                    <td>{p.unit_of_measurement || 'pc'}</td>
                    <td>{Math.floor(p.sold_qty || 0)}</td>
                    <td style={{ fontWeight: 700, color: textPrimary }}>{Math.floor(p.stock_quantity || 0)}</td>
                    <td>₱{computedFinalCost.toFixed(2)}</td>
                    <td><span className={`status-pill ${(p.derivedStatus || 'in-stock').toLowerCase().replace(/\s/g, '-')}`}>{p.derivedStatus}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-adjust" onClick={() => openAdjustModal(p)}>Adjust</button>
                        <button
                          className="btn-sell"
                          onClick={() => openSellModal(p)}
                          disabled={(p.stock_quantity || 0) === 0}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: (p.stock_quantity || 0) === 0 ? '#f1f5f9' : '#2563eb',
                            color: (p.stock_quantity || 0) === 0 ? '#94a3b8' : 'white',
                            border: 'none', padding: '6px 12px', borderRadius: '4px',
                            cursor: (p.stock_quantity || 0) === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem', fontWeight: 500
                          }}
                        >
                          <ShoppingCart size={13} /> Sell
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalInvPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '15px', alignItems: 'center', gap: '15px', borderTop: `1px solid ${cardBorder}` }}>
            <span style={{ fontSize: '0.875rem', color: textSecondary }}>Page {invPage} of {totalInvPages} ({sortedProducts.length} items)</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setInvPage(p => p - 1)} disabled={invPage === 1} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${cardBorder}`, background: invPage === 1 ? '#f1f5f9' : cardBg, cursor: invPage === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={16} /></button>
              <button onClick={() => setInvPage(p => p + 1)} disabled={invPage === totalInvPages} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${cardBorder}`, background: invPage === totalInvPages ? '#f1f5f9' : cardBg, cursor: invPage === totalInvPages ? 'not-allowed' : 'pointer' }}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* MOVEMENTS TABLE */}
      <div className="table-card" style={{ marginBottom: '2rem', background: cardBg, border: `1px solid ${cardBorder}` }}>
        <div style={{ padding: '15px 20px', borderBottom: `1px solid ${cardBorder}`, fontWeight: 600, color: textPrimary }}>Recent Stock Movements</div>
        <table>
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }}>{movThInner('Movement ID', 'movement_id')}</th>
              <th style={{ cursor: 'pointer' }}>{movThInner('Product', 'product')}</th>
              <th style={{ cursor: 'pointer' }}>{movThInner('Type', 'type')}</th>
              <th style={{ cursor: 'pointer' }}>{movThInner('Qty', 'qty')}</th>
              <th style={{ cursor: 'pointer' }}>{movThInner('Date', 'date')}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMovements.map(m => {
              const matchedProduct = (products || []).find(p => p.product_id === m.product_id);
              return (
                <tr key={m.movement_id}>
                  <td>{m.movement_id}</td>
                  <td>{matchedProduct?.name || 'Unknown'}</td>
                  <td><span className={`badge-type ${(m.movement_type || '').toLowerCase()}`}>{m.movement_type}</span></td>
                  <td className={m.quantity_change > 0 ? 'text-green' : 'text-red'}>
                    {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                  </td>
                  <td>{m.updated_at ? new Date(m.updated_at).toLocaleString() : m.created_at ? new Date(m.created_at).toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalMovPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '15px', alignItems: 'center', gap: '15px', borderTop: `1px solid ${cardBorder}` }}>
            <span style={{ fontSize: '0.875rem', color: textSecondary }}>Page {movPage} of {totalMovPages}</span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button onClick={() => setMovPage(p => p - 1)} disabled={movPage === 1} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${cardBorder}`, background: movPage === 1 ? '#f1f5f9' : cardBg, cursor: movPage === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={16} /></button>
              <button onClick={() => setMovPage(p => p + 1)} disabled={movPage === totalMovPages} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${cardBorder}`, background: movPage === totalMovPages ? '#f1f5f9' : cardBg, cursor: movPage === totalMovPages ? 'not-allowed' : 'pointer' }}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* REPORT MODAL */}
      {isReportOpen && (
        <div className="modal-overlay">
          <div className="modal-content report-modal" style={{ maxWidth: '900px', width: '95vw', background: cardBg }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${cardBorder}`, flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={20} color={textPrimary} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: textPrimary }}>Stock &amp; Sales Report</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: inputBg, border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '6px 10px' }}>
                  <Calendar size={13} color="#64748b" />
                  <select style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', color: textPrimary, cursor: 'pointer' }} value={reportFilters.dateRange} onChange={(e) => setReportFilters({ ...reportFilters, dateRange: e.target.value })}>
                    <option>All Time</option><option>This Month</option><option>This Year</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: inputBg, border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '6px 10px' }}>
                  <Filter size={13} color="#64748b" />
                  <select style={{ border: 'none', background: 'transparent', fontSize: '0.8rem', color: textPrimary, cursor: 'pointer' }} value={reportFilters.category} onChange={(e) => setReportFilters({ ...reportFilters, category: e.target.value })}>
                    <option value="All">All Categories</option>
                    {(categories || []).map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: isDownloadingPdf ? '#475569' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: isDownloadingPdf ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  {isDownloadingPdf ? <>⏳ Generating...</> : <><Download size={13} /> PDF</>}
                </button>
                <button
                  onClick={() => setIsReportOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '70vh' }}>
              <div className="report-card">
                <div className="report-card-header header-blue"><span>SUMMARY</span><span>VALUE</span></div>
                <div className="report-row summary-row"><span className="summary-label">Total Sales Revenue</span><span className="summary-value">₱{reportData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="report-row summary-row"><span className="summary-label">Total Units Sold</span><span className="summary-value">{reportData.totalUnitsSold} units</span></div>
                <div className="report-row summary-row"><span className="summary-label">Total Profit (Est. 30%)</span><span className="summary-value">₱{reportData.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
              </div>
              <div className="report-card">
                <div className="report-card-header header-green"><span>PRODUCT</span><span>SOLD</span><span>REVENUE</span><span>STOCK</span><span>STATUS</span></div>
                {filteredReportProducts.map(p => {
                  const rev = (p.sold_qty || 0) * (p.price || 0);
                  return (
                    <div className="report-row product-grid-row" key={p.product_id}>
                      <span className="product-name">{p.name}</span>
                      <span>{p.sold_qty || 0}</span>
                      <span>₱{rev.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      <span style={{ fontWeight: 600 }}>{Math.floor(p.stock_quantity || 0)}</span>
                      <span className={`status-pill ${(p.derivedStatus || 'in-stock').toLowerCase().replace(/\s/g, '-')}`} style={{ width: 'max-content' }}>
                        {p.derivedStatus || 'In Stock'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="report-card">
                <div className="report-card-header header-purple"><span>CATEGORY</span><span>TOTAL SALES</span></div>
                {categorySales.map(c => (
                  <div className="report-row category-row" key={c.id}>
                    <span className="cat-name">{c.name}</span>
                    <span className="cat-val">₱{c.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
          <div className="modal-content" style={{ maxWidth: '400px', background: cardBg }}>
            <div className="modal-header">
              <h3 style={{ color: textPrimary }}>Adjust — {selectedProduct.name}</h3>
              <button onClick={() => setIsAdjustOpen(false)} style={{ background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#475569" />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ color: textPrimary }}>Current Stock: <strong>{Math.floor(selectedProduct.stock_quantity || 0)}</strong></p>
              <div className="form-group">
                <label>Type</label>
                <select value={adjustForm.type} onChange={e => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                  <option value="Add">Add</option>
                  <option value="Deduct">Deduct</option>
                </select>
              </div>
              <div className="form-group">
                <label>Qty (whole numbers only)</label>
                <input type="number" min="1" step="1" value={adjustForm.qty} onChange={e => setAdjustForm({ ...adjustForm, qty: Math.floor(Number(e.target.value)) || '' })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="confirm-btn" style={{ width: '100%', background: '#2563eb' }} onClick={handleConfirmAdjust}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* SELL MODAL */}
      {isSellOpen && sellProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', background: cardBg }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: textPrimary }}>
                <ShoppingCart size={18} color="#2563eb" /> Sell — {sellProduct.name}
              </h3>
              <button onClick={() => setIsSellOpen(false)} style={{ background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#475569" />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ background: isDark ? '#0f172a' : '#f8fafc', borderRadius: '8px', padding: '14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.75rem', color: textSecondary, marginBottom: '4px' }}>AVAILABLE STOCK</div><div style={{ fontWeight: 700, fontSize: '1.25rem', color: textPrimary }}>{Math.floor(sellProduct.stock_quantity || 0)}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.75rem', color: textSecondary, marginBottom: '4px' }}>UNIT PRICE</div><div style={{ fontWeight: 700, fontSize: '1.25rem', color: textPrimary }}>₱{(sellProduct.price || 0).toFixed(2)}</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.75rem', color: textSecondary, marginBottom: '4px' }}>ALREADY SOLD</div><div style={{ fontWeight: 700, fontSize: '1.25rem', color: '#2563eb' }}>{sellProduct.sold_qty || 0}</div></div>
              </div>
              <div className="form-group">
                <label>Quantity to Sell (whole numbers only)</label>
                <input type="number" min="1" step="1" max={sellProduct.stock_quantity} value={sellQty} onChange={e => setSellQty(Math.floor(Number(e.target.value)) || '')} placeholder={`Max: ${Math.floor(sellProduct.stock_quantity || 0)}`} style={{ width: '100%', padding: '10px', border: `1px solid ${cardBorder}`, borderRadius: '6px', fontSize: '1rem', background: inputBg, color: textPrimary }} />
              </div>
              {sellQty > 0 && (
                <div style={{ background: isDark ? '#1e3a5f' : '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: 500 }}>Sale Total:</span>
                  <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '1.1rem' }}>₱{(parseInt(sellQty || 0) * (sellProduct.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={handleConfirmSell} style={{ width: '100%', background: '#2563eb', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Confirm Sale</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ACTION MODAL */}
      {isBulkModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', background: cardBg }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: textPrimary }}>
                {bulkAction === 'add' && <><Plus size={18} color={textPrimary} /> Bulk Adjust Stock</>}
                {bulkAction === 'sell' && <><ShoppingCart size={18} color="#2563eb" /> Bulk Sell</>}
                {bulkAction === 'delete' && <><Trash2 size={18} color="#ef4444" /> Delete Selected</>}
              </h3>
              <button onClick={() => setIsBulkModalOpen(false)} style={{ background: '#f1f5f9', border: `1px solid ${cardBorder}`, borderRadius: '6px', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="#475569" />
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              {bulkAction === 'delete' && (
                <p style={{ color: '#ef4444', fontWeight: 500, fontSize: '0.9rem' }}>
                  ⚠️ This will permanently delete {selectedIds.length} product(s). Are you sure?
                </p>
              )}

              {bulkAction === 'add' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.85rem', color: textSecondary }}>Adjustment Type</label>
                  <select value={bulkAdjustType} onChange={e => setBulkAdjustType(e.target.value)}
                    style={{ display: 'block', width: '100%', padding: '8px', marginTop: '4px', borderRadius: '6px', border: `1px solid ${cardBorder}`, background: cardBg, color: textPrimary }}>
                    <option value="Add">Add Stock</option>
                    <option value="Deduct">Deduct Stock</option>
                  </select>
                </div>
              )}

              {(bulkAction === 'add' || bulkAction === 'sell') && (
                <>
                  <p style={{ fontSize: '0.8rem', color: textSecondary, marginBottom: '10px' }}>
                    Enter a separate quantity for each selected item:
                  </p>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedIds.map(id => {
                      const product = (products || []).find(p => p.product_id === id);
                      if (!product) return null;
                      const stockStatus = (product.stock_quantity || 0) === 0
                        ? 'out-of-stock'
                        : (product.stock_quantity || 0) <= (product.low_stock_threshold || 0)
                        ? 'low-stock' : 'in-stock';
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: isDark ? '#0f172a' : '#f8fafc', borderRadius: '8px', border: `1px solid ${cardBorder}` }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: textPrimary, fontSize: '0.875rem' }}>{product.name}</div>
                            <div style={{ fontSize: '0.75rem', color: textSecondary }}>
                              Stock: {product.stock_quantity || 0}
                              <span className={`status-pill ${stockStatus}`} style={{ marginLeft: '8px', fontSize: '0.7rem', padding: '2px 6px' }}>
                                {stockStatus === 'out-of-stock' ? 'Out of Stock' : stockStatus === 'low-stock' ? 'Low Stock' : 'In Stock'}
                              </span>
                            </div>
                          </div>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Qty"
                            value={bulkQtyMap[id] || ''}
                            onChange={e => {
                              const v = Math.floor(Number(e.target.value)) || '';
                              setBulkQtyMap(prev => ({ ...prev, [id]: v > 0 ? v : '' }));
                            }}
                            style={{ width: '80px', padding: '7px', borderRadius: '6px', border: `1px solid ${cardBorder}`, background: cardBg, color: textPrimary, textAlign: 'center', fontSize: '0.9rem' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={handleConfirmBulk}
                style={{ background: bulkAction === 'delete' ? '#ef4444' : '#2563eb', color: 'white', padding: '10px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                {bulkAction === 'delete' ? 'Yes, Delete' : bulkAction === 'sell' ? 'Confirm Bulk Sale' : 'Apply Adjustment'}
              </button>
              <button onClick={() => setIsBulkModalOpen(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;