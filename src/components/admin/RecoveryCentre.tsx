'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import type { RecoveryIssue } from '@/lib/beta/recovery';

interface RecoveryCentreProps {
  username: string;
}

export default function RecoveryCentre({ username }: RecoveryCentreProps) {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<RecoveryIssue[]>([]);
  const [meta, setMeta] = useState<{
    lastPlaybackRefreshAt: string | null;
    eventVersion: number | null;
    playbackMode: string;
    degraded: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/admin/recovery');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load recovery');
      setIssues(data.issues || []);
      setMeta({
        lastPlaybackRefreshAt: data.lastPlaybackRefreshAt,
        eventVersion: data.eventVersion,
        playbackMode: data.playbackMode,
        degraded: Boolean(data.degraded),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const hrefFor = (key?: string) => {
    if (!key) return null;
    if (key === 'spotify') return `/${username}/admin/spotify`;
    if (key === 'display') return `/${username}/admin/display`;
    if (key === 'requests') return `/${username}/admin/requests`;
    if (key === 'settings') return `/${username}/admin/settings`;
    return null;
  };

  const runAction = async (action?: string) => {
    if (!action || action === 'stay' || action === 'refresh') {
      await load();
      return;
    }
    if (action === 'playback_mode_manual') {
      await authenticatedFetch('/api/admin/playback-mode', {
        method: 'POST',
        body: JSON.stringify({ mode: 'manual' }),
      });
      await load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading diagnostics…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Event-day recovery
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Concise diagnostics — no secrets or stack traces.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      {meta && (
        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400 space-y-1">
          <p>Mode: {meta.playbackMode}</p>
          <p>
            Last playback refresh:{' '}
            {meta.lastPlaybackRefreshAt
              ? new Date(meta.lastPlaybackRefreshAt).toLocaleString()
              : 'n/a'}
          </p>
          <p>Event version: {meta.eventVersion ?? 'n/a'}</p>
          <p>Degraded: {meta.degraded ? 'yes' : 'no'}</p>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {issues.length === 0 ? (
        <div className="rounded border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          No active recovery issues detected.
        </div>
      ) : (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-2"
            >
              <div className="flex items-center gap-2">
                {issue.severity === 'critical' ? (
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                ) : issue.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : (
                  <Info className="w-4 h-4 text-sky-400" />
                )}
                <h2 className="text-sm font-medium text-zinc-100">
                  {issue.title}
                </h2>
              </div>
              <ul className="list-disc pl-5 text-sm text-zinc-400 space-y-1">
                {issue.guidance.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                {issue.actions.map((a) => {
                  const href = hrefFor(a.href);
                  if (href) {
                    return (
                      <a
                        key={a.label}
                        href={href}
                        className="rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-200"
                      >
                        {a.label}
                      </a>
                    );
                  }
                  return (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => void runAction(a.action)}
                      className="rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-200"
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
