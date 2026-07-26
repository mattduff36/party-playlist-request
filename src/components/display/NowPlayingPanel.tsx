'use client';

import type { CSSProperties, RefCallback } from 'react';
import { Music2 } from 'lucide-react';
import type { CurrentTrack, NowPlayingVariant } from './types';

interface NowPlayingHeadingProps {
  className?: string;
  iconClassName?: string;
}

function NowPlayingHeading({
  className = '',
  iconClassName = 'h-5 w-5',
}: NowPlayingHeadingProps) {
  return (
    <h2 className={`flex items-center justify-center gap-2 font-semibold ${className}`}>
      <Music2 className={`${iconClassName} mood-accent-text shrink-0`} aria-hidden="true" />
      Now Playing
    </h2>
  );
}

interface NowPlayingPanelProps {
  variant: NowPlayingVariant;
  currentTrack: CurrentTrack | null;
  useHorizontalLayout?: boolean;
  nowPlayingRef?: RefCallback<HTMLDivElement>;
  style?: CSSProperties;
}

export default function NowPlayingPanel({
  variant,
  currentTrack,
  useHorizontalLayout = false,
  nowPlayingRef,
  style,
}: NowPlayingPanelProps) {
  if (variant === 'tv') {
    return (
      <div
        ref={nowPlayingRef}
        className="mood-panel p-6 flex flex-col justify-center min-h-0 min-w-0 h-full overflow-hidden"
        style={style}
      >
        <NowPlayingHeading className="text-2xl mb-6 flex-shrink-0" iconClassName="h-6 w-6" />
        {currentTrack ? (
          useHorizontalLayout ? (
            // Horizontal layout: Album art left, details right (centered)
            <div className="flex items-center gap-8 justify-center max-w-4xl mx-auto min-h-0 max-h-full overflow-hidden">
              {currentTrack.image_url && (
                <img
                  src={currentTrack.image_url}
                  alt="Album Art"
                  className="rounded-lg shadow-lg shrink-0"
                  style={{
                    width: 'min(300px, 40%)',
                    height: 'auto',
                    maxHeight: '100%',
                    aspectRatio: '1/1',
                    objectFit: 'cover',
                  }}
                />
              )}
              <div className="text-left min-w-0" style={{ width: 'min(300px, 45%)' }}>
                <h3 className="text-4xl font-bold mb-4 leading-tight">{currentTrack.name}</h3>
                <p className="text-2xl text-[color:var(--mood-muted)] mb-3">
                  {currentTrack.artists && currentTrack.artists.length > 0
                    ? currentTrack.artists.filter((a) => a).join(', ')
                    : 'Unknown Artist'}
                </p>
                <p className="text-xl text-[color:var(--mood-muted)]">{currentTrack.album || 'Unknown Album'}</p>
              </div>
            </div>
          ) : (
            // Vertical layout: Centered
            <div className="text-center min-h-0 overflow-hidden">
              {currentTrack.image_url && (
                <img
                  src={currentTrack.image_url}
                  alt="Album Art"
                  className="w-40 h-40 max-h-[40%] mx-auto rounded-lg shadow-lg mb-6 object-cover"
                />
              )}
              <h3 className="text-2xl font-bold mb-3 leading-tight">{currentTrack.name}</h3>
              <p className="text-lg text-[color:var(--mood-muted)] mb-2">
                {currentTrack.artists && currentTrack.artists.length > 0
                  ? currentTrack.artists.filter((a) => a).join(', ')
                  : 'Unknown Artist'}
              </p>
              <p className="text-sm text-[color:var(--mood-muted)] mb-3">{currentTrack.album || 'Unknown Album'}</p>
            </div>
          )
        ) : (
          <div className="text-center text-[color:var(--mood-muted)] text-lg">No song currently playing</div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-landscape') {
    return (
      <div
        className="mood-panel p-4 flex flex-col justify-center min-h-0 min-w-0 h-full overflow-hidden"
        style={style}
      >
        <NowPlayingHeading className="text-lg mb-3" iconClassName="h-4 w-4" />
        {currentTrack ? (
          <div className="text-center">
            {currentTrack.image_url && (
              <img
                src={currentTrack.image_url}
                alt="Album Art"
                className="w-24 h-24 mx-auto rounded-lg shadow-lg mb-3"
              />
            )}
            <h3 className="text-base font-bold mb-2 leading-tight">{currentTrack.name}</h3>
            <p className="text-sm text-[color:var(--mood-muted)] mb-1">
              {currentTrack.artists && currentTrack.artists.length > 0
                ? currentTrack.artists.filter((a) => a).join(', ')
                : 'Unknown Artist'}
            </p>
            <p className="text-xs text-[color:var(--mood-muted)] mb-2">{currentTrack.album || 'Unknown Album'}</p>
          </div>
        ) : (
          <div className="text-center text-[color:var(--mood-muted)] text-sm">No song currently playing</div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-portrait') {
    return (
      <div className="mood-panel p-4 flex-shrink-0 mb-4">
        <NowPlayingHeading className="text-xl mb-3" iconClassName="h-5 w-5" />
        {currentTrack ? (
          <div className="text-center">
            {currentTrack.image_url && (
              <img
                src={currentTrack.image_url}
                alt="Album Art"
                className="w-32 h-32 mx-auto rounded-lg shadow-lg mb-4"
              />
            )}
            <h3 className="text-lg font-bold mb-2">{currentTrack.name}</h3>
            <p className="text-base text-[color:var(--mood-muted)] mb-3">
              {currentTrack.artists && currentTrack.artists.length > 0
                ? currentTrack.artists.filter((a) => a).join(', ')
                : 'Unknown Artist'}
            </p>
          </div>
        ) : (
          <div className="text-center text-[color:var(--mood-muted)]">No song playing</div>
        )}
      </div>
    );
  }

  if (variant === 'mobile-landscape') {
    return (
      <div
        className="mood-panel p-2 flex flex-col justify-center min-h-0 min-w-0 h-full overflow-hidden"
        style={style}
      >
        <NowPlayingHeading className="text-xs mb-2" iconClassName="h-3 w-3" />
        {currentTrack ? (
          <div className="text-center">
            {currentTrack.image_url && (
              <img
                src={currentTrack.image_url}
                alt="Album Art"
                className="w-16 h-16 mx-auto rounded-lg shadow-lg mb-2"
              />
            )}
            <h3 className="text-xs font-bold mb-1 leading-tight">{currentTrack.name}</h3>
            <p className="text-xs text-[color:var(--mood-muted)] mb-1">
              {currentTrack.artists && currentTrack.artists.length > 0
                ? currentTrack.artists.filter((a) => a).join(', ')
                : 'Unknown Artist'}
            </p>
            <p className="text-xs text-[color:var(--mood-muted)]">{currentTrack.album || 'Unknown Album'}</p>
          </div>
        ) : (
          <div className="text-center text-[color:var(--mood-muted)] text-xs">No song currently playing</div>
        )}
      </div>
    );
  }

  // mobile-portrait
  return (
    <div className="mood-panel p-3 flex-shrink-0 mb-3">
      <NowPlayingHeading className="text-lg mb-3" iconClassName="h-4 w-4" />
      {currentTrack ? (
        <div className="text-center">
          {currentTrack.image_url && (
            <img
              src={currentTrack.image_url}
              alt="Album Art"
              className="w-24 h-24 mx-auto rounded-lg shadow-lg mb-3"
            />
          )}
          <h3 className="text-lg font-bold mb-1">{currentTrack.name}</h3>
          <p className="text-sm text-[color:var(--mood-muted)] mb-3">
            {currentTrack.artists && currentTrack.artists.length > 0
              ? currentTrack.artists.filter((a) => a).join(', ')
              : 'Unknown Artist'}
          </p>
        </div>
      ) : (
        <div className="text-center text-[color:var(--mood-muted)] text-sm">No song playing</div>
      )}
    </div>
  );
}
