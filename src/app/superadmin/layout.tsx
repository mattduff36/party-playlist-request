'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Users, LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (!response.ok) {
        router.push('/auth/login?redirect=/superadmin');
        return;
      }

      const data = await response.json();

      // Check if user is super admin
      if (data.user.role !== 'superadmin') {
        router.push('/');
        return;
      }

      setUsername(data.user.username);
      setAuthorized(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/auth/login?redirect=/superadmin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#191414] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#1DB954] animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#191414]">
      {/* Top Navigation */}
      <nav className="bg-black/50 backdrop-blur-md border-b border-[#1DB954]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-[#1DB954]" />
              <span className="ml-2 text-xl font-bold text-white">Super Admin</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-400">
                {username}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-white hover:text-red-400 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <Link
              href="/superadmin"
              className="flex items-center space-x-2 px-4 py-2 bg-black/50 hover:bg-[#1DB954]/20 backdrop-blur-md rounded-lg transition-all duration-300 border border-[#1DB954]/30 text-white"
            >
              <Users className="w-5 h-5 text-[#1DB954]" />
              <span>User Management</span>
            </Link>
          </div>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}

