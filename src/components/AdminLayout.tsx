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
  Eye,
  Lock,
  ExternalLink,
  Wand2
} from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import SpotifyStatusDropdown from '@/components/admin/SpotifyStatusDropdown';
import NotificationsDropdown from '@/components/admin/NotificationsDropdown';
import NotificationInitializer from '@/components/admin/NotificationInitializer';
import EventStateDropdown from '@/components/admin/EventStateDropdown';
import PageToggleIcons from '@/components/admin/PageToggleIcons';
import EventTitleEditor from '@/components/admin/EventTitleEditor';
import SetupPartyModal from '@/components/admin/SetupPartyModal';
import TokenExpiryWarning from '@/components/admin/TokenExpiryWarning';
import SetupModal from '@/components/admin/SetupModal';
import { useGlobalEvent } from '@/lib/state/global-event-client';

interface AdminLayoutProps {
  children: React.ReactNode;
  username?: string;
}

export default function AdminLayout({ children, username }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSetupPartyModal, setShowSetupPartyModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [eventPin, setEventPin] = useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  
  // Get admin data for notifications
  const { stats } = useAdminData();
  const { state } = useGlobalEvent();

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

  const navItems: Array<{ id: string; label: string; icon: any; href?: string; onClick?: () => void; badge?: number }> = [
    { 
      id: 'overview', 
      label: 'Overview', 
      icon: Home, 
      href: `${baseRoute}/admin/overview`,
      badge: stats?.pending_requests && stats.pending_requests > 0 ? stats.pending_requests : undefined
    },
    { 
      id: 'display', 
      label: 'Display', 
      icon: Eye, 
      href: `${baseRoute}/admin/display`
    },
    { 
      id: 'spotify', 
      label: 'Spotify', 
      icon: Play, 
      href: `${baseRoute}/admin/spotify`
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings, 
      href: `${baseRoute}/admin/settings`
    },
  ];

  // Fetch event data for PIN and display URL
  useEffect(() => {
    const fetchEventData = async () => {
      if (state?.status === 'live' || state?.status === 'standby') {
        try {
          const response = await fetch('/api/events/current', {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            const event = data.event;
            setEventPin(event.pin);
            setDisplayUrl(`${window.location.origin}/${displayUsername}/display/${event.pin}`);
          }
        } catch (error) {
          console.error('Failed to fetch event:', error);
        }
      } else {
        setEventPin(null);
        setDisplayUrl(null);
      }
    };

    fetchEventData();
  }, [state?.status, displayUsername]);

  // Show setup party modal on first login
  useEffect(() => {
    const checkFirstLogin = () => {
      const hasSeenSetupPrompt = localStorage.getItem('party_setup_prompt_seen');
      
      console.log('🎉 Setup prompt check:', { hasSeenSetupPrompt });
      
      if (!hasSeenSetupPrompt) {
        // Small delay to let the UI load first
        setTimeout(() => {
          console.log('🎉 Showing setup party modal');
          setShowSetupPartyModal(true);
        }, 1000);
      }
    };

    checkFirstLogin();
  }, []);

  // Monitor token expiry
  useEffect(() => {
    const getTokenExpiry = () => {
      // Try to get token from cookie
      const cookies = document.cookie.split(';');
      const authCookie = cookies.find(c => c.trim().startsWith('auth_token='));
      
      if (!authCookie) {
        console.log('No auth token found');
        return null;
      }

      const token = authCookie.split('=')[1];
      
      try {
        // Decode JWT token (client-side, just to read expiry - not for validation)
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        if (payload.exp) {
          // exp is in seconds, convert to milliseconds
          const expiryMs = payload.exp * 1000;
          console.log('Token expires at:', new Date(expiryMs).toLocaleString());
          return expiryMs;
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
      
      return null;
    };

    const expiry = getTokenExpiry();
    if (expiry) {
      setTokenExpiry(expiry);
    }
  }, []);

  // Handle session extension
  const handleExtendSession = async () => {
    try {
      const response = await fetch('/api/auth/refresh-session', {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Session extended successfully');
        
        // Decode new token to get new expiry
        const token = data.token;
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        if (payload.exp) {
          const expiryMs = payload.exp * 1000;
          setTokenExpiry(expiryMs);
          console.log('New token expires at:', new Date(expiryMs).toLocaleString());
        }
      } else {
        console.error('Failed to extend session');
      }
    } catch (error) {
      console.error('Error extending session:', error);
      throw error;
    }
  };

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
  const Sidebar: React.FC = () => (
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
                  onClick={() => {
                    if ('onClick' in item && item.onClick) {
                      item.onClick();
                    } else if ('href' in item && item.href) {
                      router.push(item.href);
                    }
                  }}
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
          <div className="px-3 pt-4 border-t border-gray-700 space-y-2">
            {/* Open Display Screen Button */}
            {displayUrl && (
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center px-4 py-3 rounded-lg text-gray-300 hover:bg-purple-600 hover:text-white transition-colors"
              >
                <Monitor className="w-5 h-5 mr-3" />
                <span>Open Display</span>
              </a>
            )}
            {/* Setup Button */}
            <button
              onClick={() => setShowSetupModal(true)}
              className="w-full flex items-center px-4 py-3 rounded-lg text-gray-300 hover:bg-purple-600 hover:text-white transition-colors"
            >
              <Wand2 className="w-5 h-5 mr-3" />
              <span>Setup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Top navigation for mobile
  const TopNav: React.FC = () => (
    <div className="md:hidden sticky top-0 z-50 flex items-center justify-between h-16 px-4 bg-gray-800 border-b border-gray-700">
      <div className="flex items-center">
        <span className="text-2xl mr-2">🎵</span>
        <h1 className="text-lg font-bold text-white">{displayUsername}</h1>
      </div>
      <div className="flex items-center space-x-2">
        {eventPin && (
          <div className="flex items-center space-x-1 bg-purple-900/20 border border-purple-600/50 rounded-lg px-2 py-1">
            <Lock className="h-3 w-3 text-purple-400" />
            <span className="text-xs font-mono font-bold text-white">{eventPin}</span>
          </div>
        )}
        <NotificationsDropdown />
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // Mobile bottom navigation
  const BottomNav: React.FC = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if ('onClick' in item && item.onClick) {
                  item.onClick();
                } else if ('href' in item && item.href) {
                  router.push(item.href);
                }
              }}
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
  const LogoutModal: React.FC = () => {
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
                <SpotifyStatusDropdown />
                <PageToggleIcons />
              </div>
              <div className="flex-1 flex justify-center">
                <EventTitleEditor />
              </div>
              <div className="flex items-center space-x-3">
                {eventPin && (
                  <div className="flex items-center space-x-2 bg-purple-900/20 border border-purple-600/50 rounded-lg px-4 py-2">
                    <Lock className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-400 text-sm">PIN:</span>
                    <span className="text-xl font-bold text-white tracking-wider font-mono">{eventPin}</span>
                  </div>
                )}
                <NotificationsDropdown />
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
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
        <SetupPartyModal 
          isOpen={showSetupPartyModal}
          onConfirm={() => {
            localStorage.setItem('party_setup_prompt_seen', 'true');
            setShowSetupPartyModal(false);
            setShowSetupModal(true);
          }}
          onClose={() => {
            localStorage.setItem('party_setup_prompt_seen', 'true');
            setShowSetupPartyModal(false);
          }}
        />
        <SetupModal 
          isOpen={showSetupModal} 
          onClose={() => setShowSetupModal(false)}
          username={displayUsername}
        />
        {/* Token expiry warning - only show if event is NOT offline */}
        {tokenExpiry && state?.status !== 'offline' && (
          <TokenExpiryWarning 
            expiryTime={tokenExpiry}
            onExtendSession={handleExtendSession}
          />
        )}
      </div>
    </>
  );
}
