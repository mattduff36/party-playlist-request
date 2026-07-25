'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Home,
  LogOut,
  Play,
  Settings,
  Monitor,
  Eye,
  Lock,
  Wand2,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import { useAdminData } from '@/contexts/AdminDataContext';
import PageLoader from '@/components/ui/PageLoader';
import SpotifyStatusDropdown from '@/components/admin/SpotifyStatusDropdown';
import NotificationsDropdown from '@/components/admin/NotificationsDropdown';
import NotificationInitializer from '@/components/admin/NotificationInitializer';
import EventStateDropdown from '@/components/admin/EventStateDropdown';
import PageToggleIcons from '@/components/admin/PageToggleIcons';
import EventTitleEditor from '@/components/admin/EventTitleEditor';
import SetupPartyModal from '@/components/admin/SetupPartyModal';
import TokenExpiryWarning from '@/components/admin/TokenExpiryWarning';
import SetupModal from '@/components/admin/SetupModal';
import AdminQueueSidebar from '@/components/admin/AdminQueueSidebar';
import SidebarSpotifyControls from '@/components/admin/SidebarSpotifyControls';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { APP_VERSION } from '@/lib/app-version';

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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Get admin data for notifications
  const { stats, loading: adminDataLoading } = useAdminData();
  const { state } = useGlobalEvent();

  // Gate Super Admin sidebar link to logged-in superadmins only
  useEffect(() => {
    async function checkSuperAdminRole() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        setIsSuperAdmin(data.user?.role === 'superadmin');
      } catch {
        setIsSuperAdmin(false);
      }
    }

    checkSuperAdminRole();
  }, []);

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
  const eventHydrated = Boolean(state && !state.isLoading);
  const showQueueSidebar =
    eventHydrated &&
    activeTab === 'overview' &&
    (state.status === 'standby' || state.status === 'live');

  // Get username from pathname if not provided
  const displayUsername = username || pathname?.split('/')[1] || 'DJ Admin';
  const baseRoute = `/${pathname?.split('/')[1]}`;

  const navItems = [
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

  // Fetch event data for access code and display URL
  useEffect(() => {
    const fetchEventData = async () => {
      // Wait for first event-state hydrate so default offline does not clear code
      if (state?.isLoading) {
        return;
      }
      if (state?.status === 'live' || state?.status === 'standby') {
        try {
          const response = await fetch('/api/events/current', {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            const event = data.event;
            const code = event.access_code || event.pin;
            setEventPin(code);
            setDisplayUrl(
              `${window.location.origin}/${displayUsername}/${code}/display`
            );
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

    const onAccessCodeChanged = () => {
      fetchEventData();
    };
    window.addEventListener('pp:access-code-changed', onAccessCodeChanged);
    return () => {
      window.removeEventListener('pp:access-code-changed', onAccessCodeChanged);
    };
  }, [state?.status, state?.isLoading, displayUsername]);

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

  // JSX elements (not inner components) so layout re-renders do not remount Spotify controls
  const sidebar = (
    <div className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-elevated border-r border-white/10 z-40">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="relative flex items-center h-16 px-4 bg-ink border-b border-white/10">
          <span className="font-display text-accent text-lg mr-2 tracking-tight">PP</span>
          <h1 className="font-display text-xl font-bold text-bone truncate">{displayUsername}</h1>
          <p
            className="pointer-events-none absolute bottom-1 right-2 text-[10px] font-mono tracking-wide text-faint"
            aria-label="App version"
          >
            v{APP_VERSION}
          </p>
        </div>
        <div className="flex-1 flex flex-col min-h-0 pt-5 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto px-3 space-y-1 pb-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if ('href' in item && item.href) {
                      router.push(item.href);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 mb-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-accent text-ink font-semibold'
                      : 'text-muted hover:bg-surface hover:text-bone'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`px-2 py-1 text-xs rounded-full font-bold ${
                      isActive ? 'bg-ink text-accent' : 'bg-accent text-ink'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {displayUrl && (
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center px-4 py-3 mb-2 rounded-lg text-muted hover:bg-surface hover:text-bone transition-colors"
              >
                <Monitor className="w-5 h-5 mr-3" />
                <span>Open Display</span>
              </a>
            )}
            <button
              onClick={() => setShowSetupModal(true)}
              className="w-full flex items-center px-4 py-3 mb-2 rounded-lg text-muted hover:bg-surface hover:text-bone transition-colors"
            >
              <Wand2 className="w-5 h-5 mr-3" />
              <span>Setup</span>
            </button>
            {isSuperAdmin && (
              <Link
                href="/superadmin"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center px-4 py-3 mb-2 rounded-lg text-red-400 hover:bg-white/10 transition-colors"
              >
                <Shield className="w-5 h-5 mr-3" />
                <span>Super Admin</span>
              </Link>
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 max-h-[45%] overflow-y-auto">
            <SidebarSpotifyControls />
          </div>
        </div>
      </div>
    </div>
  );

  const topNav = (
    <div className="md:hidden sticky top-0 z-50 flex items-center justify-between h-16 px-4 bg-elevated border-b border-white/10">
      <div className="flex items-center min-w-0">
        <span className="font-display text-accent text-sm mr-2">PP</span>
        <h1 className="font-display text-lg font-bold text-bone truncate">{displayUsername}</h1>
      </div>
      <div className="flex items-center space-x-2">
        {eventPin && (
          <div className="flex items-center space-x-1 bg-accent/10 border border-accent/40 rounded-lg px-2 py-1">
            <Lock className="h-3 w-3 text-accent" />
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

  const bottomNav = (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-elevated border-t border-white/10 z-50">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if ('href' in item && item.href) {
                  router.push(item.href);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full relative touch-manipulation ${
                isActive ? 'text-accent' : 'text-faint'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              {item.badge && (
                <span className="absolute top-2 right-1/4 bg-accent text-ink text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <NotificationInitializer />
      <div className="min-h-screen bg-ink text-bone md:h-screen md:overflow-hidden">
        {sidebar}
        {topNav}
        
        <div className="md:pl-64 md:h-full md:flex md:flex-col">
          {/* Top action bar (desktop) — full width above main + queue */}
          <div className="hidden md:flex shrink-0 items-center justify-between px-6 py-4 bg-elevated border-b border-white/10">
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
                <div className="flex items-center space-x-2 bg-accent/10 border border-accent/40 rounded-lg px-4 py-2">
                  <Lock className="h-4 w-4 text-accent" />
                  <span className="text-gray-400 text-sm">Code:</span>
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

          <div className="flex flex-1 min-h-0 flex-col lg:flex-row pb-20 md:pb-0">
            {/* Main content — gate until admin data ready */}
            <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto p-6">
              {adminDataLoading ? (
                <PageLoader label="Loading admin data..." fullScreen={false} />
              ) : (
                children
              )}
            </main>

            {showQueueSidebar && !adminDataLoading && (
              <aside className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-elevated lg:overflow-y-auto">
                <AdminQueueSidebar />
              </aside>
            )}
          </div>
        </div>

        {bottomNav}
        {/* Inline JSX (not an inner component) so parent re-renders do not remount the modal */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-ink/70 flex items-center justify-center z-50 p-4">
            <div className="bg-elevated border border-white/10 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-bone mb-4">Confirm Logout</h3>
              <p className="text-muted mb-6">Are you sure you want to logout?</p>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={performLogout}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Logout
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/15 text-bone font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
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
