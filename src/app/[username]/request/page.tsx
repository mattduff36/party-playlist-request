'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Music2, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import RequestForm from '@/components/RequestForm';

export default function UserRequestPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const bypassToken = searchParams.get('bt');

  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [eventData, setEventData] = useState<any>(null);

  // Auto-verify if bypass token is present
  useEffect(() => {
    if (bypassToken) {
      verifyAccess(undefined, bypassToken);
    }
  }, [bypassToken]);

  const verifyAccess = async (pinValue?: string, token?: string) => {
    setVerifying(true);
    setPinError('');

    try {
      const response = await fetch('/api/events/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          pin: pinValue,
          bypassToken: token
        })
      });

      const data = await response.json();

      if (response.ok) {
        setAuthenticated(true);
        setEventData(data.event);
        
        // Store auth in session
        sessionStorage.setItem(`event_auth_${username}`, JSON.stringify({
          eventId: data.event.id,
          authMethod: data.authMethod,
          timestamp: Date.now()
        }));
      } else {
        setPinError(data.error || 'Access denied');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setPinError('Connection error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      verifyAccess(pin);
    } else {
      setPinError('PIN must be 4 digits');
    }
  };

  // Check session storage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(`event_auth_${username}`);
    if (stored) {
      try {
        const auth = JSON.parse(stored);
        // Check if auth is still valid (within 24 hours)
        if (Date.now() - auth.timestamp < 24 * 60 * 60 * 1000) {
          setAuthenticated(true);
        }
      } catch (e) {
        // Invalid session data
        sessionStorage.removeItem(`event_auth_${username}`);
      }
    }
  }, [username]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <div className="flex flex-col items-center mb-8">
            <Music2 className="h-16 w-16 text-purple-400 mb-4" />
            <h1 className="text-3xl font-bold text-center">
              {username}'s Party Playlist
            </h1>
            <p className="text-gray-400 text-center mt-2">
              Enter the 4-digit PIN to request songs
            </p>
          </div>

          {pinError && (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center mb-6">
              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-6">
            <div>
              <label htmlFor="pin" className="block text-gray-300 text-sm font-medium mb-2">
                <Lock className="inline h-4 w-4 mr-2" />
                Event PIN
              </label>
              <input
                type="text"
                id="pin"
                maxLength={4}
                pattern="[0-9]{4}"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white text-center text-2xl tracking-widest font-mono"
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(value);
                  setPinError('');
                }}
                disabled={verifying}
                autoFocus
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={verifying || pin.length !== 4}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-5 w-5" />
                  Access Playlist
                </>
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            PIN displayed on the DJ's screen
          </p>
        </div>
      </div>
    );
  }

  // Authenticated - show request form with full functionality
  return <AuthenticatedRequestPage username={username} eventData={eventData} onLogout={() => {
    sessionStorage.removeItem(`event_auth_${username}`);
    setAuthenticated(false);
    setPin('');
  }} />;
}

// Separate component for authenticated request functionality
function AuthenticatedRequestPage({ username, eventData, onLogout }: { username: string; eventData: any; onLogout: () => void }) {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);

  // Load nickname from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`nickname_${username}`);
    if (saved) setNickname(saved);
  }, [username]);

  // Save nickname to localStorage
  const handleNicknameChange = (newNickname: string) => {
    setNickname(newNickname);
    localStorage.setItem(`nickname_${username}`, newNickname);
  };

  // Search for tracks
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.tracks || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Submit request
  const handleSubmitRequest = async (track: any) => {
    if (!nickname.trim()) {
      setRequestStatus('error');
      setStatusMessage('Please enter your nickname');
      setTimeout(() => setRequestStatus('idle'), 3000);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_uri: track.uri,
          track_name: track.name,
          artist_name: track.artists.join(', '),
          album_name: track.album,
          duration_ms: track.duration_ms,
          requester_nickname: nickname,
          username: username // For multi-tenancy
        })
      });

      const data = await response.json();

      if (response.ok) {
        setRequestStatus('success');
        setStatusMessage(data.message || 'Request submitted successfully!');
        setSearchResults([]); // Clear search
        setTimeout(() => setRequestStatus('idle'), 3000);
      } else {
        setRequestStatus('error');
        setStatusMessage(data.error || 'Failed to submit request');
        setTimeout(() => setRequestStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Submit error:', error);
      setRequestStatus('error');
      setStatusMessage('Connection error. Please try again.');
      setTimeout(() => setRequestStatus('idle'), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissNotifications = () => {
    setNotifications([]);
  };

  return (
    <>
      {/* Logout button - fixed in top right corner */}
      <button
        onClick={onLogout}
        className="fixed top-4 right-4 z-50 bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg transition-colors duration-300 flex items-center gap-2 shadow-lg border border-gray-700"
      >
        <Lock className="h-4 w-4" />
        Logout
      </button>

      <RequestForm
        eventConfig={{
          event_title: eventData?.name || `${username}'s Party Playlist`,
          welcome_message: 'Request your favorite songs!',
          secondary_message: 'Search and add tracks to the queue',
          tertiary_message: 'Have fun!'
        }}
        onSearch={handleSearch}
        onSubmitRequest={handleSubmitRequest}
        searchResults={searchResults}
        isSearching={isSearching}
        isSubmitting={isSubmitting}
        requestStatus={requestStatus}
        statusMessage={statusMessage}
        nickname={nickname}
        onNicknameChange={handleNicknameChange}
        notifications={notifications}
        onDismissNotifications={dismissNotifications}
      />
    </>
  );
}

