import React, { useState, useEffect } from 'react';
import { User, Plus, X, Users as UsersIcon, Wrench } from 'lucide-react';
import axios from 'axios';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); 

  // Form State - Tumutugma na ito sa "admins" table mo sa Supabase!
  const initialForm = { admin_id: null, admin_user: '', email: '', password: '', role: 'Staff', status: 'Active' };
  const [userForm, setUserForm] = useState(initialForm);

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

  // --- HANDLERS ---
  const handleOpenAdd = () => {
    setUserForm(initialForm);
    setModalMode('add');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setUserForm({
      admin_id: user.admin_id,
      admin_user: user.admin_user,
      email: user.email,
      password: user.password || '', // Hidden usually, but needed for edit
      role: user.role,
      status: user.status
    });
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.admin_user || !userForm.email) return alert("Username and Email are required");

    try {
      if (modalMode === 'add') {
        if (!userForm.password) return alert("Password is required for new users");
        const res = await axios.post('http://127.0.0.1:5000/api/users', userForm);
        if (res.data.success) {
          setUsers([...users, res.data.data]);
          setIsModalOpen(false);
          alert("User successfully created!");
        }
      } else {
        const res = await axios.put(`http://127.0.0.1:5000/api/users/${userForm.admin_id}`, userForm);
        if (res.data.success) {
          setUsers(users.map(u => u.admin_id === userForm.admin_id ? res.data.data : u));
          setIsModalOpen(false);
          alert("User successfully updated!");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Connection failed. Hindi nakausap ang server.");
    }
  };

  return (
    <div className="user-management-section">
      
      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
            <UsersIcon size={28} />
            <h2 style={{ margin: 0 }}>User Management</h2>
          </div>
          <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Manage admin access and staff roles</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          <User size={18} /> Add User
        </button>
      </div>

      {/* USER CARDS LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {users.map(user => (
          <div key={user.admin_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <User size={24}/>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1.1rem' }}>{user.admin_user}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{user.email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ padding: '6px 14px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: '600', color: '#334155' }}>
                {user.role}
              </span>
              <span style={{ padding: '6px 14px', borderRadius: '20px', background: user.status === 'Active' ? '#0f172a' : '#f1f5f9', color: user.status === 'Active' ? 'white' : '#64748b', fontSize: '0.8rem', fontWeight: '600' }}>
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

      {/* =================================================== */}
      {/* MODAL: ADD / EDIT USER */}
      {/* =================================================== */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large" style={{maxWidth: '700px', padding: '30px'}}>
            
            <div className="branded-modal-header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
               <h3 style={{ margin: 0, color: '#0f172a' }}>JEMARIELL GENERAL MERCHANDISING INC</h3>
               <Wrench size={20} color="#64748b" />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{modalMode === 'add' ? 'CREATE NEW USER' : 'EDIT USER DETAILS'}</h4>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24}/></button>
            </div>

            <div className="form-section-container">
              <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>User Information</div>
              
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
                 <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#64748b' }}>Password {modalMode === 'edit' && "(Leave blank to keep current)"}</label>
                 <input type="password" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder={modalMode === 'edit' ? "••••••••" : "Enter temporary password"} />
              </div>

              <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Role & Permissions</div>
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
               <button onClick={() => setIsModalOpen(false)} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
               <button onClick={handleSaveUser} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save User</button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Users;