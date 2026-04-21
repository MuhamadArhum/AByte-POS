import { useState, type FormEvent } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Lock, User, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Settings() {
  const { admin } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const initials = admin?.name
    ? admin.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : admin?.email?.[0]?.toUpperCase() ?? 'A';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/change-password', { new_password: password });
      setMsg('Password changed successfully');
      setPassword(''); setConfirm('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-7">
        <h2 className="text-xl font-bold text-slate-800">Settings</h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage your admin account</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-emerald-100 flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-base">{admin?.name || 'Admin'}</p>
            <p className="text-slate-500 text-sm">{admin?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
              <User size={11} />
              Super Admin
            </span>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
            <Lock size={16} className="text-slate-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Change Password</h3>
            <p className="text-slate-400 text-xs">Update your admin password</p>
          </div>
        </div>

        {msg && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm mb-4">
            <CheckCircle size={15} className="flex-shrink-0" />
            {msg}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Min 6 characters"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-slate-700"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
            <div className="relative">
              <input
                type={showCf ? 'text' : 'password'}
                placeholder="Repeat password"
                className={`w-full border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-slate-700 ${
                  confirm && confirm !== password ? 'border-red-300' : 'border-slate-300'
                }`}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowCf(!showCf)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirm && confirm !== password && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition mt-1 shadow-sm shadow-emerald-100"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Updating...
              </span>
            ) : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
