'use client';

import { useRouter } from 'next/navigation';
import { Music2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface AdminLayoutProps {
  username: string;
  activeTab: 'overview' | 'requests' | 'settings' | 'spotify';
  userRole?: string;
  children: ReactNode;
}

export function AdminLayout({ username, activeTab, userRole, children }: AdminLayoutProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const tabs = [
    { key: 'overview', label: 'Overview', href: `/${username}/admin/overview` },
    { key: 'requests', label: 'Requests', href: `/${username}/admin/requests` },
    { key: 'settings', label: 'Settings', href: `/${username}/admin/settings` },
    { key: 'spotify', label: 'Spotify', href: `/${username}/admin/spotify` },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Music2 className="w-8 h-8 text-white" />
              <span className="text-2xl font-bold text-white">PartyPlaylist</span>
            </Link>
            <div className="flex items-center gap-6">
              {/* Nav Links */}
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`transition-colors ${
                    activeTab === tab.key
                      ? 'text-white font-semibold border-b-2 border-white pb-1'
                      : 'text-blue-200 hover:text-white'
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
              
              {/* User Menu */}
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/20">
                <span className="text-blue-200 text-sm">
                  {username} {userRole === 'superadmin' && '(Admin)'}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}

