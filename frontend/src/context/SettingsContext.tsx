import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

interface SettingsContextType {
  currencySymbol: string;
  refreshSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  currencySymbol: 'Rs.',
  refreshSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencySymbol, setCurrencySymbol] = useState<string>(() => {
    return localStorage.getItem('currency_symbol') || 'Rs.';
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      const symbol = res.data?.currency_symbol || 'Rs.';
      setCurrencySymbol(symbol);
      localStorage.setItem('currency_symbol', symbol);
    } catch {
      // keep cached value
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider value={{ currencySymbol, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
