'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

interface HistoryEvent {
  id: string;
  status: string;
  lifecycle_phase: string | null;
  ended_at: string | null;
  archived_at: string | null;
  started_at: string | null;
  event_title: string | null;
  request_count: number;
}

interface EventReport {
  eventId: string;
  eventTitle: string | null;
  totals: {
    requests: number;
    pending: number;
    approved: number;
    rejected: number;
    played: number;
    queueFailed: number;
  };
  uniqueGuestSessionsApprox: number;
  peakPeriod: { hourLabel: string; count: number } | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  topTracks: Array<{ track_name: string; artist_name: string; count: number }>;
  providerInterruptions: Array<{
    created_at: string;
    operation: string;
    status: string;
  }>;
}

export default function EventHistoryPanel() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<EventReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authenticatedFetch('/api/admin/events/history');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load history');
        setEvents(data.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openReport = async (id: string) => {
    setError(null);
    const res = await authenticatedFetch(`/api/admin/events/${id}/report`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load report');
      return;
    }
    setReport(data.report);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-zinc-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading event history…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">Event history</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Retained after event end — independent of browser logout.
        </p>
      </header>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <ul className="space-y-2">
        {events.length === 0 && (
          <li className="text-sm text-zinc-500">No archived events yet.</li>
        )}
        {events.map((ev) => (
          <li
            key={ev.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2"
          >
            <div>
              <p className="text-sm text-zinc-100">
                {ev.event_title || 'Untitled event'}
              </p>
              <p className="text-xs text-zinc-500">
                {ev.request_count} requests · {ev.lifecycle_phase || ev.status} ·{' '}
                {ev.ended_at
                  ? new Date(ev.ended_at).toLocaleString()
                  : 'no end stamp'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void openReport(ev.id)}
                className="rounded border border-zinc-600 px-3 py-1 text-xs"
              >
                Report
              </button>
              <a
                href={`/api/admin/events/${ev.id}/report?format=csv`}
                className="inline-flex items-center gap-1 rounded border border-zinc-600 px-3 py-1 text-xs"
              >
                <Download className="w-3 h-3" /> CSV
              </a>
            </div>
          </li>
        ))}
      </ul>

      {report && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <h2 className="text-lg text-zinc-100">
            {report.eventTitle || 'Event report'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-zinc-300">
            <p>Submitted: {report.totals.requests}</p>
            <p>Approved: {report.totals.approved}</p>
            <p>Rejected: {report.totals.rejected}</p>
            <p>Played: {report.totals.played}</p>
            <p>Queue failed: {report.totals.queueFailed}</p>
            <p>
              Unique guests (approx): {report.uniqueGuestSessionsApprox}
            </p>
            <p>Duration: {report.durationMinutes ?? '—'} min</p>
            <p>
              Peak:{' '}
              {report.peakPeriod
                ? `${report.peakPeriod.hourLabel} (${report.peakPeriod.count})`
                : '—'}
            </p>
          </div>
          {report.topTracks?.length > 0 && (
            <div>
              <h3 className="text-sm text-zinc-400 mb-1">Top tracks</h3>
              <ul className="text-sm text-zinc-300 space-y-0.5">
                {report.topTracks.slice(0, 5).map((t) => (
                  <li key={`${t.track_name}-${t.artist_name}`}>
                    {t.track_name} — {t.artist_name} ({t.count})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.providerInterruptions?.length > 0 && (
            <div>
              <h3 className="text-sm text-zinc-400 mb-1">
                Provider interruptions / degraded
              </h3>
              <ul className="text-xs text-zinc-400 space-y-0.5">
                {report.providerInterruptions.slice(0, 10).map((p) => (
                  <li key={`${p.created_at}-${p.operation}`}>
                    {new Date(p.created_at).toLocaleString()} · {p.operation} ·{' '}
                    {p.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
