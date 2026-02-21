import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Lock, Mail, Loader2, Eye, EyeOff, ShoppingCart, BarChart3, Users, Package, Shield, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  { icon: ShoppingCart, label: 'Point of Sale', desc: 'Fast & intuitive POS system' },
  { icon: BarChart3, label: 'Sales Analytics', desc: 'Real-time reports & insights' },
  { icon: Package, label: 'Inventory Control', desc: 'Stock tracking & alerts' },
  { icon: Users, label: 'HR Management', desc: 'Staff, attendance & payroll' },
];

const Login = () => {
  const [email, setEmail] = useState('admin@pos.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      login(token, user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ===== LEFT PANEL — Branding ===== */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex-col justify-between p-12">

        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [0, 45, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, -30, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            className="absolute -bottom-40 -left-20 w-[500px] h-[500px] bg-teal-500/8 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-400/5 rounded-full blur-2xl"
          />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.06) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }} />
        </div>

        {/* Top — Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <span className="text-xl font-black text-white">A</span>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">AByte POS</p>
            <p className="text-emerald-400/70 text-xs">Enterprise Edition</p>
          </div>
        </motion.div>

        {/* Center — Hero */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-6">
              <Zap size={14} className="text-emerald-400" />
              <span className="text-emerald-300 text-xs font-semibold">Complete Business Solution</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              Run Your Business<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Smarter & Faster
              </span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-md">
              Everything you need to manage sales, inventory, staff, and accounting — all in one powerful platform.
            </p>
          </motion.div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3 mt-10">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-colors"
                >
                  <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3">
                    <Icon size={18} className="text-emerald-400" />
                  </div>
                  <p className="text-white font-semibold text-sm">{f.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom — Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="relative z-10 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-500/60" />
            <span className="text-slate-500 text-xs">Secure & Encrypted</span>
          </div>
          <span className="text-slate-600 text-xs">v1.0.0 &copy; 2025 AByte</span>
        </motion.div>
      </div>

      {/* ===== RIGHT PANEL — Form ===== */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 relative overflow-hidden">

        {/* Subtle background for right panel */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-100/40 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile logo (shows only on small screens) */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-lg font-black text-white">A</span>
            </div>
            <span className="text-xl font-bold text-gray-800">AByte POS</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900">Welcome back</h2>
            <p className="text-gray-500 mt-1.5 text-sm">Sign in to your account to continue</p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm flex items-start gap-3"
            >
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              </div>
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors duration-200"
                  size={18}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-emerald-500 outline-none transition-all duration-200 text-gray-800 placeholder-gray-400 text-sm"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors duration-200"
                  size={18}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-emerald-500 outline-none transition-all duration-200 text-gray-800 placeholder-gray-400 text-sm"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-sm tracking-wide"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                </>
              )}
            </motion.button>

          </form>

          {/* Bottom note */}
          <p className="text-center text-xs text-gray-400 mt-8">
            Protected by enterprise-grade security &nbsp;&middot;&nbsp; AByte POS &copy; 2025
          </p>
        </motion.div>
      </div>

    </div>
  );
};

export default Login;
