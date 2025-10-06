/**
 * Admin Overview Page - Multi-Tenant Architecture
 * 
 * Clean rebuild with JWT auth (no legacy AdminAuthContext)
 * All features preserved from single-user version
 */

'use client';

import { useEffect } from 'react';
import StateControlPanel from '@/components/admin/StateControlPanel';
import PageControlPanel from '@/components/admin/PageControlPanel';
import SpotifyStatusDisplay from '@/components/admin/SpotifyStatusDisplay';
import RequestManagementPanel from '@/components/admin/RequestManagementPanel';
import EventInfoPanel from '@/components/admin/EventInfoPanel';
import { SpotifyErrorBoundary } from '@/components/error/SpotifyErrorBoundary';
import { useGlobalEvent } from '@/lib/state/global-event-client';

export default function AdminOverviewPage() {
  const { state } = useGlobalEvent();
  
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
        
        {/* Event Information Panel - NEW for multi-tenant */}
        <EventInfoPanel />
        
        {/* Main Control Panels - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StateControlPanel />
          <PageControlPanel />
        </div>

        {/* Spotify Status - Only show when event is Standby or Live */}
        {(state.status === 'standby' || state.status === 'live') && (
          <SpotifyErrorBoundary>
            <SpotifyStatusDisplay />
          </SpotifyErrorBoundary>
        )}

        {/* Request Management - Full Width */}
        <RequestManagementPanel />
      </div>
    </div>
  );
}
