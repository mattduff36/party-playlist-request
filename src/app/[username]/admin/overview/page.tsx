/**
 * Admin Overview Page - Multi-Tenant Architecture
 * 
 * Clean rebuild with JWT auth (no legacy AdminAuthContext)
 * All features preserved from single-user version
 */

'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Volume2, Monitor, Smartphone, Music } from 'lucide-react';
import StateControlPanel from '@/components/admin/StateControlPanel';
import PageControlPanel from '@/components/admin/PageControlPanel';
import SpotifyStatusDisplay from '@/components/admin/SpotifyStatusDisplay';
import RequestManagementPanel from '@/components/admin/RequestManagementPanel';
import { SpotifyErrorBoundary } from '@/components/error/SpotifyErrorBoundary';
import { useGlobalEvent } from '@/lib/state/global-event-client';

export default function AdminOverviewPage() {
  const { state } = useGlobalEvent();
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    spotifyStatus: true,
    songRequests: true,
  });
  
  // Spotify status for header display
  const [spotifyStatus, setSpotifyStatus] = useState<any>(null);
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Fetch Spotify status for header display
  useEffect(() => {
    if (state?.status === 'live' || state?.status === 'standby') {
      fetchSpotifyStatus();
      const interval = setInterval(fetchSpotifyStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [state?.status]);
  
  const fetchSpotifyStatus = async () => {
    try {
      const response = await fetch('/api/spotify/status');
      const data = await response.json();
      if (response.ok) {
        setSpotifyStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch Spotify status:', error);
    }
  };
  
  const getDeviceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'computer':
        return Monitor;
      case 'smartphone':
        return Smartphone;
      default:
        return Music;
    }
  };
  
  // Handle OAuth callback from Spotify
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const oauthState = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('Spotify authorization failed:', error);
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code && oauthState) {
      console.log('Processing Spotify callback...');
      handleSpotifyCallback(code, oauthState);
    }
  }, []);

  const handleSpotifyCallback = async (code: string, oauthState: string) => {
    const storedState = localStorage.getItem('spotify_state');
    const codeVerifier = localStorage.getItem('spotify_code_verifier');

    console.log('Processing Spotify callback:', {
      hasCode: !!code,
      hasState: !!oauthState,
      hasStoredState: !!storedState,
      hasCodeVerifier: !!codeVerifier,
      stateMatches: oauthState === storedState
    });

    if (!storedState || oauthState !== storedState) {
      console.error('State mismatch - possible CSRF attack');
      localStorage.removeItem('spotify_state');
      localStorage.removeItem('spotify_code_verifier');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!codeVerifier) {
      console.error('No code verifier found in localStorage');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    try {
      // JWT auth is handled by HTTP-only cookies automatically
      const response = await fetch('/api/spotify/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({
          code,
          state: oauthState,
          code_verifier: codeVerifier
        })
      });

      if (response.ok) {
        console.log('✅ Spotify connected successfully!');
        // Clean up OAuth data
        localStorage.removeItem('spotify_state');
        localStorage.removeItem('spotify_code_verifier');
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        // Force a refresh of the page to show updated status
        window.location.reload();
      } else {
        const errorData = await response.json();
        console.error('Failed to exchange code for token:', errorData);
        localStorage.removeItem('spotify_state');
        localStorage.removeItem('spotify_code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('Error during Spotify callback:', error);
      localStorage.removeItem('spotify_state');
      localStorage.removeItem('spotify_code_verifier');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };
  
  // Safety check - ensure pagesEnabled exists
  if (!state || !state.pagesEnabled) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Main Control Panels - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StateControlPanel />
          <PageControlPanel />
        </div>

        {/* Spotify Status - Only show when event is Standby or Live */}
        {(state.status === 'standby' || state.status === 'live') && (
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('spotifyStatus')}
              className="w-full flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white flex items-center">
                🎵 Spotify Status
              </h3>
              <div className="flex items-center gap-3">
                {spotifyStatus?.connected && spotifyStatus?.device && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg">
                    {(() => {
                      const DeviceIcon = getDeviceIcon(spotifyStatus.device.type);
                      return <DeviceIcon className="w-4 h-4 text-gray-400" />;
                    })()}
                    <span className="text-xs text-gray-300">{spotifyStatus.device.name}</span>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Volume2 className="w-3 h-3" />
                      <span className="text-xs">{spotifyStatus.device.volume_percent}%</span>
                    </div>
                  </div>
                )}
                {spotifyStatus?.connected === false && (
                  <span className="text-sm text-gray-400 px-3 py-1.5 bg-gray-700/50 rounded-lg">Not Connected</span>
                )}
                {expandedSections.spotifyStatus ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
            
            {expandedSections.spotifyStatus && (
              <div className="bg-gray-900">
                <SpotifyErrorBoundary>
                  <SpotifyStatusDisplay showHeader={false} />
                </SpotifyErrorBoundary>
              </div>
            )}
          </div>
        )}

        {/* Request Management - Full Width */}
        <div className="border border-gray-700 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('songRequests')}
            className="w-full flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-700/70 transition-colors"
          >
            <h3 className="text-lg font-semibold text-white flex items-center">
              🎶 Song Requests
            </h3>
            {expandedSections.songRequests ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          {expandedSections.songRequests && (
            <div className="bg-gray-900">
              <RequestManagementPanel showHeader={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
