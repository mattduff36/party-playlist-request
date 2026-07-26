'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Heart,
  ListMusic,
  Loader2,
  ListPlus,
  RefreshCw,
  Search,
} from 'lucide-react';
import Checkbox from '@/components/ui/Checkbox';

const LIKED_SONGS_ID = 'liked-songs';

interface PlaylistBrowserProps {
  isConnected: boolean;
}

interface SpotifyPlaylistRow {
  id: string;
  name: string;
  uri: string;
  collaborative: boolean;
  public: boolean | null;
  image?: string;
  track_count: number;
  owner_name?: string;
  owner_id?: string;
}

function isLikedSongs(playlist: SpotifyPlaylistRow | null): boolean {
  return playlist?.id === LIKED_SONGS_ID;
}

interface SpotifyPlaylistTrackRow {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  image?: string;
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '-';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function PlaylistBrowser({ isConnected }: PlaylistBrowserProps) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylistRow[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylistRow | null>(null);
  const [tracks, setTracks] = useState<SpotifyPlaylistTrackRow[]>([]);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [playlistQuery, setPlaylistQuery] = useState('');
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isQueuing, setIsQueuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    setIsLoadingPlaylists(true);
    setError(null);
    setNeedsReconnect(false);

    try {
      const response = await fetch('/api/spotify/playlists', {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) {
        if (data?.needs_reconnect) setNeedsReconnect(true);
        throw new Error(data?.error || 'Failed to load playlists');
      }

      setPlaylists(Array.isArray(data.playlists) ? data.playlists : []);
    } catch (err) {
      setPlaylists([]);
      setError(err instanceof Error ? err.message : 'Failed to load playlists');
    } finally {
      setIsLoadingPlaylists(false);
    }
  }, []);

  const fetchTracks = useCallback(async (playlist: SpotifyPlaylistRow) => {
    setIsLoadingTracks(true);
    setError(null);
    setStatusMessage(null);
    setSelectedUris(new Set());
    setTracks([]);

    try {
      const response = await fetch(`/api/spotify/playlists/${playlist.id}/tracks`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) {
        if (data?.needs_reconnect) setNeedsReconnect(true);
        throw new Error(data?.error || 'Failed to load playlist tracks');
      }

      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
      if (data.truncated) {
        setStatusMessage(
          isLikedSongs(playlist)
            ? 'Showing the first 200 tracks from Liked Songs.'
            : 'Showing the first 200 tracks from this playlist.'
        );
      }
    } catch (err) {
      setTracks([]);
      setError(err instanceof Error ? err.message : 'Failed to load playlist tracks');
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      // Only clear lists on confirmed disconnect after we had been connected
      if (wasConnectedRef.current) {
        setPlaylists([]);
        setSelectedPlaylist(null);
        setTracks([]);
        wasConnectedRef.current = false;
      }
      return;
    }
    wasConnectedRef.current = true;
    void fetchPlaylists();
  }, [isConnected, fetchPlaylists]);

