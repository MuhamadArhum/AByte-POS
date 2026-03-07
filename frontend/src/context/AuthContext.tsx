import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

interface User {
  user_id: number;
  username?: string;
  name: string;
  email: string;
  role?: string;  // Kept for backward compatibility
  role_name: string;  // Backend now sends role_name
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User, permissions: string[] | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[] | null;  // null = Admin (full access), [] = no access, [...] = specific keys
  hasPermission: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedPermissions = localStorage.getItem('permissions');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // null stored as 'null' string means Admin (full access)
      setPermissions(storedPermissions === 'null' ? null : storedPermissions ? JSON.parse(storedPermissions) : []);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: User, newPermissions: string[] | null) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('permissions', JSON.stringify(newPermissions));
    setToken(newToken);
    setUser(newUser);
    setPermissions(newPermissions);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    setToken(null);
    setUser(null);
    setPermissions(null);
  }, []);

  const hasPermission = useCallback((moduleKey: string): boolean => {
    if (permissions === null) return true; // Admin: full access
    return permissions.includes(moduleKey);
  }, [permissions]);

  const value = useMemo(() => ({
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
    isLoading,
    permissions,
    hasPermission,
  }), [user, token, login, logout, isLoading, permissions, hasPermission]);

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
