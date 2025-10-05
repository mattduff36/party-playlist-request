'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AdminLayout from '../../../components/AdminLayout';
import { AdminDataProvider } from '@/contexts/AdminDataContext';
import { GlobalEventProvider } from '@/lib/state/global-event-client';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <AdminAuthProvider>
      <NotificationProvider>
        <GlobalEventProvider>
          <AdminDataProvider>
            <AdminLayout username={username}>{children}</AdminLayout>
          </AdminDataProvider>
        </GlobalEventProvider>
      </NotificationProvider>
    </AdminAuthProvider>
  );
}
