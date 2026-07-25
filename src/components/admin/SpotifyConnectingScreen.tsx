/**
 * Full-panel connecting / error state for Spotify OAuth.
 * Shown until connection is confirmed so disconnected UI never flashes.
 */

'use client';

import { Loader2, AlertCircle, Music } from 'lucide-react';

interface SpotifyConnectingScreenProps {
  phase: 'connecting' | 'error';
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}

export default function SpotifyConnectingScreen({
  phase,
  errorMessage,
  onRetry,
  className = '',
}: SpotifyConnectingScreenProps) {
  if (phase === 'error') {
    return (
      <div
        className={`flex items-center justify-center min-h-[420px] ${className}`}
        role="alert"
      >
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-900/20 border border-red-600/50">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="font-display text-xl font-semibold text-bone mb-2">
            Could not connect to Spotify
          </h2>
          <p className="text-muted text-sm mb-6">
            {errorMessage ||
              'Something went wrong while connecting. You can try again when ready.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-accent hover:bg-accent-hover text-ink font-medium text-sm rounded-lg transition-colors"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center min-h-[420px] ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="text-center max-w-md px-6">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-surface border border-white/10">
          <Music className="h-6 w-6 text-accent" />
        </div>
        <h2 className="font-display text-xl font-semibold text-bone mb-2">
          Connecting to Spotify...
        </h2>
        <p className="text-muted text-sm mb-6">
          Finishing authorization and confirming your account is ready.
        </p>
        <Loader2 className="h-8 w-8 text-accent animate-spin mx-auto" />
      </div>
    </div>
  );
}
