'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Music2, Loader2, Users, Clock, CheckCircle, XCircle, LogOut, Radio, Settings, List } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface Stats {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  unique_requesters: number;
  spotify_connected: boolean;
}

interface Request {
  id: string;
  track_name: string;
  artist_name: string;
  requester_nickname: string;
  status: string;
  created_at: string;
}

export default function AdminOverviewPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        // Check authentication
        const authResponse = await fetch('/api/auth/me');
        
        if (!authResponse.ok) {
          router.push('/login');
          return;
        }

        const authData = await authResponse.json();
        setUser(authData.user);

        // Check ownership
        if (authData.user.username !== username && authData.user.role !== 'superadmin') {
          setError(`You're logged in as ${authData.user.username} but trying to access ${username}'s panel`);
          setLoading(false);
          return;
        }

        // Load stats (temporary: using old endpoint, will update later)
        try {
          const statsResponse = await fetch('/api/admin/stats');
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            setStats(statsData);
          }
        } catch (err) {
          console.error('Failed to load stats:', err);
        }

        // Load recent requests (temporary: using old endpoint, will update later)
        try {
          const requestsResponse = await fetch('/api/admin/requests?limit=5');
          if (requestsResponse.ok) {
            const requestsData = await requestsResponse.json();
            setRecentRequests(requestsData.requests || []);
          }
        } catch (err) {
          console.error('Failed to load requests:', err);
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to load data:', err);
        router.push('/login');
      }
    }

    loadData();
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
          <p className="text-white text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

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
              <Link
                href={`/${username}/admin/overview`}
                className="text-white font-semibold border-b-2 border-white pb-1"
              >
                Overview
              </Link>
              <Link
                href={`/${username}/admin/requests`}
                className="text-blue-200 hover:text-white transition-colors"
              >
                Requests
              </Link>
              <Link
                href={`/${username}/admin/settings`}
                className="text-blue-200 hover:text-white transition-colors"
              >
                Settings
              </Link>
              <Link
                href={`/${username}/admin/spotify`}
                className="text-blue-200 hover:text-white transition-colors"
              >
                Spotify
              </Link>
              
              {/* User Menu */}
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-white/20">
                <span className="text-blue-200 text-sm">
                  {user?.username} {user?.role === 'superadmin' && '(Admin)'}
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
        {error ? (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-8 text-center">
              <p className="text-red-200 text-lg mb-4">{error}</p>
              <Link
                href={`/${user?.username}/admin/overview`}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all inline-block"
              >
                Go to Your Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Welcome Header */}
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">
                Welcome back, {user?.username}!
              </h1>
              <p className="text-blue-200">
                Here's what's happening with your event
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Requests */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <List className="w-8 h-8 text-blue-400" />
                  <span className="text-blue-200 text-sm">Total</span>
                </div>
                <p className="text-4xl font-bold text-white mb-1">
                  {stats?.total_requests || 0}
                </p>
                <p className="text-blue-200 text-sm">Requests</p>
              </div>

              {/* Pending */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8 text-yellow-400" />
                  <span className="text-blue-200 text-sm">Pending</span>
                </div>
                <p className="text-4xl font-bold text-white mb-1">
                  {stats?.pending_requests || 0}
                </p>
                <p className="text-blue-200 text-sm">Awaiting Review</p>
              </div>

              {/* Approved */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                  <span className="text-blue-200 text-sm">Approved</span>
                </div>
                <p className="text-4xl font-bold text-white mb-1">
                  {stats?.approved_requests || 0}
                </p>
                <p className="text-blue-200 text-sm">In Queue</p>
              </div>

              {/* Unique Requesters */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 text-purple-400" />
                  <span className="text-blue-200 text-sm">Guests</span>
                </div>
                <p className="text-4xl font-bold text-white mb-1">
                  {stats?.unique_requesters || 0}
                </p>
                <p className="text-blue-200 text-sm">Unique Requesters</p>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Requests */}
              <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Recent Requests</h2>
                  <Link
                    href={`/${username}/admin/requests`}
                    className="text-blue-300 hover:text-white text-sm transition-colors"
                  >
                    View All →
                  </Link>
                </div>

                {recentRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <List className="w-16 h-16 text-blue-300/50 mx-auto mb-4" />
                    <p className="text-blue-200">No requests yet</p>
                    <p className="text-blue-300/70 text-sm mt-2">
                      Share your request page to start receiving song requests
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-white font-semibold">{request.track_name}</p>
                            <p className="text-blue-200 text-sm">{request.artist_name}</p>
                            <p className="text-blue-300/70 text-xs mt-1">
                              Requested by {request.requester_nickname || 'Anonymous'}
                            </p>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              request.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : request.status === 'approved'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions & Status */}
              <div className="space-y-6">
                {/* Spotify Status */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Radio className="w-5 h-5" />
                    Spotify Status
                  </h3>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        stats?.spotify_connected ? 'bg-green-400' : 'bg-red-400'
                      } animate-pulse`}
                    />
                    <span className="text-white font-medium">
                      {stats?.spotify_connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  {!stats?.spotify_connected && (
                    <Link
                      href={`/${username}/admin/spotify`}
                      className="mt-4 block w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-center rounded-lg transition-colors text-sm font-semibold"
                    >
                      Connect Spotify
                    </Link>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                  <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Link
                      href={`/${username}/admin/requests`}
                      className="block w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm text-center border border-white/10"
                    >
                      Manage Requests
                    </Link>
                    <Link
                      href={`/${username}/admin/settings`}
                      className="block w-full px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm text-center border border-white/10"
                    >
                      Event Settings
                    </Link>
                    <Link
                      href={`/${username}/display`}
                      className="block w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg transition-colors text-sm text-center font-semibold"
                    >
                      Open Display Screen
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
