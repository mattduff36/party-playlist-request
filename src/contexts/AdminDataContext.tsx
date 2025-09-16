'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAdminData as useAdminDataHook } from '@/hooks/useAdminData';

// Create the context
const AdminDataContext = createContext<ReturnType<typeof useAdminDataHook> | null>(null);

// Provider component
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const adminData = useAdminDataHook();
  
  return (
    <AdminDataContext.Provider value={adminData}>
      {children}
    </AdminDataContext.Provider>
  );
}

// Hook to use the admin data context
export function useAdminData(options?: { disablePolling?: boolean }) {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  
  // Note: The options parameter is ignored since we use a shared instance
  // This maintains API compatibility but prevents multiple SSE connections
  return context;
}
