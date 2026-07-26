'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '../../../components/AdminLayout';
import { AdminDataProvider } from '@/contexts/AdminDataContext';
import { SpotifyControlsProvider } from '@/contexts/SpotifyControlsContext';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import PageLoader from '@/components/ui/PageLoader';
import AccountPendingOverlay from '@/components/AccountPendingOverlay';

interface AuthUser {
  username: string;
  role: string;
  account_status?: string;
}

export default function UserAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal: AbortSignal.timeout(12_000),
        });

        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();
        const user = data.user as AuthUser;

        // Check ownership or super admin
        if (user.username !== username && user.role !== 'superadmin') {
          router.push(`/${user.username}/admin/spotify`);
          return;
        }

        if (!cancelled) {
          setAuthUser(user);
          setAuthenticated(true);
        }
      } catch {
        if (!cancelled) {
          router.push('/login');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router, username]);

  if (loading) {
    return <PageLoader label="Loading DJ admin..." />;
  }

  // Keep the loader visible while redirecting to login / home admin —
  // returning null paints a blank page and races e2e/UX on slow /api/auth/me.
  if (!authenticated || !authUser) {
    return <PageLoader label="Loading DJ admin..." />;
  }

  const isOwnAccount = authUser.username === username;
  const status = authUser.account_status;
  const showApprovalGate =
    isOwnAccount &&
    authUser.role !== 'superadmin' &&
    (status === 'pending' || status === 'rejected');

  if (showApprovalGate) {
    return (
      <AccountPendingOverlay
        status={status as 'pending' | 'rejected'}
        username={authUser.username}
      />
    );
  }

  // Use root GlobalEventProvider only — a nested provider doubled Pusher clients
  // and status refreshes, which wedged the finalise e2e production server.
  return (
    <AdminAuthProvider>
      <NotificationProvider>
        <AdminDataProvider>
          <SpotifyControlsProvider>
            <AdminLayout username={username}>{children}</AdminLayout>
          </SpotifyControlsProvider>
        </AdminDataProvider>
      </NotificationProvider>
    </AdminAuthProvider>
  );
}
