'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Music2, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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

  // Authenticated - show request form (use existing request form component)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center">
                <Music2 className="h-8 w-8 text-purple-400 mr-3" />
                Request a Song
              </h1>
              {eventData?.name && (
                <p className="text-gray-400 mt-2">{eventData.name}</p>
              )}
            </div>
            <div className="flex items-center text-green-400">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span className="text-sm">Authenticated</span>
            </div>
          </div>

          {/* TODO: Import and use the actual RequestForm component */}
          <div className="bg-gray-700 rounded-lg p-6 text-center">
            <Music2 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-300 text-lg">
              Song request form will be integrated here
            </p>
            <p className="text-gray-500 text-sm mt-2">
              (Using existing RequestForm component from main request page)
            </p>
          </div>

          <button
            onClick={() => {
              sessionStorage.removeItem(`event_auth_${username}`);
              setAuthenticated(false);
              setPin('');
            }}
            className="mt-6 w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

