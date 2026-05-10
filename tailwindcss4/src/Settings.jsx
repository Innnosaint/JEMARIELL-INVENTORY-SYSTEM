import React, { useState, useEffect } from 'react';
import { User, Bell, List, Plus, Trash2, X, Wrench, Users as UsersIcon } from 'lucide-react';
import axios from 'axios';

const Settings = ({ categories, setCategories }) => {
  // --- STATES: PROFILE & CATEGORIES ---
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const [adminProfile, setAdminProfile] = useState({
    name: 'Admin User',
    email: 'admin@jemariell.com',
    role: 'Super Admin'
  });

  // --- STATES: USER MANAGEMENT (LIVE) ---
  const [users, setUsers] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState('add'); 

  const initialUserForm = { admin_id: null, admin_user: '', email: '', password: '', role: 'Staff', status: 'Active' };
  const [userForm, setUserForm] = useState(initialUserForm);

  // Fetch Users from Database on Load
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  // --- HANDLERS: CATEGORIES & PROFILE ---
  const handleAddCategory = async () => {
    if (!newCategory) return alert("Category name cannot be empty");
    
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/categories', {
        category_name: newCategory
      });
      
      if (res.data.success) {
        setCategories([...categories, res.data.data]); 
        setNewCategory('');
        setIsCategoryModalOpen(false);
        alert("Category added successfully!");
      } else {
        alert("Error: " + res.data.message);
      }
    } catch (error) {
      console.error(error);
      alert("Connection failed. Check server.");
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm("Are you sure you want to delete this category? Make sure no products are using it!")) {
      try {
        const res = await axios.delete(`http://127.0.0.1:5000/api/categories/${id}`);
        if (res.data.success) {
          setCategories(categories.filter(c => c.category_id !== id));
        } else {
          alert("Error: " + res.data.message);
        }
      } catch (error) {
        console.error(error);
        alert("Cannot delete category. A product might currently be using it.");
      }
    }
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    setIsProfileModalOpen(false);
    alert("Profile updated successfully!");
  };

  // --- HANDLERS: USER MANAGEMENT ---
  const handleOpenAddUser = () => {
    setUserForm(initialUserForm);
    setUserModalMode('add');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setUserForm({
      admin_id: user.admin_id,
      admin_user: user.admin_user,
      email: user.email,
      password: user.password || '',
      role: user.role,
      status: user.status
    });
    setUserModalMode('edit');
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.admin_user || !userForm.email) return alert("Username and Email are required");

    try {
      if (userModalMode === 'add') {
        if (!userForm.password) return alert("Password is required for new users");
        const res = await axios.post('http://127.0.0.1:5000/api/users', userForm);
        if (res.data.success) {
          setUsers([...users, res.data.data]);
          setIsUserModalOpen(false);
          alert("User successfully created!");
        }
      } else {
        const res = await axios.put(`http://127.0.0.1:5000/api/users/${userForm.admin_id}`, userForm);
        if (res.data.success) {
          setUsers(users.map(u => u.admin_id === userForm.admin_id ? res.data.data : u));
          setIsUserModalOpen(false);
          alert("User successfully updated!");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Connection failed. Check server.");
    }
  };

  const handleArchiveUser = async (user) => {
    if (window.confirm(`Are you sure you want to archive ${user.admin_user}? They will no longer be able to access the system.`)) {
      try {
        const archivedUser = { ...user, status: 'Inactive' };
        const res = await axios.put(`http://127.0.0.1:5000/api/users/${user.admin_id}`, archivedUser);
        
        if (res.data.success) {
          setUsers(users.map(u => u.admin_id === user.admin_id ? res.data.data : u));
          alert("User has been successfully archived!");
        } else {
          alert("Error: " + res.data.message);
        }
      } catch (error) {
        console.error(error);
        alert("Failed to archive user. Check server connection.");
      }
    }
  };

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Manage system configurations, users, and preferences</p>
        </div>
      </div>

      {/* TOP GRID: SYSTEM SETTINGS */}
      <div className="settings-grid">
        {/* CARD 1: PROFILE */}
        <div className="settings-card">
          <div className="card-header"><User className="card-icon blue" size={20} /><h3>Account Settings</h3></div>
          <div className="card-body">
            <div className="profile-summary">
              <div className="large-avatar">A</div>
              <div><h4>{adminProfile.name}</h4><p>{adminProfile.email}</p><span className="badge-role">{adminProfile.role}</span></div>
            </div>
            <button className="btn-outline" onClick={() => setIsProfileModalOpen(true)}>Edit Profile</button>
          </div>
        </div>

        {/* CARD 2: CATEGORIES */}
        <div className="settings-card">
          <div className="card-header"><List className="card-icon purple" size={20} /><h3>Category Management</h3></div>
          <div className="card-body">
            <p className="helper-text">Manage product categories used in dropdowns.</p>
            <div className="category-list">
              {categories.map(c => (
                <div key={c.category_id} className="category-item">
                  <span>{c.category_name}</span>
                  <button className="icon-btn delete" onClick={() => handleDeleteCategory(c.category_id)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button className="btn-dashed" onClick={() => setIsCategoryModalOpen(true)}><Plus size={16} /> Add New Category</button>
          </div>
        </div>

        {/* CARD 3: PREFERENCES */}
        <div className="settings-card">
          <div className="card-header"><Bell className="card-icon yellow" size={20} /><h3>System Preferences</h3></div>
          <div className="card-body">
            <div className="toggle-row">
              <div><strong>Low Stock Alerts</strong><p>Notify when stock reaches threshold</p></div>
              <label className="switch"><input type="checkbox" defaultChecked /><span className="slider round"></span></label>
            </div>
            <div className="toggle-row">
              <div><strong>Email Reports</strong><p>Receive weekly PDF summaries</p></div>
              <label className="switch"><input type="checkbox" /><span className="slider round"></span></label>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: USER MANAGEMENT */}
      <div className="user-management-section" style={{ marginTop: '40px', background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="um-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UsersIcon size={24} color="#0f172a" />
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>System Users</h3>
          </div>
          <button onClick={handleOpenAddUser} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <Plus size={16} /> Add User
          </button>
        </div>

        <div className="user-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {users.map(user => (
            <div key={user.admin_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9', background: '#fafafa' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><User size={20}/></div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{user.admin_user}</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{user.email}</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'white', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: '600' }}>{user.role}</span>
                <span style={{ padding: '4px 12px', borderRadius: '20px', background: user.status === 'Active' ? '#10b981' : '#cbd5e1', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}>{user.status}</span>
                
                <button onClick={() => handleOpenEditUser(user)} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', color: '#0f172a' }}>Edit</button>
                
                {user.status === 'Active' && (
                  <button onClick={() => handleArchiveUser(user)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Archive</button>
                )}
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* =================================================== */}
      {/* MODALS */}
      {/* =================================================== */}
      
      {/* MODAL 1: EDIT PROFILE */}
      {isProfileModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{maxWidth: '700px', padding: '30px'}}>
            <div className="branded-modal-header"><h3 className="company-title">JEMARIELL GENERAL MERCHANDISING INC</h3><div className="icon-circle"><Wrench size={20} /></div></div>
            <div className="modal-actions-row"><h4 className="modal-title">EDIT ADMIN PROFILE</h4><button onClick={() => setIsProfileModalOpen(false)} className="close-btn"><X size={20}/></button></div>
            <div className="form-section-container">
              <div className="section-title-bar">Basic Information</div>
              <div className="form-group"><label>Full Name <span className="req">*</span></label><input className="styled-input" value={adminProfile.name} onChange={(e) => setAdminProfile({...adminProfile, name: e.target.value})} /></div>
              <div className="form-row">
                <div className="form-group"><label>Email Address <span className="req">*</span></label><input className="styled-input" value={adminProfile.email} onChange={(e) => setAdminProfile({...adminProfile, email: e.target.value})} /></div>
                <div className="form-group"><label>Role</label><input className="styled-input" value={adminProfile.role} disabled style={{background: '#f8fafc', color: '#94a3b8'}} /></div>
              </div>
            </div>
            <div className="modal-footer-custom"><button className="btn-cancel" onClick={() => setIsProfileModalOpen(false)}>Cancel</button><button className="btn-save" onClick={handleUpdateProfile}>Save Changes</button></div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CATEGORY */}
      {isCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px', padding: '30px'}}>
            <div className="branded-modal-header"><h3 className="company-title" style={{fontSize: '1rem'}}>JEMARIELL GENERAL MERCHANDISING</h3></div>
            <div className="modal-actions-row"><h4 className="modal-title">ADD NEW CATEGORY</h4><button onClick={() => setIsCategoryModalOpen(false)} className="close-btn"><X size={18}/></button></div>
            <div className="form-section-container"><div className="form-group"><label>Category Name <span className="req">*</span></label><input className="styled-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Electrical" autoFocus /></div></div>
            <div className="modal-footer-custom"><button className="btn-cancel" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button><button className="btn-save" onClick={handleAddCategory}>Add Category</button></div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD/EDIT SYSTEM USER */}
      {isUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{maxWidth: '700px', padding: '30px'}}>
            <div className="branded-modal-header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
               <h3 style={{ margin: 0, color: '#0f172a' }}>JEMARIELL GENERAL MERCHANDISING INC</h3>
               <Wrench size={20} color="#64748b" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{userModalMode === 'add' ? 'CREATE NEW USER' : 'EDIT USER DETAILS'}</h4>
              <button onClick={() => setIsUserModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24}/></button>
            </div>
            <div className="form-section-container">
              <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem' }}>User Information</div>
              <div className="form-row" style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                 <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#64748b' }}>Username / Login ID</label>
                    <input style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={userForm.admin_user} onChange={e => setUserForm({...userForm, admin_user: e.target.value})} />
                 </div>
                 <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#64748b' }}>Email Address</label>
                    <input style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                 </div>
              </div>
              <div className="form-group" style={{ marginBottom: '25px' }}>
                 <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#64748b' }}>Password {userModalMode === 'edit' && "(Leave blank to keep current)"}</label>
                 <input type="password" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder={userModalMode === 'edit' ? "••••••••" : "Enter temporary password"} />
              </div>
              <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem' }}>Role & Permissions</div>
              <div className="form-row" style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                 <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#64748b' }}>System Role</label>
                    <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                       <option value="Admin">Admin (Full Access)</option>
                       <option value="Manager">Manager (Inventory & Reports)</option>
                       <option value="Cashier">Cashier (Point of Sale)</option>
                       <option value="Staff">Staff (View Only)</option>
                    </select>
                 </div>
                 <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#64748b' }}>Account Status</label>
                    <select style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={userForm.status} onChange={e => setUserForm({...userForm, status: e.target.value})}>
                       <option value="Active">Active</option>
                       <option value="Inactive">Inactive (Suspended)</option>
                    </select>
                 </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
               <button onClick={() => setIsUserModalOpen(false)} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
               <button onClick={handleSaveUser} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save User</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;