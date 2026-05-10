import React, { useState, useEffect } from 'react';
import { User, Bell, List, Plus, Trash2, X, Wrench, Users as UsersIcon, Moon, Sun } from 'lucide-react';
import axios from 'axios';
import { useTheme } from './ThemeContext';
import API_BASE from './Baseuri';

const Settings = ({ categories, setCategories }) => {
  const { isDark, toggleTheme } = useTheme();

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0f172a' : '#ffffff';
  const inputBorder = isDark ? '#334155' : '#cbd5e1';

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const [adminProfile, setAdminProfile] = useState({
    admin_id: null,
    name: '',
    email: '',
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        const user = JSON.parse(stored);
        if (!user) throw new Error('Null user');
        setAdminProfile({
          admin_id: user.admin_id || null,
          name: user.admin_user || user.name || 'Unknown User',
          email: user.email || '',
        });
      }
    } catch (e) {
      console.error('Failed to parse currentUser from localStorage', e);
      setAdminProfile({ admin_id: null, name: 'Unknown User', email: '' });
    }
  }, []);

  const [users, setUsers] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState('add');

  const initialUserForm = { admin_id: null, admin_user: '', email: '', password: '', status: 'Active' };
  const [userForm, setUserForm] = useState(initialUserForm);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(API_BASE + '/api/users');
      if (res.data?.success) setUsers(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = (newCategory || '').trim();
    if (!trimmed) return alert("Category name cannot be empty");
    try {
      const res = await axios.post(API_BASE + '/api/categories', { category_name: trimmed });
      if (res.data?.success) {
        setCategories(prev => [...(prev || []), res.data.data]);
        setNewCategory('');
        setIsCategoryModalOpen(false);
        alert("Category added successfully!");
      } else {
        alert("Error: " + (res.data?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error(error);
      if (error.response?.status === 409) {
        alert("A category with this name already exists.");
      } else if (error.response) {
        alert("Server error: " + (error.response.data?.message || error.response.statusText));
      } else {
        alert("Connection failed. Check server.");
      }
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!id) return alert("Invalid category.");
    if (window.confirm("Are you sure you want to delete this category? Make sure no products are using it!")) {
      try {
        const res = await axios.delete(`${API_BASE}/api/categories/${id}`);
        if (res.data?.success) {
          setCategories(prev => (prev || []).filter(c => c.category_id !== id));
        } else {
          alert("Error: " + (res.data?.message || 'Unknown error'));
        }
      } catch (error) {
        console.error(error);
        if (error.response?.status === 409 || error.response?.status === 400) {
          alert("Cannot delete category. A product might currently be using it.");
        } else if (error.response) {
          alert("Server error: " + (error.response.data?.message || 'Unknown error'));
        } else {
          alert("Connection failed. Check server.");
        }
      }
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const name = (adminProfile.name || '').trim();
    const email = (adminProfile.email || '').trim();
    if (!name) return alert("Name cannot be empty.");
    if (!email || !/\S+@\S+\.\S+/.test(email)) return alert("Please enter a valid email address.");

    if (!adminProfile.admin_id) {
      try {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
          const user = JSON.parse(stored);
          const updated = { ...user, admin_user: name, email };
          localStorage.setItem('currentUser', JSON.stringify(updated));
        }
        setIsProfileModalOpen(false);
        alert("Profile updated locally!");
      } catch (e) {
        console.error(e);
        alert("Failed to update profile locally.");
      }
      return;
    }

    try {
      const res = await axios.put(`${API_BASE}/api/users/${adminProfile.admin_id}`, {
        admin_user: name,
        email,
        status: 'Active'
      });

      if (res.data?.success) {
        try {
          const stored = localStorage.getItem('currentUser');
          if (stored) {
            const user = JSON.parse(stored);
            const updated = { ...user, admin_user: name, email };
            localStorage.setItem('currentUser', JSON.stringify(updated));
          }
        } catch {}
        setIsProfileModalOpen(false);
        alert("Profile updated successfully!");
      } else {
        alert("Error: " + (res.data?.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        alert("This email is already in use by another account.");
      } else if (err.response) {
        alert("Server error: " + (err.response.data?.message || err.response.statusText));
      } else {
        alert("Connection failed. Check server.");
      }
    }
  };

  const handleOpenAddUser = () => {
    setUserForm(initialUserForm);
    setUserModalMode('add');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    if (!user) return;
    setUserForm({
      admin_id: user.admin_id,
      admin_user: user.admin_user || '',
      email: user.email || '',
      password: '',
      status: user.status || 'Active'
    });
    setUserModalMode('edit');
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    const username = (userForm.admin_user || '').trim();
    const email = (userForm.email || '').trim();
    if (!username) return alert("Username cannot be empty.");
    if (!email || !/\S+@\S+\.\S+/.test(email)) return alert("Please enter a valid email address.");

    try {
      if (userModalMode === 'add') {
        if (!userForm.password) return alert("Password is required for new users.");
        if (userForm.password.length < 6) return alert("Password must be at least 6 characters.");
        const res = await axios.post(API_BASE + '/api/users', { ...userForm, admin_user: username, email });
        if (res.data?.success) {
          setUsers(prev => [...prev, res.data.data]);
          setIsUserModalOpen(false);
          alert("User successfully created!");
        } else {
          alert("Error: " + (res.data?.message || 'Unknown error'));
        }
      } else {
        const payload = { ...userForm, admin_user: username, email };
        if (!payload.password) delete payload.password; // don't send blank password
        const res = await axios.put(`${API_BASE}/api/users/${userForm.admin_id}`, payload);
        if (res.data?.success) {
          setUsers(prev => prev.map(u => u.admin_id === userForm.admin_id ? res.data.data : u));
          setIsUserModalOpen(false);
          alert("User successfully updated!");
        } else {
          alert("Error: " + (res.data?.message || 'Unknown error'));
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        alert("A user with this email or username already exists.");
      } else if (err.response) {
        alert("Server error: " + (err.response.data?.message || err.response.statusText));
      } else {
        alert("Connection failed. Check server.");
      }
    }
  };

  const handleArchiveUser = async (user) => {
    if (!user?.admin_id) return alert("Invalid user.");
    if (window.confirm(`Are you sure you want to archive ${user.admin_user}? They will no longer be able to access the system.`)) {
      try {
        const archivedUser = { ...user, status: 'Inactive' };
        const res = await axios.put(`${API_BASE}/api/users/${user.admin_id}`, archivedUser);
        if (res.data?.success) {
          setUsers(prev => prev.map(u => u.admin_id === user.admin_id ? res.data.data : u));
          alert("User has been successfully archived!");
        } else {
          alert("Error: " + (res.data?.message || 'Unknown error'));
        }
      } catch (error) {
        console.error(error);
        if (error.response) {
          alert("Server error: " + (error.response.data?.message || error.response.statusText));
        } else {
          alert("Failed to archive user. Check server connection.");
        }
      }
    }
  };

  const avatarInitial = adminProfile.name ? adminProfile.name.charAt(0).toUpperCase() : 'A';

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, boxSizing: 'border-box' };

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h2 style={{ color: textPrimary }}>Settings</h2>
          <p style={{ color: textSecondary }}>Manage system configurations, users, and preferences</p>
        </div>
      </div>

      {/* TOP GRID */}
      <div className="settings-grid">

        {/* CARD 1: ACCOUNT */}
        <div className="settings-card" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="card-header"><User className="card-icon blue" size={20} /><h3 style={{ color: textPrimary }}>Account Settings</h3></div>
          <div className="card-body">
            <div className="profile-summary">
              <div className="large-avatar">{avatarInitial}</div>
              <div>
                <h4 style={{ color: textPrimary }}>{adminProfile.name || 'Loading...'}</h4>
                <p style={{ color: textSecondary }}>{adminProfile.email || '—'}</p>

              </div>
            </div>
            <button className="btn-outline" style={{ color: textPrimary, borderColor: cardBorder }} onClick={() => setIsProfileModalOpen(true)}>Edit Profile</button>
          </div>
        </div>

        {/* CARD 2: CATEGORIES */}
        <div className="settings-card" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="card-header"><List className="card-icon purple" size={20} /><h3 style={{ color: textPrimary }}>Category Management</h3></div>
          <div className="card-body">
            <p className="helper-text" style={{ color: textSecondary }}>Manage product categories used in dropdowns.</p>
            <div className="category-list">
              {(categories || []).map(c => (
                <div key={c.category_id} className="category-item" style={{ color: textPrimary }}>
                  <span>{c.category_name}</span>
                  <button className="icon-btn delete" onClick={() => handleDeleteCategory(c.category_id)}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button className="btn-dashed" style={{ color: textPrimary, borderColor: inputBorder }} onClick={() => setIsCategoryModalOpen(true)}><Plus size={16} /> Add New Category</button>
          </div>
        </div>

        {/* CARD 3: PREFERENCES (dark/light mode toggle here) */}
        <div className="settings-card" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="card-header"><Bell className="card-icon yellow" size={20} /><h3 style={{ color: textPrimary }}>System Preferences</h3></div>
          <div className="card-body">
            {/* DARK / LIGHT MODE TOGGLE */}
            <div className="toggle-row" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${cardBorder}` }}>
              <div>
                <strong style={{ color: textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isDark ? <Moon size={16} color="#94a3b8" /> : <Sun size={16} color="#f59e0b" />}
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </strong>
                <p style={{ color: textSecondary, margin: '4px 0 0', fontSize: '0.85rem' }}>Toggle interface theme</p>
              </div>
              <button
                onClick={toggleTheme}
                style={{
                  width: '52px', height: '28px', borderRadius: '14px',
                  background: isDark ? '#2563eb' : '#e2e8f0',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s', flexShrink: 0
                }}
                aria-label="Toggle theme"
              >
                <span style={{
                  position: 'absolute', top: '3px',
                  left: isDark ? '26px' : '3px',
                  width: '22px', height: '22px',
                  borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            <div className="toggle-row">
              <div>
                <strong style={{ color: textPrimary }}>Low Stock Alerts</strong>
                <p style={{ color: textSecondary }}>Notify when stock reaches threshold</p>
              </div>
              <label className="switch"><input type="checkbox" defaultChecked /><span className="slider round"></span></label>
            </div>
            <div className="toggle-row">
              <div>
                <strong style={{ color: textPrimary }}>Email Reports</strong>
                <p style={{ color: textSecondary }}>Receive weekly PDF summaries</p>
              </div>
              <label className="switch"><input type="checkbox" /><span className="slider round"></span></label>
            </div>
          </div>
        </div>
      </div>

      {/* USER MANAGEMENT SECTION */}
      <div className="user-management-section" style={{ marginTop: '40px', background: cardBg, padding: '24px', borderRadius: '12px', border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${cardBorder}`, paddingBottom: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <UsersIcon size={24} color={textPrimary} />
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: textPrimary }}>System Users</h3>
          </div>
          <button onClick={handleOpenAddUser} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            <Plus size={16} /> Add User
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(users || []).map(user => (
            <div key={user.admin_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '8px', border: `1px solid ${cardBorder}`, background: isDark ? '#0f172a' : '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isDark ? '#1e293b' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textSecondary }}><User size={20} /></div>
                <div>
                  <div style={{ fontWeight: 'bold', color: textPrimary }}>{user.admin_user}</div>
                  <div style={{ color: textSecondary, fontSize: '0.85rem' }}>{user.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

                <span style={{ padding: '4px 12px', borderRadius: '20px', background: user.status === 'Active' ? '#2563eb' : '#cbd5e1', color: 'white', fontSize: '0.75rem', fontWeight: 'bold' }}>{user.status}</span>
                <button onClick={() => handleOpenEditUser(user)} style={{ background: isDark ? '#1e293b' : 'white', border: `1px solid ${cardBorder}`, padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', color: textPrimary }}>Edit</button>
                {user.status === 'Active' && (
                  <button onClick={() => handleArchiveUser(user)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>Archive</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: EDIT PROFILE */}
      {isProfileModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{ maxWidth: '700px', padding: '30px', background: cardBg }}>
            <div className="branded-modal-header" style={{ borderBottom: `1px solid ${cardBorder}`, paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: textPrimary }}>JEMARIELL GENERAL MERCHANDISING INC</h3>
              <Wrench size={20} color={textSecondary} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, color: textPrimary }}>EDIT ADMIN PROFILE</h4>
              <button onClick={() => setIsProfileModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color={textSecondary} /></button>
            </div>
            <div className="form-section-container">
              <div style={{ fontWeight: 'bold', color: textPrimary, marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem' }}>Basic Information</div>
              <div className="form-group">
                <label style={{ color: textSecondary }}>Full Name *</label>
                <input style={inputStyle} value={adminProfile.name} onChange={(e) => setAdminProfile({ ...adminProfile, name: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label style={{ color: textSecondary }}>Email Address *</label>
                  <input style={inputStyle} value={adminProfile.email} onChange={(e) => setAdminProfile({ ...adminProfile, email: e.target.value })} />
                </div>

              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${cardBorder}` }}>
              <button onClick={() => setIsProfileModalOpen(false)} style={{ background: isDark ? '#1e293b' : 'white', border: `1px solid ${cardBorder}`, padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: textPrimary }}>Cancel</button>
              <button onClick={handleUpdateProfile} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD CATEGORY */}
      {isCategoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', padding: '30px', background: cardBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, color: textPrimary }}>ADD NEW CATEGORY</h4>
              <button onClick={() => setIsCategoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color={textSecondary} /></button>
            </div>
            <div className="form-group">
              <label style={{ color: textSecondary }}>Category Name *</label>
              <input style={inputStyle} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Electrical" autoFocus />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setIsCategoryModalOpen(false)} style={{ background: isDark ? '#1e293b' : 'white', border: `1px solid ${cardBorder}`, padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: textPrimary }}>Cancel</button>
              <button onClick={handleAddCategory} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Add Category</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT USER — role dropdown REMOVED per client request */}
      {isUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{ maxWidth: '700px', padding: '30px', background: cardBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${cardBorder}`, paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: textPrimary }}>JEMARIELL GENERAL MERCHANDISING INC</h3>
              <Wrench size={20} color={textSecondary} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: textPrimary }}>{userModalMode === 'add' ? 'CREATE NEW USER' : 'EDIT USER DETAILS'}</h4>
              <button onClick={() => setIsUserModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color={textSecondary} /></button>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', color: textPrimary, marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem' }}>User Information</div>
              <div className="form-row" style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: textSecondary }}>Username / Login ID</label>
                  <input style={inputStyle} value={userForm.admin_user} onChange={e => setUserForm({ ...userForm, admin_user: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: textSecondary }}>Email Address</label>
                  <input style={inputStyle} value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: textSecondary }}>
                  Password {userModalMode === 'edit' && "(Leave blank to keep current)"}
                </label>
                <input type="password" style={inputStyle} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder={userModalMode === 'edit' ? "••••••••" : "Enter temporary password"} />
              </div>
              <div style={{ fontWeight: 'bold', color: textPrimary, marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem' }}>Account</div>
              <div className="form-group" style={{ marginBottom: '20px', maxWidth: '260px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: textSecondary }}>Account Status</label>
                <select style={inputStyle} value={userForm.status} onChange={e => setUserForm({ ...userForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive (Suspended)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${cardBorder}` }}>
              <button onClick={() => setIsUserModalOpen(false)} style={{ background: isDark ? '#1e293b' : 'white', border: `1px solid ${cardBorder}`, padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: textPrimary }}>Cancel</button>
              <button onClick={handleSaveUser} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;