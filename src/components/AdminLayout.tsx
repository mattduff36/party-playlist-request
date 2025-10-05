'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Home,
  LogOut,
  Music,
  Play,
  Settings,
  Monitor,
  Eye
} from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import SpotifyStatusDropdown from '@/components/admin/SpotifyStatusDropdown';
import NotificationsDropdown from '@/components/admin/NotificationsDropdown';
import NotificationInitializer from '@/components/admin/NotificationInitializer';
import EventStateDropdown from '@/components/admin/EventStateDropdown';
import PageToggleIcons from '@/components/admin/PageToggleIcons';

interface AdminLayoutProps {
  children: React.ReactNode;
  username?: string;
}

export default function AdminLayout({ children, username }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthenticated, setToken, clearToken, isLoading: authLoading } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Get admin data for notifications
  const { stats } = useAdminData();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (authLoading) {
          return; // Wait for auth context to load
        }

        if (!token) {
          setLoading(false);
          return;
        }

        // Token exists and is valid (checked by AdminAuthContext)
        setLoading(false);
      } catch (error) {
        console.error('❌ Auth check error:', error);
        clearToken();
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [token, authLoading, clearToken]);

  // Login function
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
      setLoginError('Username and password are required');
      setIsLoggingIn(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        setLoginError('');
      } else {
        const errorData = await response.json();
        setLoginError(errorData.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Network error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Show logout confirmation modal
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  // Actual logout function
  const performLogout = async (disconnectSpotify: boolean = false) => {
    // Trigger logout Pusher event before clearing token
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Failed to trigger logout event:', error);
    }
    
    // Disconnect Spotify if requested
    if (disconnectSpotify && token) {
      try {
        await fetch('/api/spotify/disconnect', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Failed to disconnect Spotify:', error);
      }
    }
    
    // Clear token and redirect
    clearToken();
    setShowLogoutModal(false);
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Login form (if not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-purple-500/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
              <span className="text-3xl">🎵</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Login</h1>
            <p className="text-gray-400">Party Playlist Management</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoFocus
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {isLoggingIn ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Logging in...
                </>
              ) : (
                'Log In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-center text-gray-400 text-sm">
              <a href="/" className="text-purple-400 hover:text-purple-300 transition-colors">
                ← Back to Party Playlist
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get current tab from pathname
  const getCurrentTab = () => {
    if (pathname?.includes('/requests')) return 'requests';
    if (pathname?.includes('/spotify')) return 'spotify';
    if (pathname?.includes('/display')) return 'display';
    if (pathname?.includes('/settings')) return 'settings';
    return 'overview';
  };

  const activeTab = getCurrentTab();

  // Navigation items
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Home, href: '/admin/overview' },
    { id: 'requests', label: 'Song Requests', icon: Music, href: '/admin/requests' },
    { id: 'spotify', label: 'Spotify', icon: Play, href: '/admin/spotify' },
    { id: 'display', label: 'Display Settings', icon: Eye, href: '/admin/display' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
  ];

  // Sidebar component
  const Sidebar = () => (
    <div className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-gray-800 border-r border-gray-700 z-40">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-4 bg-gray-900">
          <span className="text-2xl mr-2">🎵</span>
          <h1 className="text-xl font-bold text-white">{username || 'DJ Admin'}</h1>
        </div>
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <div className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center justify-between px-4 py-3 mb-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    {item.label}
                  </div>
                  {item.id === 'requests' && stats?.pending_requests && stats.pending_requests > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {stats.pending_requests}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-3 mt-6">
            <div className="border-t border-gray-700 pt-4">
              <a
                href="/display"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Monitor className="w-5 h-5 mr-3" />
                Display Screen
              </a>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 mt-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile navigation component
  const MobileNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[60px] relative ${
                isActive
                  ? 'text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs truncate">{item.label.split(' ')[0]}</span>
              {item.id === 'requests' && stats?.pending_requests && stats.pending_requests > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full min-w-[18px]">
                  {stats.pending_requests}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Main admin layout (authenticated)
  return (
    <div className="min-h-screen bg-gray-900 flex">
      <NotificationInitializer />
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 md:ml-64">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white md:hidden">
              {navItems.find(item => item.id === activeTab)?.label || 'Admin'}
            </h1>
            <div className="hidden md:flex items-center space-x-4">
              <h2 className="text-lg font-semibold text-white">
                {navItems.find(item => item.id === activeTab)?.label || 'Admin'}
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              {/* Page Toggle Icons */}
              <PageToggleIcons />
              
              {/* Event State Dropdown */}
              <EventStateDropdown />
              
              {/* Spotify Status Dropdown */}
              <SpotifyStatusDropdown />
              
              {/* Notifications Dropdown */}
              <NotificationsDropdown />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main>
          {children}
        </main>

        {/* Mobile Navigation */}
        <MobileNav />
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Logout</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to log out?
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => performLogout(false)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Logout (Keep Spotify Connected)
              </button>
              <button
                onClick={() => performLogout(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Logout & Disconnect Spotify
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

