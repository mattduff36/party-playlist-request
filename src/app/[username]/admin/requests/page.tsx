'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  
  const [user, setUser] = useState<User | null>(null);
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
        setUser(data.user);

        if (data.user.username !== username && data.user.role !== 'superadmin') {
          router.push(`/${data.user.username}/admin/requests`);
          return;
        }

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

  return (
    <AdminLayout username={username} activeTab="requests" userRole={user?.role}>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Manage Requests</h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-12 border border-white/20 text-center">
          <p className="text-white text-xl mb-4">🚧 Coming Soon!</p>
          <p className="text-blue-200">
            Request management interface will be built here.
            For now, use the existing admin panel.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}

