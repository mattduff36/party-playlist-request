'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SpotifySetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Check for admin token and initialize
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (!savedToken) {
      router.push('/admin');
      return;
    }
    
    // Clear any stale error messages when page loads normally
    const urlParams = new URLSearchParams(window.location.search);
    const hasCallbackParams = urlParams.has('code') || urlParams.has('error');
    if (!hasCallbackParams) {
      setError(''); // Clear errors for normal page visits
    }
    
    checkSpotifyConnection(savedToken);
  }, []);

  // Handle OAuth callback from Spotify
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setError(`Spotify authorization failed: ${error}`);
      setIsLoading(false);
      return;
    }

    if (code && state) {
      console.log('Processing Spotify callback:', {
        hasCode: !!code,
        hasState: !!state,
        hasStoredState: !!localStorage.getItem('spotify_state'),
        hasCodeVerifier: !!localStorage.getItem('spotify_code_verifier')
      });
      
      handleSpotifyCallback(code, state);
    }
  }, []);

  const checkSpotifyConnection = async (authToken: string) => {
    try {
      setIsCheckingStatus(true);
      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.spotify_connected || false);
        
        // Clear any previous error messages if we successfully got status
        if (data.spotify_connected) {
          setError(''); // Clear errors when successfully connected
        }
      } else {
        const errorText = await response.text();
        console.error('Stats API error:', response.status, errorText);
        setError(`Failed to check Spotify connection status (${response.status})`);
      }
    } catch (error) {
      console.error('Error checking Spotify connection:', error);
      setError(`Failed to check Spotify connection status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSpotifyCallback = async (code: string, state: string) => {
    const storedState = localStorage.getItem('spotify_state');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    console.log('Processing Spotify callback:', {
      hasCode: !!code,
      hasState: !!state,
      hasStoredState: !!storedState,
      hasCodeVerifier: !!codeVerifier,
      stateMatches: state === storedState
    });

    // Clear errors at the start of processing
    setError('');

    if (!storedState) {
      console.error('OAuth callback failed: No stored state found in localStorage');
      setError('Authentication failed: No stored state found. This may be due to browser security settings or cookies being disabled. Please try connecting again.');
      return;
    }

    if (!codeVerifier) {
      console.error('OAuth callback failed: No code verifier found in localStorage');
      setError('Authentication failed: No code verifier found. This may be due to browser security settings or cookies being disabled. Please try connecting again.');
      return;
    }

    if (state !== storedState) {
      console.error('OAuth callback failed: State parameter mismatch', { received: state, stored: storedState });
      setError('Authentication failed: Invalid state parameter. This may be a security issue.');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/spotify/callback', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          state,
          code_verifier: codeVerifier
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Spotify callback response:', data);
        setSuccess('Spotify authentication successful! Redirecting back to admin panel...');
        setError(''); // Clear any errors
        setIsConnected(true);
        
        // Clean up localStorage
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_state');
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, '/admin/spotify-setup');
        
        // Redirect back to admin after a short delay to show success message
        setTimeout(() => {
          setSuccess(''); // Clear success message before redirect
          router.push('/admin?spotify_connected=true');
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(`Authentication failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Spotify callback error:', error);
      const errorMessage = error.message || 'Failed to complete Spotify authentication';
      setError(`Authentication failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const connectSpotify = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/spotify/auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.auth_url && data.state && data.code_verifier) {
          // Store state and code verifier for OAuth callback verification
          localStorage.setItem('spotify_state', data.state);
          localStorage.setItem('spotify_code_verifier', data.code_verifier);
          
          console.log('Stored OAuth data:', {
            hasState: !!data.state,
            hasCodeVerifier: !!data.code_verifier,
            authUrlLength: data.auth_url.length
          });
          
          // Verify localStorage was set correctly before redirect
          const verifyState = localStorage.getItem('spotify_state');
          const verifyCodeVerifier = localStorage.getItem('spotify_code_verifier');
          
          console.log('Verifying localStorage before redirect:', {
            storedState: !!verifyState,
            storedCodeVerifier: !!verifyCodeVerifier,
            stateMatches: verifyState === data.state,
            codeVerifierMatches: verifyCodeVerifier === data.code_verifier
          });
          
          if (!verifyState || !verifyCodeVerifier) {
            setError('Failed to store OAuth data in browser. Please try again.');
            return;
          }
          
          // Small delay to ensure localStorage is fully written
          setTimeout(() => {
            console.log('Redirecting to Spotify...');
            window.location.href = data.auth_url;
          }, 100);
        } else {
          setError('Failed to get complete Spotify authorization data');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to initiate Spotify connection');
      }
    } catch (error: any) {
      console.error('Error connecting to Spotify:', error);
      setError(`Failed to connect to Spotify: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectSpotify = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/spotify/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        setIsConnected(false);
        setSuccess('Spotify disconnected successfully');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to disconnect Spotify');
        setSuccess(''); // Clear success message on error
      }
    } catch (error: any) {
      console.error('Error disconnecting Spotify:', error);
      setError(`Failed to disconnect Spotify: ${error.message}`);
      setSuccess(''); // Clear success message on error
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = async () => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      await checkSpotifyConnection(token);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold flex items-center">
              🎵 Spotify Setup
            </h1>
            <div className="flex gap-3">
              <button
                onClick={refreshStatus}
                disabled={isLoading || isCheckingStatus}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Back to Admin
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg">
              <p className="text-green-200">{success}</p>
            </div>
          )}

          {/* Connection Status */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Spotify Connection Status</h2>
            
            {isCheckingStatus ? (
              <div className="flex items-center text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
                Checking connection status...
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {isConnected ? (
                    <>
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-green-400 font-medium">Connected to Spotify</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                      <span className="text-red-400 font-medium">Not connected to Spotify</span>
                    </>
                  )}
                </div>
                
                <div className="flex gap-3">
                  {isConnected ? (
                    <button
                      onClick={disconnectSpotify}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Disconnecting...' : 'Disconnect Spotify'}
                    </button>
                  ) : (
                    <button
                      onClick={connectSpotify}
                      disabled={isLoading}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isLoading ? 'Connecting...' : 'Connect to Spotify'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">Instructions</h3>
            <div className="text-gray-300 space-y-2">
              {isConnected ? (
                <>
                  <p>✅ Your Spotify account is connected and ready to use.</p>
                  <p>You can now control Spotify playback from the admin panel.</p>
                  <p>If you experience any issues, try disconnecting and reconnecting.</p>
                </>
              ) : (
                <>
                  <p>1. Click "Connect to Spotify" to begin the authorization process</p>
                  <p>2. You'll be redirected to Spotify to grant permissions</p>
                  <p>3. After authorization, you'll be brought back here</p>
                  <p>4. Once connected, return to the admin panel to control playback</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}