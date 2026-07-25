'use client';

import type { CSSProperties } from 'react';
import { ListMusic, Music } from 'lucide-react';
import type { QueueItem, QueueVariant } from './types';

interface QueuePanelProps {
  variant: QueueVariant;
  upcomingSongs: QueueItem[];
  animatingCards: Set<string>;
  sanitizeName: (name?: string) => string;
  style?: CSSProperties;
}

interface UpNextHeadingProps {
  className?: string;
  iconClassName?: string;
}

function UpNextHeading({
  className = '',
  iconClassName = 'h-5 w-5',
}: UpNextHeadingProps) {
  return (
    <h2 className={`flex items-center justify-center gap-2 font-semibold ${className}`}>
      <ListMusic className={`${iconClassName} mood-accent-text shrink-0`} aria-hidden="true" />
      Up Next
    </h2>
  );
}

export default function QueuePanel({
  variant,
  upcomingSongs,
  animatingCards,
  sanitizeName,
  style,
}: QueuePanelProps) {
  if (variant === 'tv') {
    return (
      <div className="flex flex-col min-h-0 min-w-0" style={style}>
        {upcomingSongs.length > 0 ? (
          <div className="mood-panel p-6 flex flex-col h-full min-h-0 relative">
            <UpNextHeading className="text-3xl mb-6 flex-shrink-0" iconClassName="h-7 w-7" />
            <div
              className="space-y-3 overflow-y-auto flex-1 min-h-0 scrollbar-hide relative"
              data-up-next-container
            >
              {upcomingSongs.map((song, index) => {
                const isAnimating = animatingCards.has(song.uri);
                if (isAnimating) {
                  console.log(`🎨 Rendering animated card for: ${song.name} (${song.uri})`);
                }
                return (
                  <div
                    key={`${song.uri || 'unknown'}-${index}`}
                    className={`flex items-center justify-between p-3 mood-inset rounded-lg transition-all duration-1000 ${
                      isAnimating
                        ? 'bg-[color:var(--mood-accent)]/20 border border-[color:var(--mood-accent)]/50 shadow-lg shadow-[0_0_25px_color-mix(in_srgb,var(--mood-accent)_25%,transparent)]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Music className="h-5 w-5 mood-accent-text flex-shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold truncate">{song.name}</h4>
                        <p className="text-[color:var(--mood-muted)] text-sm truncate">
                          {song.artists && song.artists.length > 0
                            ? song.artists.filter((a) => a).join(', ')
                            : 'Unknown Artist'}
                        </p>
                      </div>
                    </div>
                    {song.requester_nickname && (
                      <div className="flex-shrink-0 ml-3">
                        <div className="mood-accent-bg px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                          {sanitizeName(song.requester_nickname)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mood-panel p-6 flex flex-col h-full min-h-0 items-center justify-center">
            <div className="text-center text-[color:var(--mood-muted)] text-xl">No upcoming songs in queue</div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-landscape') {
    return (
      <div className="flex flex-col min-h-0 min-w-0" style={style}>
        {upcomingSongs.length > 0 ? (
          <div className="mood-panel p-4 flex flex-col h-full min-h-0 relative">
            <UpNextHeading className="text-xl mb-4 flex-shrink-0" iconClassName="h-5 w-5" />
            <div
              className="space-y-2 overflow-y-auto flex-1 min-h-0 scrollbar-hide"
              data-up-next-container
            >
              {upcomingSongs.map((song, index) => (
                <div
                  key={`${song.uri || 'unknown'}-${index}`}
                  className={`flex items-center justify-between p-2 mood-inset rounded-lg transition-all duration-1000 ${
                    animatingCards.has(song.uri)
                      ? 'bg-[color:var(--mood-accent)]/20 border border-[color:var(--mood-accent)]/50 shadow-lg shadow-[0_0_25px_color-mix(in_srgb,var(--mood-accent)_25%,transparent)]'
                      : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-sm">{song.name}</div>
                    <div className="text-xs text-[color:var(--mood-muted)] truncate">
                      {song.artists && song.artists.length > 0
                        ? song.artists.filter((a) => a).join(', ')
                        : 'Unknown Artist'}
                    </div>
                  </div>
                  {song.requester_nickname && (
                    <div className="flex-shrink-0 ml-2">
                      <div className="mood-accent-bg px-2 py-1 rounded-full text-xs font-bold">
                        {sanitizeName(song.requester_nickname)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mood-panel p-4 flex flex-col h-full min-h-0 items-center justify-center">
            <p className="text-[color:var(--mood-muted)] text-center text-base">No upcoming songs in queue</p>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-portrait') {
    return (
      <div className="mood-panel p-4 flex-1 min-h-0 overflow-hidden mb-4 relative">
        <UpNextHeading className="text-xl mb-3 justify-start" iconClassName="h-5 w-5" />
        {upcomingSongs.length > 0 ? (
          <>
            <div className="space-y-2 overflow-y-auto h-full scrollbar-hide">
              {upcomingSongs.map((song, index) => (
                <div
                  key={`${song.uri || 'unknown'}-${index}`}
                  className={`flex items-center justify-between p-3 mood-inset rounded-lg transition-all duration-1000 ${
                    animatingCards.has(song.uri)
                      ? 'bg-[color:var(--mood-accent)]/20 border border-[color:var(--mood-accent)]/50 shadow-lg shadow-[0_0_25px_color-mix(in_srgb,var(--mood-accent)_25%,transparent)]'
                      : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{song.name}</div>
                    <div className="text-sm text-[color:var(--mood-muted)] truncate">
                      {song.artists && song.artists.length > 0
                        ? song.artists.filter((a) => a).join(', ')
                        : 'Unknown Artist'}
                    </div>
                  </div>
                  {song.requester_nickname && (
                    <div className="flex-shrink-0 ml-3">
                      <div className="mood-accent-bg px-3 py-1 rounded-full text-sm font-bold">
                        {sanitizeName(song.requester_nickname)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[color:var(--mood-muted)] text-center">No upcoming songs in queue</p>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'mobile-landscape') {
    return (
      <div className="flex flex-col min-h-0 min-w-0" style={style}>
        {upcomingSongs.length > 0 ? (
          <div className="mood-panel p-2 h-full relative">
            <UpNextHeading className="text-sm mb-2" iconClassName="h-3.5 w-3.5" />
            <div className="space-y-1 overflow-y-auto h-full scrollbar-hide">
              {upcomingSongs.map((song, index) => (
                <div
                  key={`${song.uri || 'unknown'}-${index}`}
                  className={`flex items-center justify-between p-1 mood-inset rounded transition-all duration-1000 ${
                    animatingCards.has(song.uri)
                      ? 'bg-[color:var(--mood-accent)]/20 border border-[color:var(--mood-accent)]/50 shadow-lg shadow-[0_0_25px_color-mix(in_srgb,var(--mood-accent)_25%,transparent)]'
                      : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-xs">{song.name}</div>
                    <div className="text-xs text-[color:var(--mood-muted)] truncate">
                      {song.artists && song.artists.length > 0
                        ? song.artists.filter((a) => a).join(', ')
                        : 'Unknown Artist'}
                    </div>
                  </div>
                  {song.requester_nickname && (
                    <div className="flex-shrink-0 ml-1">
                      <div className="mood-accent-bg px-1 py-0.5 rounded-full text-xs font-bold">
                        {sanitizeName(song.requester_nickname)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mood-panel p-2 h-full flex items-center justify-center">
            <p className="text-[color:var(--mood-muted)] text-center text-xs">No upcoming songs in queue</p>
          </div>
        )}
      </div>
    );
  }

  // mobile-portrait
  return (
    <div className="mood-panel p-3 flex-1 min-h-0 overflow-hidden mb-3 relative">
      <UpNextHeading className="text-base mb-2 justify-start" iconClassName="h-4 w-4" />
      {upcomingSongs.length > 0 ? (
        <>
          <div className="space-y-2 overflow-y-auto h-full scrollbar-hide">
            {upcomingSongs.map((song, index) => (
              <div
                key={`${song.uri || 'unknown'}-${index}`}
                className={`flex items-center justify-between p-2 mood-inset rounded text-xs transition-all duration-1000 ${
                  animatingCards.has(song.uri)
                    ? 'bg-[color:var(--mood-accent)]/20 border border-[color:var(--mood-accent)]/50 shadow-lg shadow-[0_0_25px_color-mix(in_srgb,var(--mood-accent)_25%,transparent)]'
                    : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{song.name}</div>
                  <div className="text-[color:var(--mood-muted)] truncate">
                    {song.artists && song.artists.length > 0
                      ? song.artists.filter((a) => a).join(', ')
                      : 'Unknown Artist'}
                  </div>
                </div>
                {song.requester_nickname && (
                  <div className="flex-shrink-0 ml-2">
                    <div className="mood-accent-bg px-2 py-1 rounded-full text-xs font-bold">
                      {sanitizeName(song.requester_nickname)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-[color:var(--mood-muted)] text-center text-sm">No upcoming songs in queue</p>
        </div>
      )}
    </div>
  );
}
