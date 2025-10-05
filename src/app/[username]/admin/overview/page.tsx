'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Music2, Loader2, CheckCircle2, LogOut } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        // Check if user is accessing their own page
        if (data.user.username !== username && data.user.role !== 'superadmin') {
          setError(`You're logged in as ${data.user.username} but trying to access ${username}'s panel`);
        }

        setLoading(false);
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      }
    }

    checkAuth();
  }, [router, username]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">PartyPlaylist</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-200">
              {user?.username} {user?.role === 'superadmin' && '(Admin)'}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {error ? (
            <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-8 text-center">
              <p className="text-red-200 text-lg mb-4">{error}</p>
              <Link
                href={`/${user?.username}/admin/overview`}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all inline-block"
              >
                Go to Your Dashboard
              </Link>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
              <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-6" />
              <h1 className="text-4xl font-bold text-white mb-4">
                Welcome, {user?.username}!
              </h1>
              <p className="text-xl text-blue-200 mb-8">
                🎉 Authentication is working perfectly!
              </p>

              <div className="bg-white/5 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Your Account Details</h2>
                <div className="space-y-2 text-left max-w-md mx-auto">
                  <p className="text-blue-200">
                    <span className="font-semibold text-white">Username:</span> {user?.username}
                  </p>
                  <p className="text-blue-200">
                    <span className="font-semibold text-white">Email:</span> {user?.email}
                  </p>
                  <p className="text-blue-200">
                    <span className="font-semibold text-white">Role:</span> {user?.role}
                  </p>
                  <p className="text-blue-200">
                    <span className="font-semibold text-white">User ID:</span> {user?.id}
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-6">
                <p className="text-blue-100 mb-4">
                  ✅ <strong>Phase 1 Progress:</strong> Authentication system is complete!
                </p>
                <p className="text-blue-200 text-sm">
                  Next up: Building your personalized admin dashboard with Spotify integration,
                  request management, and display controls.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

