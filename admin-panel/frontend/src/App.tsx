import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ActivityPage from './pages/Activity';
import Settings from './pages/Settings';

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  return admin ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { admin } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={admin ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/clients"   element={<Clients />} />
              <Route path="/activity"  element={<ActivityPage />} />
              <Route path="/settings"  element={<Settings />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
