'use client';

import type { CSSProperties } from 'react';
import { ListMusic } from 'lucide-react';
import QueueTrackCover from '@/components/shared/QueueTrackCover';
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

interface QueueSongRowProps {
  song: QueueItem;
  index: number;
  isAnimating: boolean;
  sanitizeName: (name?: string) => string;
  /** Only TV historically had a per-row Music icon — covers replace that slot only. */
  showCover: boolean;
  coverSize?: 'sm' | 'md' | 'lg';
  rowClassName: string;
  titleClassName: string;
  artistClassName: string;
  badgeClassName: string;
  badgeWrapperClassName?: string;
}

function QueueSongRow({
  song,
  index,
  isAnimating,
  sanitizeName,
  showCover,
  coverSize = 'md',
  rowClassName,
  titleClassName,
  artistClassName,
  badgeClassName,
  badgeWrapperClassName = 'ml-3',
}: QueueSongRowProps) {
  return (
    <div
      key={`${song.uri || 'unknown'}-${index}`}
      className={`flex items-center justify-between mood-inset rounded-lg transition-all duration-1000 ${rowClassName} ${
        isAnimating
          ? 'bg-[color:var(--mood-accent)]/20 border border-[color:var(--mood-accent)]/50 shadow-lg shadow-[0_0_25px_color-mix(in_srgb,var(--mood-accent)_25%,transparent)]'
          : ''
      }`}
    >
      <div className={`flex-1 min-w-0 ${showCover ? 'flex items-center space-x-3' : ''}`}>
        {showCover && (
          <QueueTrackCover
            imageUrl={song.image_url}
            size={coverSize}
            className="bg-black/20"
            iconClassName="h-5 w-5 mood-accent-text"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold truncate ${titleClassName}`}>{song.name}</div>
          <p className={`text-[color:var(--mood-muted)] truncate ${artistClassName}`}>
            {song.artists && song.artists.length > 0
              ? song.artists.filter((a) => a).join(', ')
              : 'Unknown Artist'}
          </p>
        </div>
      </div>
      {song.requester_nickname && (
        <div className={`flex-shrink-0 ${badgeWrapperClassName}`}>
          <div className={`mood-accent-bg rounded-full font-bold ${badgeClassName}`}>
            {sanitizeName(song.requester_nickname)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QueuePanel({
  variant,
  upcomingSongs,
  animatingCards,
  sanitizeName,
  style,
}: QueuePanelProps) {
  // Per-row art only on TV — tablet/mobile rows never had a song icon (compact layouts).
  const showCover = variant === 'tv';

  if (variant === 'tv') {
    return (
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden h-full" style={style}>
        {upcomingSongs.length > 0 ? (
          <div className="mood-panel p-6 flex flex-col h-full min-h-0 overflow-hidden relative">
            <UpNextHeading className="text-3xl mb-6 flex-shrink-0" iconClassName="h-7 w-7" />
            <div
              className="space-y-3 overflow-y-auto overflow-x-hidden flex-1 min-h-0 scrollbar-hide relative"
              data-up-next-container
            >
              {upcomingSongs.map((song, index) => {
                const isAnimating = animatingCards.has(song.uri);
                if (isAnimating) {
                  console.log(`🎨 Rendering animated card for: ${song.name} (${song.uri})`);
                }
                return (
                  <QueueSongRow
                    key={`${song.uri || 'unknown'}-${index}`}
                    song={song}
                    index={index}
                    isAnimating={isAnimating}
                    sanitizeName={sanitizeName}
                    showCover={showCover}
                    coverSize="lg"
                    rowClassName="p-3"
                    titleClassName="text-lg"
                    artistClassName="text-sm"
                    badgeClassName="px-3 py-1 text-sm shadow-lg"
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mood-panel p-6 flex flex-col h-full min-h-0 overflow-hidden items-center justify-center">
            <div className="text-center text-[color:var(--mood-muted)] text-xl">No upcoming songs in queue</div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-landscape') {
    return (
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden h-full" style={style}>
        {upcomingSongs.length > 0 ? (
          <div className="mood-panel p-4 flex flex-col h-full min-h-0 overflow-hidden relative">
            <UpNextHeading className="text-xl mb-4 flex-shrink-0" iconClassName="h-5 w-5" />
            <div
              className="space-y-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 scrollbar-hide"
              data-up-next-container
            >
              {upcomingSongs.map((song, index) => (
                <QueueSongRow
                  key={`${song.uri || 'unknown'}-${index}`}
                  song={song}
                  index={index}
                  isAnimating={animatingCards.has(song.uri)}
                  sanitizeName={sanitizeName}
                  showCover={false}
                  rowClassName="p-2"
                  titleClassName="text-sm"
                  artistClassName="text-xs"
                  badgeClassName="px-2 py-1 text-xs"
                  badgeWrapperClassName="ml-2"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mood-panel p-4 flex flex-col h-full min-h-0 overflow-hidden items-center justify-center">
            <p className="text-[color:var(--mood-muted)] text-center text-base">No upcoming songs in queue</p>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-portrait') {
    return (
      <div className="mood-panel p-4 flex-1 min-h-0 overflow-hidden relative flex flex-col">
        <UpNextHeading className="text-xl mb-3 justify-start flex-shrink-0" iconClassName="h-5 w-5" />
        {upcomingSongs.length > 0 ? (
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
            {upcomingSongs.map((song, index) => (
              <QueueSongRow
                key={`${song.uri || 'unknown'}-${index}`}
                song={song}
                index={index}
                isAnimating={animatingCards.has(song.uri)}
                sanitizeName={sanitizeName}
                showCover={false}
                rowClassName="p-3"
                titleClassName=""
                artistClassName="text-sm"
                badgeClassName="px-3 py-1 text-sm"
              />
            ))}
          </div>
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
      <div className="flex flex-col min-h-0 min-w-0 overflow-hidden h-full" style={style}>
        {upcomingSongs.length > 0 ? (
          <div className="mood-panel p-2 h-full min-h-0 overflow-hidden relative flex flex-col">
            <UpNextHeading className="text-sm mb-2 flex-shrink-0" iconClassName="h-3.5 w-3.5" />
            <div className="space-y-1 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
              {upcomingSongs.map((song, index) => (
                <QueueSongRow
                  key={`${song.uri || 'unknown'}-${index}`}
                  song={song}
                  index={index}
                  isAnimating={animatingCards.has(song.uri)}
                  sanitizeName={sanitizeName}
                  showCover={false}
                  rowClassName="p-1 rounded"
                  titleClassName="text-xs"
                  artistClassName="text-xs"
                  badgeClassName="px-1 py-0.5 text-xs"
                  badgeWrapperClassName="ml-1"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mood-panel p-2 h-full min-h-0 overflow-hidden flex items-center justify-center">
            <p className="text-[color:var(--mood-muted)] text-center text-xs">No upcoming songs in queue</p>
          </div>
        )}
      </div>
    );
  }

  // mobile-portrait
  return (
    <div className="mood-panel p-3 flex-1 min-h-0 overflow-hidden relative flex flex-col">
      <UpNextHeading className="text-base mb-2 justify-start flex-shrink-0" iconClassName="h-4 w-4" />
      {upcomingSongs.length > 0 ? (
        <div className="space-y-2 overflow-y-auto flex-1 min-h-0 scrollbar-hide">
          {upcomingSongs.map((song, index) => (
            <QueueSongRow
              key={`${song.uri || 'unknown'}-${index}`}
              song={song}
              index={index}
              isAnimating={animatingCards.has(song.uri)}
              sanitizeName={sanitizeName}
              showCover={false}
              rowClassName="p-2 rounded text-xs"
              titleClassName=""
              artistClassName=""
              badgeClassName="px-2 py-1 text-xs"
              badgeWrapperClassName="ml-2"
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-[color:var(--mood-muted)] text-center text-sm">No upcoming songs in queue</p>
        </div>
      )}
    </div>
  );
}
