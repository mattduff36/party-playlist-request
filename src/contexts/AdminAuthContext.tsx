'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';

/**
 * Admin Authentication Context
 * 
 * This context provides authentication state and token management for admin pages.
 * - Tokens are stored in localStorage as 'admin_token'
 * - Tokens expire after 24 hours (configured in authService)
 * - Automatic token validation on mount and periodic checks
 * - Does NOT affect public pages or Spotify authentication
 */

interface AdminAuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
  checkTokenExpiry: () => boolean;
}

interface TokenPayload {
  adminId: string;
  username: string;
  type: 'admin';
  exp: number;
  iat: number;
  iss: string;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if token is expired
  const checkTokenExpiry = (): boolean => {
    if (!token) return false;

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      const currentTime = Date.now() / 1000; // Convert to seconds
      
      // Check if token has expired
      if (decoded.exp < currentTime) {
        console.log('⚠️ Token has expired');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error decoding token:', error);
      return false;
    }
  };

  // Load token from localStorage on mount
  useEffect(() => {
    const loadToken = () => {
      try {
        const storedToken = localStorage.getItem('admin_token');
        
        if (storedToken) {
          // Validate token before setting
          try {
            const decoded = jwtDecode<TokenPayload>(storedToken);
            const currentTime = Date.now() / 1000;
            
            if (decoded.exp > currentTime) {
              // Token is valid
              console.log('✅ Valid admin token found');
              setTokenState(storedToken);
            } else {
              // Token is expired
              console.log('⚠️ Stored token is expired, clearing...');
              localStorage.removeItem('admin_token');
              setTokenState(null);
            }
          } catch (error) {
            // Invalid token format
            console.error('❌ Invalid token format, clearing...');
            localStorage.removeItem('admin_token');
            setTokenState(null);
          }
        }
      } catch (error) {
        console.error('❌ Error loading token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  // Periodic token validation (every 5 minutes)
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      const isValid = checkTokenExpiry();
      
      if (!isValid) {
        console.log('⚠️ Token expired during session, clearing...');
        clearToken();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [token]);

  // Set token (called after successful login)
  const setToken = (newToken: string) => {
    try {
      // Validate token before setting
      const decoded = jwtDecode<TokenPayload>(newToken);
      const currentTime = Date.now() / 1000;
      
      if (decoded.exp > currentTime) {
        console.log('✅ Setting new admin token');
        localStorage.setItem('admin_token', newToken);
        setTokenState(newToken);
      } else {
        console.error('❌ Cannot set expired token');
      }
    } catch (error) {
      console.error('❌ Invalid token format:', error);
    }
  };

  // Clear token (called on logout or expiry)
  const clearToken = () => {
    console.log('🔒 Clearing admin token');
    localStorage.removeItem('admin_token');
    setTokenState(null);
  };

  const value: AdminAuthContextType = {
    token,
    isAuthenticated: !!token,
    isLoading,
    setToken,
    clearToken,
    checkTokenExpiry,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// Hook to use admin auth context
export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  
  return context;
}

// Optional: Hook that returns null if outside admin context (for optional auth)
export function useOptionalAdminAuth(): AdminAuthContextType | null {
  return useContext(AdminAuthContext);
}

