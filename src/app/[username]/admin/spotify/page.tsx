'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import SpotifyConnectingScreen from '@/components/admin/SpotifyConnectingScreen';
import SidebarSpotifyControls from '@/components/admin/SidebarSpotifyControls';
import { PlaylistBrowser } from '@/components/admin/PlaylistBrowser';
import { useAdminData } from '@/contexts/AdminDataContext';
import {
  clearSpotifyOAuthPending,
  completeSpotifyOAuthCallback,
  isSpotifyOAuthPending,
  markSpotifyOAuthPending,
  waitForSpotifyConnected,
} from '@/lib/spotify-oauth-client';

type OAuthGatePhase = 'idle' | 'connecting' | 'error';

export default function SpotifyPage() {
  const { spotifyConnected, setSpotifyConnected } = useAdminData();
  const [isConnected, setIsConnected] = useState(spotifyConnected);
  const [isLoading, setIsLoading] = useState(true);
  // 'booting' until client mount inspects the URL / pending flag (avoids hydration mismatch).
  const [oauthGatePhase, setOauthGatePhase] = useState<OAuthGatePhase | 'booting'>(
    'booting'
  );
  const [oauthError, setOauthError] = useState<string | null>(null);
  const oauthHandledRef = useRef(false);

  const fetchSpotifyStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Spotify status');
      }

      const data = await response.json();
      const connected = Boolean(data.connected);
      setIsConnected(connected);
      setSpotifyConnected(connected);
      return connected;
    } catch (error) {
      console.error('Failed to fetch Spotify status:', error);
      setIsConnected(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [setSpotifyConnected]);

  useEffect(() => {
    setIsConnected(spotifyConnected);
  }, [spotifyConnected]);

  const finishOAuthSuccess = useCallback(async () => {
    clearSpotifyOAuthPending();
    window.history.replaceState({}, document.title, window.location.pathname);
    await fetchSpotifyStatus();
    setIsConnected(true);
    setSpotifyConnected(true);
    setIsLoading(false);
    setOauthGatePhase('idle');
  }, [fetchSpotifyStatus, setSpotifyConnected]);

  const failOAuth = useCallback((message: string) => {
    clearSpotifyOAuthPending();
    window.history.replaceState({}, document.title, window.location.pathname);
    setOauthError(message);
    setOauthGatePhase('error');
    setIsLoading(false);
  }, []);

  const retrySpotifyConnect = useCallback(() => {
    markSpotifyOAuthPending();
    setOauthError(null);
    setOauthGatePhase('connecting');
    window.location.href = '/api/spotify/auth';
  }, []);

  // Handle return from Spotify OAuth (or pending connect flag)
  useEffect(() => {
    if (oauthHandledRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const oauthState = urlParams.get('state');
    const urlError = urlParams.get('error');
    const pending =
      isSpotifyOAuthPending() || urlParams.get('spotify') === 'connected';

    if (urlError && !code) {
      oauthHandledRef.current = true;
      failOAuth(
        urlError.startsWith('Spotify')
          ? urlError
          : `Spotify authorization failed: ${urlError}`
      );
      return;
    }

    if (code && oauthState) {
      oauthHandledRef.current = true;
      setOauthGatePhase('connecting');

      const processedKey = `oauth_processed_${oauthState}`;
      if (sessionStorage.getItem(processedKey)) {
        void (async () => {
          const waitResult = await waitForSpotifyConnected();
          if (waitResult.success) {
            await finishOAuthSuccess();
          } else {
            failOAuth(
              waitResult.error ||
                'Spotify connection is taking longer than expected. Please try again.'
            );
          }
        })();
        return;
      }

      sessionStorage.setItem(processedKey, 'true');

      void (async () => {
        const result = await completeSpotifyOAuthCallback(code, oauthState);
        if (!result.success) {
          failOAuth(result.error || 'Failed to complete Spotify connection');
          return;
        }

        const waitResult = await waitForSpotifyConnected();
        if (!waitResult.success) {
          failOAuth(
            waitResult.error ||
              'Spotify connection is taking longer than expected. Please try again.'
          );
          return;
        }

        await finishOAuthSuccess();
      })();
      return;
    }

    if (pending) {
      oauthHandledRef.current = true;
      setOauthGatePhase('connecting');

      void (async () => {
        const waitResult = await waitForSpotifyConnected();
        if (waitResult.success) {
          await finishOAuthSuccess();
        } else {
          failOAuth(
            waitResult.error ||
              'Spotify connection is taking longer than expected. Please try again.'
          );
        }
      })();
      return;
    }

    oauthHandledRef.current = true;
    setOauthGatePhase('idle');
  }, [failOAuth, finishOAuthSuccess]);

  // One-shot status for PlaylistBrowser; ongoing polls live in SidebarSpotifyControls / header dropdown
  useEffect(() => {
    if (oauthGatePhase !== 'idle') {
      return;
    }
    void fetchSpotifyStatus();
  }, [fetchSpotifyStatus, oauthGatePhase]);

  if (oauthGatePhase === 'connecting' || oauthGatePhase === 'error') {
    return (
      <SpotifyConnectingScreen
        phase={oauthGatePhase === 'error' ? 'error' : 'connecting'}
        errorMessage={oauthError}
        onRetry={oauthGatePhase === 'error' ? retrySpotifyConnect : undefined}
      />
    );
  }

  if (oauthGatePhase === 'booting' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
          <p className="text-muted">Loading Spotify...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SidebarSpotifyControls
        variant="page"
        onConnectionChange={setIsConnected}
      />
      <PlaylistBrowser isConnected={isConnected} />
    </div>
  );
}
