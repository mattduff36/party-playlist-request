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

  // Authenticated - show display page with real-time updates
  return <AuthenticatedDisplayPage username={username} eventData={eventData} />;
}

// Separate component for authenticated display functionality
function AuthenticatedDisplayPage({ username, eventData }: { username: string; eventData: any }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [nowPlaying, setNowPlaying] = useState<any | null>(null);
  const [eventConfig, setEventConfig] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchDisplayData();
  }, [username]);

  const fetchDisplayData = async () => {
    try {
      // Fetch requests (approved/pending)
      const reqResponse = await fetch(`/api/public/requests?username=${username}`);
      if (reqResponse.ok) {
        const reqData = await reqResponse.json();
        setRequests(reqData.requests || []);
      }

      // Fetch now playing
      const playingResponse = await fetch(`/api/public/now-playing?username=${username}`);
      if (playingResponse.ok) {
        const playingData = await playingResponse.json();
        setNowPlaying(playingData.nowPlaying);
      }

      // Fetch event config
      const configResponse = await fetch(`/api/public/event-config?username=${username}`);
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setEventConfig(configData.config);
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching display data:', error);
    }
  };

  // Set up Pusher for real-time updates
  useEffect(() => {
    // Use dynamic import to avoid SSR issues
    const setupPusher = async () => {
      const Pusher = (await import('pusher-js')).default;
      
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      });

      const channel = pusher.subscribe('party-playlist');

      // Listen for request updates
      channel.bind('request-submitted', (data: any) => {
        console.log('🆕 Request submitted:', data);
        fetchDisplayData(); // Refresh data
      });

      channel.bind('request-approved', (data: any) => {
        console.log('✅ Request approved:', data);
        fetchDisplayData(); // Refresh data
      });

      // Listen for playback updates
      channel.bind('playback-update', (data: any) => {
        console.log('🎵 Playback update:', data);
        if (data.current_track) {
          setNowPlaying({
            track_name: data.current_track.name,
            artist_name: data.current_track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
            album_name: data.current_track.album?.name || 'Unknown Album',
            duration_ms: data.current_track.duration_ms || 0,
            progress_ms: data.progress_ms || 0,
            is_playing: data.is_playing || false,
          });
        }
        setLastUpdate(new Date());
      });

      return () => {
        channel.unbind_all();
        channel.unsubscribe();
        pusher.disconnect();
      };
    };

    setupPusher();
  }, [username]);

  // Auto-refresh every 30 seconds as backup
  useEffect(() => {
    const interval = setInterval(fetchDisplayData, 30000);
    return () => clearInterval(interval);
  }, [username]);

  // Import DisplayContent dynamically
  const DisplayContent = require('@/components/DisplayContent').default;

  return (
    <DisplayContent
      eventConfig={{
        event_title: eventConfig?.event_title || `${username}'s Party Playlist`,
        welcome_message: eventConfig?.welcome_message || 'Request your favorite songs!',
        secondary_message: eventConfig?.secondary_message || 'Your requests will be reviewed by the DJ',
        tertiary_message: eventConfig?.tertiary_message || 'Keep the party going!',
      }}
      requests={requests}
      nowPlaying={nowPlaying}
      lastUpdate={lastUpdate}
    />
  );
}

