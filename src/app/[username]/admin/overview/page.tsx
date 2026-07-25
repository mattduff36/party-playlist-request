/**
 * Admin Overview Page - Multi-Tenant Architecture
 * 
 * Clean rebuild with JWT auth (no legacy AdminAuthContext)
 * All features preserved from single-user version
 */

'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import StateControlPanel from '@/components/admin/StateControlPanel';
import PageControlPanel from '@/components/admin/PageControlPanel';
import SpotifyConnectingScreen from '@/components/admin/SpotifyConnectingScreen';
import RequestManagementPanel from '@/components/admin/RequestManagementPanel';
import { useGlobalEvent } from '@/lib/state/global-event-client';

export default function AdminOverviewPage() {
  const { state } = useGlobalEvent();
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    songRequests: true,
  });
  
  const [isRedirectingSpotifyOAuth, setIsRedirectingSpotifyOAuth] = useState(false);
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Legacy OAuth return URLs pointed at overview. Forward to the Spotify page
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
  
  // Wait for event state hydrate (default offline is not authoritative)
  if (!state || state.isLoading || !state.pagesEnabled) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
        <p className="text-muted mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Main Control Panels - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StateControlPanel />
        <PageControlPanel />
      </div>

      {/* Request Management */}
      <div className="border border-white/10 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('songRequests')}
          className="w-full flex items-center justify-between p-4 bg-elevated hover:bg-surface/70 transition-colors"
        >
          <h3 className="font-display text-lg font-semibold text-bone flex items-center">
            Song Requests
          </h3>
          {expandedSections.songRequests ? (
            <ChevronUp className="w-5 h-5 text-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted" />
          )}
        </button>
        
        {expandedSections.songRequests && (
          <div className="bg-ink">
            <RequestManagementPanel showHeader={false} />
          </div>
        )}
      </div>
    </div>
  );
}
