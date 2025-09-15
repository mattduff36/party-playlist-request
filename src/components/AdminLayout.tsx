'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Volume2, 
  Settings, 
  Music, 
  Users, 
  Clock,
  RefreshCw,
  Monitor
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

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
        localStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
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

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    router.push('/admin/overview');
  };

  // Get current tab from pathname
  const getCurrentTab = () => {
    if (pathname.includes('/requests')) return 'requests';
    if (pathname.includes('/spotify')) return 'spotify';
    if (pathname.includes('/settings')) return 'settings';
    return 'overview';
  };

  const activeTab = getCurrentTab();

  // Navigation items
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Clock, href: '/admin/overview' },
    { id: 'requests', label: 'Song Requests', icon: Music, href: '/admin/requests' },
    { id: 'spotify', label: 'Spotify', icon: Play, href: '/admin/spotify' },
    { id: 'settings', label: 'Event Settings', icon: Settings, href: '/admin/settings' },
  ];

  // Sidebar component
  const Sidebar = () => (
    <div className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-gray-800 border-r border-gray-700">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-4 bg-gray-900">
          <h1 className="text-xl font-bold text-white">DJ Admin</h1>
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
                </button>
              );
            })}
          </div>
          <div className="px-3 mt-6">
            <div className="border-t border-gray-700 pt-4">
              <button
                onClick={() => router.push('/admin/spotify-setup')}
                className="w-full flex items-center px-4 py-3 mb-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Music className="w-5 h-5 mr-3" />
                🎵 Spotify Setup
              </button>
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
                <RefreshCw className="w-5 h-5 mr-3" />
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
              className={`flex flex-col items-center p-2 rounded-lg transition-colors min-w-[60px] ${
                isActive
                  ? 'text-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs truncate">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Login screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">DJ Admin</h1>
              <p className="text-gray-400">Party Control Center</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter username"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter password"
                />
              </div>
              
              {loginError && (
                <div className="text-red-400 text-sm text-center">
                  {loginError}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main layout with sidebar and content
  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 md:pl-64">
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
            <div className="flex items-center space-x-4">
              <a
                href="/display"
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Monitor className="w-5 h-5" />
                <span>Display Screen</span>
              </a>
              <button
                onClick={handleLogout}
                className="md:hidden text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
