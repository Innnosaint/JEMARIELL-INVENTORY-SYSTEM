import React, { useState, useEffect } from 'react';
import { User, Plus, X, Users as UsersIcon, Wrench } from 'lucide-react';
import axios from 'axios';
import { useTheme } from './ThemeContext';
import API_BASE from './Baseuri';

const Users = () => {
  const { isDark } = useTheme();
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0f172a' : '#ffffff';
  const inputBorder = isDark ? '#334155' : '#cbd5e1';

  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');

  const initialForm = { admin_id: null, admin_user: '', email: '', password: '', status: 'Active' };
  const [userForm, setUserForm] = useState(initialForm);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(API_BASE + '/api/users');
      if (res.data?.success) {
        setUsers(res.data.data || []);
      } else {
        console.warn("Fetch users returned unsuccessful:", res.data);
        setUsers([]);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    }
  };

  const handleOpenAdd = () => {
    setUserForm(initialForm);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    if (!user) return;
    setUserForm({
      admin_id: user.admin_id,
      admin_user: user.admin_user || '',
      email: user.email || '',
      password: '',
      status: user.status || 'Active'
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    const username = (userForm.admin_user || '').trim();
    const email = (userForm.email || '').trim();

    if (!username) return alert("Username cannot be empty.");
    if (!email || !/\S+@\S+\.\S+/.test(email)) return alert("Please enter a valid email address.");

    try {
      if (modalMode === 'add') {
        if (!userForm.password) return alert("Password is required for new users.");
        if (userForm.password.length < 6) return alert("Password must be at least 6 characters.");

        const res = await axios.post(API_BASE + '/api/users', { ...userForm, admin_user: username, email });
        if (res.data?.success) {
          setUsers(prev => [...prev, res.data.data]);
          setIsModalOpen(false);
          alert("User successfully created!");
        } else {
          alert("Error: " + (res.data?.message || 'Unknown error'));
        }
      } else {
        if (!userForm.admin_id) return alert("Invalid user ID.");
        const payload = { ...userForm, admin_user: username, email };
        if (!payload.password) delete payload.password;

        const res = await axios.put(`${API_BASE}/api/users/${userForm.admin_id}`, payload);
        if (res.data?.success) {
          setUsers(prev => prev.map(u => u.admin_id === userForm.admin_id ? res.data.data : u));
          setIsModalOpen(false);
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
        alert("Connection failed. Cannot reach the server.");
      }
    }
  };

  const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, boxSizing: 'border-box' };

  return (
    <div className="user-management-section">

      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: textPrimary }}>
            <UsersIcon size={28} />
            <h2 style={{ margin: 0 }}>User Management</h2>
          </div>
          <p style={{ color: textSecondary, margin: '4px 0 0 0' }}>Manage admin access and accounts</p>
        </div>
        <button
          onClick={handleOpenAdd}
          style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <User size={18} /> Add User
        </button>
      </div>

      {/* USER CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {(users || []).map(user => (
          <div key={user.admin_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cardBg, padding: '20px', borderRadius: '12px', border: `1px solid ${cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: isDark ? '#0f172a' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textSecondary }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 'bold', color: textPrimary, fontSize: '1.1rem' }}>{user.admin_user}</div>
                <div style={{ color: textSecondary, fontSize: '0.85rem' }}>{user.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

              <span style={{ padding: '6px 14px', borderRadius: '20px', background: user.status === 'Active' ? '#2563eb' : (isDark ? '#1e293b' : '#f1f5f9'), color: user.status === 'Active' ? 'white' : textSecondary, fontSize: '0.8rem', fontWeight: '600' }}>
                {user.status}
              </span>
              <button
                onClick={() => handleOpenEdit(user)}
                style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                + EDIT USER
              </button>
              <button
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                ARCHIVE
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: ADD / EDIT USER */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{ maxWidth: '700px', padding: '30px', background: cardBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${cardBorder}`, paddingBottom: '15px', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: textPrimary }}>JEMARIELL GENERAL MERCHANDISING INC.</h3>
              <Wrench size={20} color={textSecondary} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: textPrimary }}>{modalMode === 'add' ? 'CREATE NEW USER' : 'EDIT USER DETAILS'}</h4>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color={textSecondary} /></button>
            </div>

            <div>
              <div style={{ fontWeight: 'bold', color: textPrimary, marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>User Information</div>
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
                  Password {modalMode === 'edit' && "(Leave blank to keep current)"}
                </label>
                <input type="password" style={inputStyle} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder={modalMode === 'edit' ? "••••••••" : "Enter temporary password"} />
              </div>

              <div style={{ fontWeight: 'bold', color: textPrimary, marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Account</div>
              <div className="form-group" style={{ marginBottom: '20px', maxWidth: '260px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: textSecondary }}>Account Status</label>
                <select style={inputStyle} value={userForm.status} onChange={e => setUserForm({ ...userForm, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive (Suspended)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${cardBorder}` }}>
              <button onClick={() => setIsModalOpen(false)} style={{ background: isDark ? '#0f172a' : 'white', border: `1px solid ${cardBorder}`, padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: textPrimary }}>Cancel</button>
              <button onClick={handleSaveUser} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;