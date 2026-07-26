'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Users, LogOut, Loader2, Radio, Music, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import PageLoader from '@/components/ui/PageLoader';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [username, setUsername] = useState('');
  const [unresolvedErrors, setUnresolvedErrors] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const loadSummary = async () => {
      try {
        const res = await fetch('/api/superadmin/support/summary', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUnresolvedErrors(data.unresolvedErrors || 0);
        }
      } catch {
        /* ignore */
      }
    };
    loadSummary();
    const id = setInterval(loadSummary, 60_000);
    return () => clearInterval(id);
  }, [authorized, pathname]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (!response.ok) {
        router.push('/login?redirect=/superadmin');
        return;
      }

      const data = await response.json();

      if (data.user.role !== 'superadmin') {
        router.push('/');
        return;
      }

      setUsername(data.user.username);
      setAuthorized(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login?redirect=/superadmin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authenticatedFetch('/api/auth/logout', {
        method: 'POST',
      });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return <PageLoader label="Checking superadmin access..." />;
  }

  if (!authorized) {
    return null;
  }

  const tabClass = (active: boolean) =>
    `flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 border ${
      active
        ? 'bg-accent border-accent text-ink font-semibold'
        : 'bg-elevated/80 hover:bg-surface border-white/10 text-bone'
    }`;

  return (
    <div className="min-h-screen bg-ink text-bone">
      <nav className="border-b border-white/10 bg-elevated/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="w-7 h-7 text-accent" />
              <span className="ml-2 font-display text-xl font-bold">Super Admin</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-muted text-sm">{username}</span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-bone hover:text-error transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Link href="/superadmin" className={tabClass(pathname === '/superadmin')}>
              <Users className={`w-5 h-5 ${pathname === '/superadmin' ? 'text-ink' : 'text-accent'}`} />
              <span>User Management</span>
            </Link>

            <Link
              href="/superadmin/party-test"
              className={tabClass(pathname === '/superadmin/party-test')}
            >
              <Radio className={`w-5 h-5 ${pathname === '/superadmin/party-test' ? 'text-ink' : 'text-accent'}`} />
              <span>Party Simulator</span>
            </Link>

            <Link
              href={`/${username}/admin/spotify`}
              className={tabClass(false)}
            >
              <Music className="w-5 h-5 text-accent" />
              <span>DJ Dashboard</span>
            </Link>

            <Link
              href="/superadmin/support"
              className={tabClass(pathname?.startsWith('/superadmin/support') ?? false)}
            >
              <LifeBuoy className={`w-5 h-5 ${pathname?.startsWith('/superadmin/support') ? 'text-ink' : 'text-accent'}`} />
              <span>Support</span>
              {unresolvedErrors > 0 ? (
                <span className="ml-1 min-w-[1.25rem] rounded-full bg-error px-1.5 py-0.5 text-center text-xs font-bold text-white">
                  {unresolvedErrors > 99 ? '99+' : unresolvedErrors}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
