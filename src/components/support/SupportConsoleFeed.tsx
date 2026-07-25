'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, Trash2, Circle } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { SupportActivityRow } from '@/lib/support/types';

interface SupportConsoleFeedProps {
  active: boolean;
}

interface ConsoleLine {
  id: string;
  createdAt: string;
  action: string;
  summary: string;
  username: string | null;
  actorRole: string;
  route: string | null;
}

type FeedStatus = 'connecting' | 'live' | 'paused' | 'error';

const POLL_MS = 2000;
const MAX_LINES = 400;
const INITIAL_LIMIT = 80;

function toLine(row: SupportActivityRow): ConsoleLine {
  return {
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    summary: row.summary,
    username: row.username,
    actorRole: row.actor_role,
    route: row.route,
  };
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

function actionTone(action: string): string {
  if (action.includes('fail') || action.includes('reject')) return 'text-error';
  if (action.includes('approve') || action.includes('login') || action.includes('ok')) {
    return 'text-accent';
  }
  if (action.startsWith('auth.')) return 'text-info';
  return 'text-muted';
}

export default function SupportConsoleFeed({ active }: SupportConsoleFeedProps) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<FeedStatus>('connecting');
  const [stickToBottom, setStickToBottom] = useState(true);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const mergeRows = useCallback((rows: SupportActivityRow[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      seenIdsRef.current = new Set();
      cursorRef.current = null;
    }

    const chronological = [...rows].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const fresh = chronological.filter((row) => !seenIdsRef.current.has(row.id));
    if (fresh.length === 0 && mode === 'append') return;

    for (const row of fresh) {
      seenIdsRef.current.add(row.id);
    }
    if (fresh.length > 0) {
      cursorRef.current = fresh[fresh.length - 1].created_at;
    }

    setLines((prev) => {
      const next =
        mode === 'replace' ? fresh.map(toLine) : [...prev, ...fresh.map(toLine)];
      if (next.length <= MAX_LINES) return next;
      const trimmed = next.slice(next.length - MAX_LINES);
      seenIdsRef.current = new Set(trimmed.map((line) => line.id));
      return trimmed;
    });
  }, []);

  const fetchBatch = useCallback(
    async (mode: 'replace' | 'append') => {
      const params = new URLSearchParams({
        action: 'all',
        limit: String(mode === 'replace' ? INITIAL_LIMIT : 50),
      });
      if (mode === 'append' && cursorRef.current) {
        params.set('after', cursorRef.current);
      }

      const res = await fetch(`/api/superadmin/support/activity?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { rows?: SupportActivityRow[] };
      mergeRows(data.rows || [], mode);
    },
    [mergeRows]
  );

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const boot = async () => {
      setStatus('connecting');
      try {
        await fetchBatch('replace');
        if (cancelled) return;
        setStatus(pausedRef.current ? 'paused' : 'live');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    void boot();

    timer = setInterval(() => {
      if (pausedRef.current) return;
      void fetchBatch('append')
        .then(() => {
          if (!cancelled && !pausedRef.current) setStatus('live');
        })
        .catch(() => {
          if (!cancelled) setStatus('error');
        });
    }, POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [active, fetchBatch]);

  useEffect(() => {
    if (!active || !stickToBottom || paused) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, active, stickToBottom, paused]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distance < 48);
  };

  const clearLines = () => {
    setLines([]);
    seenIdsRef.current = new Set();
    // Keep cursor so we only show events after clear, not the whole history again.
  };

  const togglePause = () => {
    setPaused((prev) => {
      const next = !prev;
      setStatus(next ? 'paused' : 'live');
      return next;
    });
  };

  const statusLabel =
    status === 'connecting'
      ? 'Connecting'
      : status === 'live'
        ? 'Live'
        : status === 'paused'
          ? 'Paused'
          : 'Reconnect failed';

  const statusColor =
    status === 'live'
      ? 'text-accent'
      : status === 'paused'
        ? 'text-warning'
        : status === 'error'
          ? 'text-error'
          : 'text-muted';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Circle
            className={`h-2.5 w-2.5 fill-current ${statusColor} ${
              status === 'live' ? 'animate-pulse' : ''
            }`}
          />
          <span className={statusColor}>{statusLabel}</span>
          <span className="text-faint">
            Usage events from the activity audit - polls every {POLL_MS / 1000}s.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={togglePause}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="secondary" size="sm" onClick={clearLines}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative h-[min(70vh,560px)] overflow-auto rounded-xl border border-white/10 bg-ink font-mono text-[12px] leading-5 shadow-inner"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-ink/80 to-transparent" />
        {lines.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            Waiting for usage events. Logins, requests, settings changes, and similar
            actions will appear here as they happen.
          </p>
        ) : (
          <ul className="space-y-0.5 px-3 py-4">
            {lines.map((line) => (
              <li
                key={line.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-b border-white/[0.04] py-1.5 last:border-0 sm:grid-cols-[auto_auto_auto_minmax(0,1fr)]"
              >
                <span className="shrink-0 text-faint tabular-nums">
                  {formatTime(line.createdAt)}
                </span>
                <span className={`shrink-0 ${actionTone(line.action)}`}>{line.action}</span>
                <span className="hidden shrink-0 text-muted sm:inline">
                  {line.username ? `@${line.username}` : line.actorRole}
                </span>
                <span className="min-w-0 truncate text-bone/90">
                  {line.summary}
                  {line.route ? (
                    <span className="ml-2 text-faint">{line.route}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!stickToBottom && !paused ? (
        <button
          type="button"
          onClick={() => {
            setStickToBottom(true);
            const el = scrollerRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          className="text-xs text-accent hover:text-accent-hover"
        >
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
