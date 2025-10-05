'use client';

import { useState } from 'react';
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Get admin data for notifications
  const { stats } = useAdminData();

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (!pathname) return 'overview';
    if (pathname.includes('/overview')) return 'overview';
    if (pathname.includes('/requests')) return 'requests';
    if (pathname.includes('/settings')) return 'settings';
    if (pathname.includes('/spotify')) return 'spotify';
    if (pathname.includes('/display')) return 'display';
    return 'overview';
  };

  const activeTab = getActiveTab();

  // Get username from pathname if not provided
  const displayUsername = username || pathname?.split('/')[1] || 'DJ Admin';
  const baseRoute = `/${pathname?.split('/')[1]}`;

  const navItems = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: Home, 
      href: `${baseRoute}/admin/overview`,
      badge: stats?.pending_count && stats.pending_count > 0 ? stats.pending_count : undefined
    },
    { 
      id: 'requests', 
      label: 'Requests', 
      icon: Music, 
      href: `${baseRoute}/admin/requests`,
      badge: stats?.pending_count && stats.pending_count > 0 ? stats.pending_count : undefined
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings, 
      href: `${baseRoute}/admin/settings`
    },
    { 
      id: 'spotify', 
      label: 'Spotify', 
      icon: Play, 
      href: `${baseRoute}/admin/spotify`
    },
    { 
      id: 'display', 
      label: 'Display', 
      icon: Monitor, 
      href: `${baseRoute}/display`
    },
  ];

  // Logout function (calls JWT logout)
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const performLogout = async () => {
    try {
      // Call JWT logout endpoint
      await fetch('/api/auth/logout', {
        method: 'POST'
      });
      
      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
      // Redirect anyway
      router.push('/login');
    } finally {
      setShowLogoutModal(false);
    }
  };

  // Sidebar component
  const Sidebar = () => (
    <div className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-gray-800 border-r border-gray-700 z-40">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-4 bg-gray-900">
          <span className="text-2xl mr-2">🎵</span>
          <h1 className="text-xl font-bold text-white">{displayUsername}</h1>
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
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      isActive ? 'bg-white text-purple-600' : 'bg-purple-600 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-3 pt-4 border-t border-gray-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Top navigation for mobile
  const TopNav = () => (
    <div className="md:hidden sticky top-0 z-50 flex items-center justify-between h-16 px-4 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center">
        <span className="text-2xl mr-2">🎵</span>
        <h1 className="text-lg font-bold text-white">{displayUsername}</h1>
      </div>
      <div className="flex items-center space-x-2">
        <NotificationsDropdown />
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // Mobile bottom navigation
  const BottomNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center flex-1 h-full relative ${
                isActive ? 'text-purple-400' : 'text-gray-400'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1">{item.label}</span>
              {item.badge && (
                <span className="absolute top-2 right-1/4 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Logout Modal
  const LogoutModal = () => {
    if (!showLogoutModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <h3 className="text-xl font-bold text-white mb-4">Confirm Logout</h3>
          <p className="text-gray-300 mb-6">Are you sure you want to logout?</p>
          <div className="flex space-x-4">
            <button
              onClick={performLogout}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Logout
            </button>
            <button
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <NotificationInitializer />
      <div className="min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <TopNav />
        
        <div className="md:pl-64">
          <div className="pb-20 md:pb-0">
            {/* Top action bar (desktop) */}
            <div className="hidden md:flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center space-x-4">
                <EventStateDropdown />
                <PageToggleIcons />
              </div>
              <div className="flex items-center space-x-4">
                <SpotifyStatusDropdown />
                <NotificationsDropdown />
              </div>
            </div>
            
            {/* Main content */}
            <main className="p-6">
              {children}
            </main>
          </div>
        </div>
        
        <BottomNav />
        <LogoutModal />
      </div>
    </>
  );
}
