'use client';

import { ListMusic, Music } from 'lucide-react';
import { useAdminData, type QueueTrack } from '@/contexts/AdminDataContext';
import { formatArtists } from '@/lib/format-artists';

interface NormalizedTrack {
  key: string;
  name: string;
  artists: string;
  imageUrl?: string;
  requesterNickname?: string;
}

function getImageUrl(track: QueueTrack): string | undefined {
  if (track.image_url) return track.image_url;
  if (track.album && typeof track.album === 'object') {
    return track.album.images?.[0]?.url || track.album.images?.[1]?.url;
  }
  return undefined;
}

function getRequesterNickname(track: QueueTrack): string | undefined {
  return track.requester_nickname || track.requesterNickname || undefined;
}

function normalizeQueueTrack(track: QueueTrack, index: number): NormalizedTrack {
  return {
    key: track.uri || track.id || `queue-${index}`,
    name: track.name || 'Unknown Track',
    artists: formatArtists(track.artists),
    imageUrl: getImageUrl(track),
    requesterNickname: getRequesterNickname(track),
  };
}

function TrackRow({
  track,
  emphasizeTitle = false,
}: {
  track: NormalizedTrack;
  emphasizeTitle?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0 px-3 py-2 rounded-lg hover:bg-surface/60 transition-colors">
      <div className="w-10 h-10 rounded bg-surface flex-shrink-0 overflow-hidden flex items-center justify-center">
        {track.imageUrl ? (
          <img
            src={track.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <Music className="w-4 h-4 text-muted" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium truncate ${
            emphasizeTitle ? 'text-accent' : 'text-bone'
          }`}
        >
          {track.name}
        </p>
        <p className="text-xs text-muted truncate">{track.artists}</p>
      </div>
      {track.requesterNickname && (
        <span className="flex-shrink-0 max-w-[5.5rem] truncate text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent">
          {track.requesterNickname}
        </span>
      )}
    </div>
  );
}

export default function AdminQueueSidebar() {
  const { playbackState, spotifyConnected } = useAdminData();

  const connected = spotifyConnected;
  const hasNowPlaying = Boolean(playbackState?.track_name);
  const queue = (playbackState?.queue || []).map(normalizeQueueTrack);

  return (
    <div className="flex flex-col h-full min-h-[20rem] lg:min-h-0">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <ListMusic className="w-5 h-5 text-muted" aria-hidden="true" />
        <h2 className="font-display text-sm font-semibold text-bone tracking-wide">
          Queue
        </h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5">
        {!connected && (
          <p className="px-1 text-sm text-muted">
            Connect Spotify from the header to see the queue.
          </p>
        )}

        {connected && (
          <>
            <section>
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Now playing
              </h3>
              {hasNowPlaying ? (
                <TrackRow
                  emphasizeTitle={playbackState?.is_playing}
                  track={{
                    key: 'now-playing',
                    name: playbackState?.track_name || 'Unknown Track',
                    artists: formatArtists(playbackState?.artist_name ?? null),
                    imageUrl: playbackState?.image_url,
                  }}
                />
              ) : (
                <p className="px-1 text-sm text-muted py-2">Nothing playing</p>
              )}
            </section>

            <section>
              <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted mb-1">
                Next up
              </h3>
              {queue.length > 0 ? (
                <div className="space-y-0.5">
                  {queue.map((track, index) => (
                    <TrackRow key={`${track.key}-${index}`} track={track} />
                  ))}
                </div>
              ) : (
                <p className="px-1 text-sm text-muted py-2">Queue is empty</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
