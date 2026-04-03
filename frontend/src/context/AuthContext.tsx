import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────
interface User {
  user_id:   number;
  username?: string;
  name:      string;
  email:     string;
  role?:     string;
  role_name: string;
}

// Kept for invoice template compatibility
export interface TenantConfig {
  company_name?:         string;
  logo_url?:             string | null;
  primary_color?:        string;
  currency_symbol?:      string;
  currency_code?:        string;
  timezone?:             string;
  tax_name?:             string;
  tax_rate?:             number;
  ntn?:                  string | null;
  strn?:                 string | null;
  is_tax_exempt?:        boolean;
  receipt_header?:       string | null;
  receipt_footer?:       string | null;
  show_tax_on_receipt?:  boolean;
  show_logo_on_receipt?: boolean;
  show_ntn_on_receipt?:  boolean;
  plan?:                 string;
  modules_allowed?:      string[];
  modules_enabled?:      string[];
}

interface AuthContextType {
  user:            User | null;
  token:           string | null;
  tenantConfig:    TenantConfig | null;
  login:           (token: string, user: User, permissions: string[] | null) => void;
  logout:          () => void;
  setTenantConfig: (config: TenantConfig) => void;
  isAuthenticated: boolean;
  isLoading:       boolean;
  permissions:     string[] | null;
  hasPermission:   (moduleKey: string) => boolean;
  hasModule:       (moduleName: string) => boolean;
  currentPlan:     string;
  currencySymbol:  string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,         setUser]         = useState<User | null>(null);
  const [token,        setToken]        = useState<string | null>(null);
  const [permissions,  setPermissions]  = useState<string[] | null>(null);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);

  // Restore session from localStorage on app load
  useEffect(() => {
    const storedToken       = localStorage.getItem('token');
    const storedUser        = localStorage.getItem('user');
    const storedPermissions = localStorage.getItem('permissions');
    const storedConfig      = localStorage.getItem('tenantConfig');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setPermissions(storedPermissions === 'null' ? null : storedPermissions ? JSON.parse(storedPermissions) : []);
      if (storedConfig) {
        try { setTenantConfig(JSON.parse(storedConfig)); } catch {}
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: User, newPermissions: string[] | null) => {
    localStorage.setItem('token',       newToken);
    localStorage.setItem('user',        JSON.stringify(newUser));
    localStorage.setItem('permissions', JSON.stringify(newPermissions));
    setToken(newToken);
    setUser(newUser);
    setPermissions(newPermissions);
  }, []);

  const logout = useCallback(() => {
    // Revoke token server-side (fire-and-forget — don't block logout on network failure)
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${storedToken}` },
      }).catch(() => { /* ignore network errors during logout */ });
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    localStorage.removeItem('tenantConfig');
    setToken(null);
    setUser(null);
    setPermissions(null);
    setTenantConfig(null);
  }, []);

  const saveTenantConfig = useCallback((config: TenantConfig) => {
    localStorage.setItem('tenantConfig', JSON.stringify(config));
    setTenantConfig(config);
  }, []);

  // RBAC: check individual module key
  const hasPermission = useCallback((moduleKey: string): boolean => {
    if (permissions === null) return true; // Admin: full access
    return permissions.includes(moduleKey);
  }, [permissions]);

  // Single-client mode: all modules available
  const hasModule = useCallback((_moduleName: string): boolean => true, []);

  const currentPlan    = 'enterprise';
  const currencySymbol = tenantConfig?.currency_symbol || 'Rs.';

  const value = useMemo(() => ({
    user,
    token,
    tenantConfig,
    login,
    logout,
    setTenantConfig: saveTenantConfig,
    isAuthenticated: !!token,
    isLoading,
    permissions,
    hasPermission,
    hasModule,
    currentPlan,
    currencySymbol,
  }), [user, token, tenantConfig, login, logout, saveTenantConfig, isLoading, permissions, hasPermission, hasModule, currencySymbol]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
