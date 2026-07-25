'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ListMusic,
  Loader2,
  ListPlus,
  RefreshCw,
  Search,
} from 'lucide-react';
import Checkbox from '@/components/ui/Checkbox';

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
      });
      const data = await response.json();

      if (!response.ok) {
        if (data?.needs_reconnect) setNeedsReconnect(true);
        throw new Error(data?.error || 'Failed to load playlist tracks');
      }

      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
      if (data.truncated) {
        setStatusMessage('Showing the first 200 tracks from this playlist.');
      }
    } catch (err) {
      setTracks([]);
      setError(err instanceof Error ? err.message : 'Failed to load playlist tracks');
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setPlaylists([]);
      setSelectedPlaylist(null);
      setTracks([]);
      return;
    }
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
    <div className="bg-elevated rounded-lg p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded bg-surface flex items-center justify-center flex-shrink-0">
            <ListMusic className="w-5 h-5 text-muted" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-bone">Playlists</h2>
            <p className="text-muted text-sm mt-1">
              Browse your Spotify playlists and queue tracks. Playlists are read-only here.
            </p>
          </div>
        </div>
        {!selectedPlaylist && (
          <button
            type="button"
            onClick={() => void fetchPlaylists()}
            disabled={isLoadingPlaylists}
            className="p-2 rounded-lg text-muted hover:text-bone hover:bg-surface transition-colors disabled:opacity-50"
            aria-label="Refresh playlists"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingPlaylists ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {needsReconnect && (
        <div className="flex items-start gap-2 text-amber-200 bg-amber-900/20 border border-amber-600/40 rounded-lg p-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            Reconnect Spotify to grant playlist read access, then refresh this section.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-200 bg-red-900/20 border border-red-600 rounded-lg p-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {statusMessage && (
        <div className="text-sm text-bone bg-surface/60 border border-white/10 rounded-lg p-3 mb-4">
          {statusMessage}
        </div>
      )}

      {!selectedPlaylist ? (
        <>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={playlistQuery}
              onChange={(e) => setPlaylistQuery(e.target.value)}
              placeholder="Search playlists…"
              className="w-full bg-surface border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-bone placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {isLoadingPlaylists ? (
            <div className="flex items-center justify-center py-10 text-muted gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading playlists…</span>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="text-center py-8">
              <ListMusic className="w-12 h-12 text-faint mx-auto mb-3" />
              <p className="text-muted">No playlists found</p>
              <p className="text-faint text-sm mt-1">
                Create or follow playlists in Spotify, then refresh
              </p>
            </div>
          ) : (
            <ul className="space-y-1 max-h-80 overflow-y-auto">
              {filteredPlaylists.map((playlist) => (
                <li key={playlist.id}>
                  <button
                    type="button"
                    onClick={() => openPlaylist(playlist)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface/80 border border-transparent hover:border-white/10 transition-colors text-left"
                  >
                    {playlist.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={playlist.image}
                        alt=""
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-elevated flex items-center justify-center flex-shrink-0">
                        <ListMusic className="w-4 h-4 text-faint" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-bone font-medium truncate">{playlist.name}</div>
                      <div className="text-faint text-xs truncate">
                        {playlist.track_count} track{playlist.track_count === 1 ? '' : 's'}
                        {playlist.owner_name ? ` · ${playlist.owner_name}` : ''}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-muted hover:text-bone hover:bg-surface transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-bone font-semibold truncate">{selectedPlaylist.name}</div>
              <div className="text-faint text-xs">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-ink hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {isQueuing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ListPlus className="w-4 h-4" />
              )}
              Queue playlist
            </button>
          </div>

          {isLoadingTracks ? (
            <div className="flex items-center justify-center py-10 text-muted gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading tracks…</span>
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted text-sm">
                No tracks available. Spotify only exposes tracks for playlists you own or
                collaborate on.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-surface text-bone border border-white/10 hover:border-white/20 transition-colors disabled:opacity-50"
                >
                  {isQueuing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ListPlus className="w-4 h-4" />
                  )}
                  Queue selected ({selectedUris.size})
                </button>
              </div>

              <ul className="space-y-1 max-h-96 overflow-y-auto">
                {tracks.map((track) => (
                  <li
                    key={`${track.uri}-${track.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-surface/80"
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
                        className="w-9 h-9 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded bg-elevated flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-bone text-sm font-medium truncate">{track.name}</div>
                      <div className="text-faint text-xs truncate">
                        {track.artists.join(', ') || 'Unknown artist'}
                      </div>
                    </div>
                    <span className="text-faint text-xs tabular-nums flex-shrink-0">
                      {formatDuration(track.duration_ms)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void queueUris([track.uri])}
                      disabled={isQueuing}
                      className="px-2 py-1 rounded text-xs font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      Queue
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
