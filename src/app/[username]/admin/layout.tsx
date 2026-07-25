'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '../../../components/AdminLayout';
import { AdminDataProvider } from '@/contexts/AdminDataContext';
import { SpotifyControlsProvider } from '@/contexts/SpotifyControlsContext';
import { GlobalEventProvider } from '@/lib/state/global-event-client';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import PageLoader from '@/components/ui/PageLoader';

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

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        
        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();

        // Check ownership or super admin
        if (data.user.username !== username && data.user.role !== 'superadmin') {
          router.push(`/${data.user.username}/admin/overview`);
          return;
        }

        setAuthenticated(true);
        setLoading(false);
      } catch (err) {
        router.push('/login');
      }
    }

    checkAuth();
  }, [router, username]);

  if (loading) {
    return <PageLoader label="Loading DJ admin..." />;
  }

  if (!authenticated) {
    return null;
  }

  return (
    <AdminAuthProvider>
      <NotificationProvider>
        <GlobalEventProvider>
          <AdminDataProvider>
            <SpotifyControlsProvider>
              <AdminLayout username={username}>{children}</AdminLayout>
            </SpotifyControlsProvider>
          </AdminDataProvider>
        </GlobalEventProvider>
      </NotificationProvider>
    </AdminAuthProvider>
  );
}
