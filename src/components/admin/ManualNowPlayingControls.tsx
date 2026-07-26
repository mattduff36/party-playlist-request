'use client';

/**
 * Minimal organiser controls for manual request mode (PRD-07).
 * Wires /api/admin/manual-now-playing and /api/admin/requests/[id]/mark-played.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Music, X } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

interface ManualNowPlayingValue {
  requestId?: string | null;
  title: string;
  artists: string;
  album?: string | null;
  artworkUrl?: string | null;
  setAt: string;
  setBy?: string | null;
}

interface ManualNowPlayingControlsProps {
  /** Compact sidebar vs slightly roomier page placement */
  compact?: boolean;
}

export default function ManualNowPlayingControls({
  compact = true,
}: ManualNowPlayingControlsProps) {
  const [nowPlaying, setNowPlaying] = useState<ManualNowPlayingValue | null>(
    null
  );
  const [title, setTitle] = useState('');
  const [artists, setArtists] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/admin/manual-now-playing');
      if (!res.ok) return;
      const data = await res.json();
      setNowPlaying(data.nowPlaying ?? null);
    } catch {
      /* keep prior */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setFromForm = async () => {
    if (busy) return;
    const trimmedTitle = title.trim();
    const trimmedArtists = artists.trim();
    if (!trimmedTitle || !trimmedArtists) {
      setError('Title and artist are required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/admin/manual-now-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, artists: trimmedArtists }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === 'string' ? data.error : 'Failed to set now playing'
        );
        return;
      }
      setNowPlaying(data.nowPlaying ?? null);
      setTitle('');
      setArtists('');
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const clearNowPlaying = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/admin/manual-now-playing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === 'string' ? data.error : 'Failed to clear'
        );
        return;
      }
      setNowPlaying(null);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const markPlayed = async () => {
    if (busy || !nowPlaying?.requestId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        `/api/admin/requests/${nowPlaying.requestId}/mark-played`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Failed to mark played'
        );
        return;
      }
      setNowPlaying(null);
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  };

  const textSize = compact ? 'text-xs' : 'text-sm';
  const inputClass = `w-full rounded-lg bg-surface border border-white/10 px-2 py-1.5 text-bone placeholder:text-faint ${textSize}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-3">
        <Loader2 className="w-4 h-4 text-accent animate-spin" />
        <span className="text-xs text-muted">Loading now playing…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-muted uppercase tracking-wide mb-1.5`}>
          Now playing
        </p>
        {nowPlaying ? (
          <div className="flex items-start gap-2 rounded-lg bg-surface border border-white/10 px-2.5 py-2">
            <Music className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={`${textSize} font-medium text-bone truncate`}>
                {nowPlaying.title}
              </p>
              <p className="text-[10px] text-muted truncate">{nowPlaying.artists}</p>
            </div>
            <button
              type="button"
              onClick={() => void clearNowPlaying()}
              disabled={busy}
              className="p-1 text-muted hover:text-bone disabled:opacity-50"
              title="Clear now playing"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p className={`${textSize} text-muted`}>Nothing set</p>
        )}
      </div>

      <div className="space-y-1.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Song title"
          className={inputClass}
          disabled={busy}
        />
        <input
          type="text"
          value={artists}
          onChange={(e) => setArtists(e.target.value)}
          placeholder="Artist"
          className={inputClass}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => void setFromForm()}
          disabled={busy}
          className={`w-full rounded-lg bg-accent hover:bg-accent-hover text-ink font-medium disabled:opacity-50 ${
            compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
          }`}
        >
          {busy ? 'Saving…' : 'Set now playing'}
        </button>
      </div>

      {nowPlaying?.requestId ? (
        <button
          type="button"
          onClick={() => void markPlayed()}
          disabled={busy}
          className={`w-full rounded-lg border border-white/15 text-bone hover:bg-surface disabled:opacity-50 ${
            compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
          }`}
        >
          Mark played
        </button>
      ) : null}

      {error ? (
        <p className="text-[11px] text-red-400 bg-red-900/20 border border-red-600/50 rounded-lg px-2 py-1.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}
