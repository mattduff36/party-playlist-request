/**
 * Admin Requests Page - Multi-Tenant Architecture
 *
 * Song request management for the DJ dashboard.
 */

'use client';

import { useEffect, useState } from 'react';
import SpotifyConnectingScreen from '@/components/admin/SpotifyConnectingScreen';
import RequestManagementPanel from '@/components/admin/RequestManagementPanel';
import { useGlobalEvent } from '@/lib/state/global-event-client';

export default function AdminRequestsPage() {
  const { state } = useGlobalEvent();
  const [isRedirectingSpotifyOAuth, setIsRedirectingSpotifyOAuth] = useState(false);

  // Legacy OAuth return URLs pointed at overview/requests. Forward to Spotify
  // so the connecting gate can finish without flashing "Not Connected".
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthReturn =
      urlParams.has('code') ||
      urlParams.has('state') ||
      urlParams.has('error') ||
      urlParams.get('spotify') === 'connected';

    if (!hasOAuthReturn) return;

    setIsRedirectingSpotifyOAuth(true);
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const username = pathParts[0] && pathParts[0] !== 'admin' ? pathParts[0] : null;
    const spotifyPath = username ? `/${username}/admin/spotify` : '/admin/spotify';
    window.location.replace(`${spotifyPath}${window.location.search}`);
  }, []);

  if (isRedirectingSpotifyOAuth) {
    return <SpotifyConnectingScreen phase="connecting" />;
  }

  // Wait for first event hydrate only (pagesEnabled is always an object)
  if (!state || (state.isLoading && !state.lastUpdated)) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
        <p className="text-muted mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-elevated border-b border-white/10">
          <h3 className="font-display text-lg font-semibold text-bone">Song Requests</h3>
        </div>
        <div className="bg-ink">
          <RequestManagementPanel showHeader={false} />
        </div>
      </div>
    </div>
  );
}
