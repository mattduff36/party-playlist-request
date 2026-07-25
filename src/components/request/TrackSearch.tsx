'use client';

import { PartyPopper, Search } from 'lucide-react';
import type { SearchFeedback, Track } from './types';

interface TrackSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: Track[];
  isSearching: boolean;
  searchFeedback: SearchFeedback | null;
  nickname: string;
  isNicknameValid: boolean;
  isSubmitting: boolean;
  onSelectTrack: (track: Track) => void;
  onDismissKeyboard: () => void;
}

const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function TrackSearch({
  query,
  onQueryChange,
  results,
  isSearching,
  searchFeedback,
  nickname,
  isNicknameValid,
  isSubmitting,
  onSelectTrack,
  onDismissKeyboard,
}: TrackSearchProps) {
  const canSearch = Boolean(nickname.trim() && isNicknameValid);

  return (
    <div
      className={`mood-inset backdrop-blur-md rounded-[var(--mood-radius)] p-4 border border-[color:var(--mood-border)] transition-opacity flex flex-col flex-1 ${
        !canSearch ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--mood-muted)]" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={
            !nickname.trim()
              ? 'Enter your name first'
              : !isNicknameValid
                ? 'Please enter a valid name'
                : 'Search songs, artists, or paste Spotify link'
          }
          className="w-full pl-10 pr-4 py-3 text-base mood-inset border border-[color:var(--mood-border)] rounded-[var(--mood-radius)] text-[color:var(--mood-text)] placeholder-[color:var(--mood-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--mood-accent)] focus:border-transparent"
          style={{
            fontSize: '16px',
            transform: 'translateZ(0)', // Prevent iOS zoom
            WebkitAppearance: 'none', // Remove iOS styling
            WebkitTextSizeAdjust: '100%', // Prevent iOS zoom
            textSizeAdjust: '100%', // Prevent iOS zoom
            zoom: '1', // Prevent iOS zoom
          }}
          disabled={!canSearch}
          onBlur={() => {
            // Dismiss keyboard when input loses focus
            setTimeout(() => onDismissKeyboard(), 100);
          }}
        />
      </div>

      {isSearching && canSearch && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--mood-accent)] mx-auto"></div>
          <p className="text-[color:var(--mood-muted)] mt-2">Searching...</p>
        </div>
      )}

      {searchFeedback && !isSearching && (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 rounded-lg border border-[color:var(--mood-accent)]/30 bg-[color:var(--mood-accent)]/10 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <PartyPopper className="h-5 w-5 mood-accent-text shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium mood-accent-text">Popular night!</p>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--mood-text)]">
                {searchFeedback.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && canSearch && (
        <div className="space-y-2 flex-1 overflow-y-auto mt-3" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {results.map((track) => (
            <button
              key={track.id}
              onClick={(e) => {
                e.preventDefault();
                onSelectTrack(track);
              }}
              disabled={isSubmitting || !canSearch}
              className="w-full mood-inset rounded-[var(--mood-radius)] p-3 border border-[color:var(--mood-border)] hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 text-left touch-manipulation"
            >
              <div className="flex items-center space-x-3">
                {track.image && (
                  <img
                    src={track.image}
                    alt={track.album}
                    className="w-12 h-12 rounded object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[color:var(--mood-text)] font-medium truncate text-sm">
                    {track.name}
                    {track.explicit && (
                      <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">
                        E
                      </span>
                    )}
                  </h3>
                  <p className="text-[color:var(--mood-muted)] text-xs truncate">
                    {track.artists.join(', ')} • {track.album}
                  </p>
                  <p className="text-[color:var(--mood-muted)] text-xs">
                    {formatDuration(track.duration_ms)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
