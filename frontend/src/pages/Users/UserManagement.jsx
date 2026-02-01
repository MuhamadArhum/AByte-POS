import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to load users');
    }
  };

  const loadRoles = async () => {
    try {
      const res = await api.get('/users/roles');
      setRoles(res.data);
    } catch (err) {
      // silent
    }
  };

  const openForm = (user = null) => {
    setEditUser(user);
    setForm(user ? { name: user.name, email: user.email, password: '', role_id: roles.find(r => r.role_name === user.role_name)?.role_id || '' } : { name: '', email: '', password: '', role_id: '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/users/${editUser.user_id}`, form);
        toast.success('User updated');
      } else {
        await api.post('/users', form);
        toast.success('User created');
      }
      setShowForm(false);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => openForm()}>
          <FiPlus /> Add User
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`role-badge ${u.role_name.toLowerCase()}`}>{u.role_name}</span></td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn-icon" onClick={() => openForm(u)}><FiEdit2 /></button>
                  <button className="btn-icon danger" onClick={() => handleDelete(u.user_id, u.name)}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editUser ? 'Edit User' : 'Add User'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editUser}
                  minLength={8}
                  placeholder="Min 8 characters"
                />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
                  <option value="">Select Role</option>
                  {roles.map((r) => (
                    <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