  const filteredPlaylists = useMemo(() => {
    const q = playlistQuery.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.owner_name && p.owner_name.toLowerCase().includes(q))
    );
  }, [playlists, playlistQuery]);

  const openPlaylist = (playlist: SpotifyPlaylistRow) => {
    setSelectedPlaylist(playlist);
    void fetchTracks(playlist);
  };

  const backToList = () => {
    setSelectedPlaylist(null);
    setTracks([]);
    setSelectedUris(new Set());
    setStatusMessage(null);
    setError(null);
  };

  const toggleUri = (uri: string) => {
    setSelectedUris((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUris.size === tracks.length) {
      setSelectedUris(new Set());
      return;
    }
    setSelectedUris(new Set(tracks.map((t) => t.uri)));
  };

  const queueUris = async (uris: string[]) => {
    if (uris.length === 0) return;

    setIsQueuing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/admin/queue/add', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          uris.length === 1 ? { track_uri: uris[0] } : { track_uris: uris }
        ),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || data?.message || 'Failed to queue tracks');
      }

      setStatusMessage(data.message || `Queued ${data.queued} track(s)`);
      setSelectedUris(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue tracks');
    } finally {
      setIsQueuing(false);
    }
  };

  const queueEntirePlaylist = async () => {
    if (!selectedPlaylist) return;

    setIsQueuing(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/admin/queue/playlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_id: selectedPlaylist.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data?.error || data?.message || 'Failed to queue playlist');
      }

      let message = data.message || `Queued ${data.queued} track(s)`;
      if (data.truncated) {
        message += ' (first 100 tracks)';
      }
      setStatusMessage(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue playlist');
    } finally {
      setIsQueuing(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="bg-elevated rounded-lg p-6 flex min-h-0 grow flex-col">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-surface">
            <ListMusic className="h-5 w-5 text-muted" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-bone">Playlists</h2>
            <p className="mt-1 text-sm text-muted">
              Browse your Spotify playlists and queue tracks. Playlists are read-only here.
            </p>
          </div>
        </div>
        {!selectedPlaylist && (
          <button
            type="button"
            onClick={() => void fetchPlaylists()}
            disabled={isLoadingPlaylists}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-bone disabled:opacity-50"
            aria-label="Refresh playlists"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingPlaylists ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {needsReconnect && (
        <div className="mb-4 flex shrink-0 items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-900/20 p-3 text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-sm">
            Reconnect Spotify to grant playlist read access, then refresh this section.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 flex shrink-0 items-start gap-2 rounded-lg border border-red-600 bg-red-900/20 p-3 text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {statusMessage && (
        <div className="mb-4 shrink-0 rounded-lg border border-white/10 bg-surface/60 p-3 text-sm text-bone">
          {statusMessage}
        </div>
      )}

      {!selectedPlaylist ? (
        <div className="flex min-h-0 grow flex-col">
          <div className="relative mb-3 shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={playlistQuery}
              onChange={(e) => setPlaylistQuery(e.target.value)}
              placeholder="Search playlists…"
              className="w-full rounded-lg border border-white/10 bg-surface py-2 pl-9 pr-3 text-sm text-bone placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {isLoadingPlaylists ? (
            <div className="flex grow items-center justify-center gap-2 py-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading playlists…</span>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="flex grow flex-col items-center justify-center py-8 text-center">
              <ListMusic className="mx-auto mb-3 h-12 w-12 text-faint" />
              <p className="text-muted">No playlists found</p>
              <p className="mt-1 text-sm text-faint">
                Create or follow playlists in Spotify, then refresh
              </p>
            </div>
          ) : (
            <ul className="min-h-0 grow space-y-1 overflow-y-auto">
              {filteredPlaylists.map((playlist) => {
                const liked = isLikedSongs(playlist);
                return (
                  <li key={playlist.id}>
                    <button
                      type="button"
                      onClick={() => openPlaylist(playlist)}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-surface p-3 text-left transition-colors hover:border-white/10 hover:bg-surface/80"
                    >
                      {playlist.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={playlist.image}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${
                            liked ? 'bg-accent/15' : 'bg-elevated'
                          }`}
                        >
                          {liked ? (
                            <Heart className="h-4 w-4 fill-accent text-accent" />
                          ) : (
                            <ListMusic className="h-4 w-4 text-faint" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-bone">{playlist.name}</div>
                        <div className="truncate text-xs text-faint">
                          {playlist.track_count} track
                          {playlist.track_count === 1 ? '' : 's'}
                          {playlist.owner_name ? ` · ${playlist.owner_name}` : ''}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 grow flex-col">
          <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface hover:text-bone"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-bone">{selectedPlaylist.name}</div>
              <div className="text-xs text-faint">
                {tracks.length} loaded
                {selectedPlaylist.track_count
                  ? ` of ${selectedPlaylist.track_count}`
                  : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void queueEntirePlaylist()}
              disabled={isQueuing || isLoadingTracks || tracks.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {isQueuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ListPlus className="h-4 w-4" />
              )}
              {isLikedSongs(selectedPlaylist) ? 'Queue all' : 'Queue playlist'}
            </button>
          </div>

          {isLoadingTracks ? (
            <div className="flex grow items-center justify-center gap-2 py-10 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading tracks…</span>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex grow flex-col items-center justify-center py-8 text-center">
              {isLikedSongs(selectedPlaylist) ? (
                <>
                  <Heart className="mx-auto mb-3 h-10 w-10 text-faint" />
                  <p className="text-sm text-muted">No liked songs yet</p>
                  <p className="mt-1 text-sm text-faint">
                    Like tracks in Spotify, then refresh this section
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">
                  No tracks available. Spotify only exposes tracks for playlists you own or
                  collaborate on.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
                  <Checkbox
                    checked={selectedUris.size === tracks.length && tracks.length > 0}
                    onChange={toggleSelectAll}
                    disabled={isQueuing}
                  />
                  Select all
                </label>
                <button
                  type="button"
                  onClick={() => void queueUris([...selectedUris])}
                  disabled={isQueuing || selectedUris.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm font-medium text-bone transition-colors hover:border-white/20 disabled:opacity-50"
                >
                  {isQueuing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ListPlus className="h-4 w-4" />
                  )}
                  Queue selected ({selectedUris.size})
                </button>
              </div>

              <ul className="min-h-0 grow space-y-1 overflow-y-auto">
                {tracks.map((track) => (
                  <li
                    key={`${track.uri}-${track.id}`}
                    className="flex items-center gap-3 rounded-lg bg-surface/80 p-2.5"
                  >
                    <Checkbox
                      checked={selectedUris.has(track.uri)}
                      onChange={() => toggleUri(track.uri)}
                      disabled={isQueuing}
                      aria-label={`Select ${track.name}`}
                    />
                    {track.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.image}
                        alt=""
                        className="h-9 w-9 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 flex-shrink-0 rounded bg-elevated" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-bone">{track.name}</div>
                      <div className="truncate text-xs text-faint">
                        {track.artists.join(', ') || 'Unknown artist'}
                      </div>
                    </div>
                    <span className="flex-shrink-0 tabular-nums text-xs text-faint">
                      {formatDuration(track.duration_ms)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void queueUris([track.uri])}
                      disabled={isQueuing}
                      className="flex-shrink-0 rounded px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                    >
                      Queue
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
