'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Lock } from 'lucide-react';
import PageLoader from '@/components/ui/PageLoader';

interface DisplayAuthGateProps {
  children: (username: string) => ReactNode;
}

export default function DisplayAuthGate({ children }: DisplayAuthGateProps) {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, [username]);

  async function checkAuth() {
    setLoading(true);
    setError(null);

    try {
      // First, check session storage for PIN-based auth
      const stored = sessionStorage.getItem(`display_auth_${username}`);
      if (stored) {
        try {
          const auth = JSON.parse(stored);
          // Check if auth is still valid (24 hours)
          if (Date.now() - auth.timestamp < 24 * 60 * 60 * 1000) {
            console.log('✅ Display authenticated via sessionStorage (PIN-based)');
            setAuthenticated(true);
            setLoading(false);
            return;
          } else {
            console.log('⏰ Session expired, clearing...');
            sessionStorage.removeItem(`display_auth_${username}`);
          }
        } catch (e) {
          console.error('Invalid session data:', e);
          sessionStorage.removeItem(`display_auth_${username}`);
        }
      }

      // Check if user is logged in as the owner
      const meResponse = await fetch('/api/auth/me');

      if (meResponse.ok) {
        const { user } = await meResponse.json();

        if (user.username === username) {
          console.log(`✅ User ${user.username} accessing display page (owner)`);
          setAuthenticated(true);
          setLoading(false);
          return;
        } else {
          setError(`You're logged in as ${user.username} but trying to access ${username}'s display.`);
          setLoading(false);
          return;
        }
      }

      // Not authenticated - need PIN
      console.log('🔐 No valid authentication found, need PIN');
      setError(`To access the display screen, use the URL: /${username}/display/[PIN] (where [PIN] is your 4-digit event PIN from the admin panel)`);
      setLoading(false);
    } catch (err) {
      console.error('Display auth error:', err);
      setError('Failed to authenticate. Please try again.');
      setLoading(false);
    }
  }

  if (loading) {
    return <PageLoader label="Loading display..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ink text-bone flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-elevated rounded-xl shadow-2xl p-8 border border-white/10">
          <div className="flex flex-col items-center mb-6">
            <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
            <h1 className="text-2xl font-bold text-center mb-2">Access Denied</h1>
          </div>

          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            <p>{error}</p>
          </div>

          {error.includes('logged in as') && (
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-accent hover:bg-accent-hover text-ink font-bold py-3 px-4 rounded-lg transition-colors duration-300 mb-3"
            >
              <Lock className="inline h-5 w-5 mr-2" />
              Switch Account
            </button>
          )}

          <button
            onClick={() => router.push('/login')}
            className="w-full bg-white/10 hover:bg-white/15 text-bone font-medium py-2 px-4 rounded-lg transition-colors duration-300"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children(username)}</>;
}
