import { useState, FormEvent } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { admin } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6)  { setError('Min 6 characters'); return; }
    try {
      await api.post('/auth/change-password', { new_password: password });
      setMsg('Password changed successfully');
      setPassword(''); setConfirm('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="p-6 max-w-md">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
        <h3 className="font-medium text-gray-900 mb-3">Admin Info</h3>
        <p className="text-sm text-gray-600">Name: <span className="font-medium">{admin?.name}</span></p>
        <p className="text-sm text-gray-600 mt-1">Email: <span className="font-medium">{admin?.email}</span></p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-medium text-gray-900 mb-4">Change Password</h3>
        {msg   && <div className="bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-2 text-sm mb-3">{msg}</div>}
        {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password" placeholder="New password"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={password} onChange={e => setPassword(e.target.value)} required
          />
          <input
            type="password" placeholder="Confirm password"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={confirm} onChange={e => setConfirm(e.target.value)} required
          />
          <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700">
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
