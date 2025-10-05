'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Monitor, AlertCircle, Loader2, Lock } from 'lucide-react';

export default function UserDisplayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const username = params.username as string;
  const displayToken = searchParams.get('dt');

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventData, setEventData] = useState<any>(null);

  useEffect(() => {
    async function checkAuth() {
      setLoading(true);
      setError(null);

      try {
        // Check if user is logged in as the owner
        const meResponse = await fetch('/api/auth/me');
        
        if (meResponse.ok) {
          const { user } = await meResponse.json();
          
          // If logged in as the correct user, allow access
          if (user.username === username) {
            console.log(`✅ User ${user.username} is accessing their own display page`);
            setAuthenticated(true);
            setLoading(false);
            return;
          } else {
            // Logged in but as wrong user
            setError(`You're logged in as ${user.username} but trying to access ${username}'s display.`);
            setLoading(false);
            return;
          }
        }

        // Not logged in, check for display token
        if (!displayToken) {
          setError('Login to access your display page, or use a valid display token.');
          setLoading(false);
          return;
        }

        // Verify display token
        const verifyResponse = await fetch('/api/events/verify-display-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, displayToken })
        });

        const verifyData = await verifyResponse.json();

        if (verifyResponse.ok) {
          setAuthenticated(true);
          setEventData(verifyData.event);
          
          // Store token in session for persistence
          sessionStorage.setItem(`display_auth_${username}`, JSON.stringify({
            token: displayToken,
            eventId: verifyData.event.id,
            timestamp: Date.now()
          }));
        } else {
          setError(verifyData.error || 'Invalid or expired display token.');
        }
      } catch (err) {
        console.error('Display auth error:', err);
        setError('Failed to authenticate. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [username, displayToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-lg">Loading display page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <div className="flex flex-col items-center mb-6">
            <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
            <h1 className="text-2xl font-bold text-center mb-2">Access Denied</h1>
          </div>

          <div className="bg-red-900 bg-opacity-30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            <p>{error}</p>
          </div>

          {error.includes('logged in as') && (
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 mb-3"
            >
              <Lock className="inline h-5 w-5 mr-2" />
              Switch Account
            </button>
          )}

          <button
            onClick={() => router.push('/login')}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null; // Should not reach here
  }

  // Authenticated - show display page
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
      <div className="max-w-7xl mx-auto py-8">
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold flex items-center">
              <Monitor className="h-10 w-10 text-purple-400 mr-4" />
              {username}'s Display
            </h1>
            {eventData?.name && (
              <span className="text-gray-400 text-lg">{eventData.name}</span>
            )}
          </div>

          {/* TODO: Import and use the actual Display component */}
          <div className="bg-gray-700 rounded-lg p-12 text-center">
            <Monitor className="h-24 w-24 text-gray-500 mx-auto mb-6" />
            <p className="text-gray-300 text-xl mb-4">
              Display page content will be integrated here
            </p>
            <p className="text-gray-500">
              (Using existing display page components from main display page)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

