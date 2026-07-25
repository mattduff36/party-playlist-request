'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Activity,
  HeartPulse,
  Search,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import PageLoader from '@/components/ui/PageLoader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { SupportActivityRow, SupportErrorRow } from '@/lib/support/types';

type Panel = 'errors' | 'activity' | 'health' | 'drilldown';

interface HealthPayload {
  health: {
    overall: string;
    checks: Array<{
      name: string;
      status: string;
      message: string;
      responseTime?: number;
    }>;
    summary: { total: number; healthy: number; degraded: number; unhealthy: number };
  };
  unresolvedErrors: number;
  uptimeSeconds: number;
}

export default function SuperAdminSupportPage() {
  const [panel, setPanel] = useState<Panel>('errors');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<SupportErrorRow[]>([]);
  const [errorTotal, setErrorTotal] = useState(0);
  const [resolvedFilter, setResolvedFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [errorSource, setErrorSource] = useState('all');
  const [errorUser, setErrorUser] = useState('');
  const [selectedError, setSelectedError] = useState<SupportErrorRow | null>(null);

  const [activity, setActivity] = useState<SupportActivityRow[]>([]);
  const [activityUser, setActivityUser] = useState('');
  const [activityAction, setActivityAction] = useState('all');

  const [health, setHealth] = useState<HealthPayload | null>(null);

  const [drillUser, setDrillUser] = useState('');
  const [drillEventId, setDrillEventId] = useState('');
  const [drillErrors, setDrillErrors] = useState<SupportErrorRow[]>([]);
  const [drillActivity, setDrillActivity] = useState<SupportActivityRow[]>([]);

  const loadErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        resolved: resolvedFilter,
        source: errorSource,
        limit: '50',
      });
      if (errorUser) params.set('username', errorUser);
      const res = await fetch(`/api/superadmin/support/errors?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setErrors(data.rows || []);
        setErrorTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [resolvedFilter, errorSource, errorUser]);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: activityAction, limit: '50' });
      if (activityUser) params.set('username', activityUser);
      const res = await fetch(`/api/superadmin/support/activity?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setActivity(data.rows || []);
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [activityAction, activityUser]);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/support/health', { credentials: 'include' });
      if (res.ok) setHealth(await res.json());
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (panel === 'errors') void loadErrors();
    if (panel === 'activity') void loadActivity();
    if (panel === 'health') void loadHealth();
  }, [panel, loadErrors, loadActivity, loadHealth]);

  const markResolved = async (id: string) => {
    const res = await fetch('/api/superadmin/support/errors', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setSelectedError(null);
      await loadErrors();
    }
  };

  const runDrilldown = async () => {
    if (!drillUser && !drillEventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (drillUser) params.set('username', drillUser);
      if (drillEventId) params.set('eventId', drillEventId);
      const res = await fetch(`/api/superadmin/support/entity?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDrillErrors(data.errors || []);
        setDrillActivity(data.activity || []);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!ready && loading) {
    return <PageLoader label="Loading support console..." />;
  }

  const panels: { id: Panel; label: string; icon: typeof AlertTriangle }[] = [
    { id: 'errors', label: 'Errors', icon: AlertTriangle },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'health', label: 'Health', icon: HeartPulse },
    { id: 'drilldown', label: 'Drill-down', icon: Search },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Support</h1>
          <p className="mt-1 text-sm text-muted">
            Errors, activity audit, system health, and per-user timelines. Retention: 90 days.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (panel === 'errors') void loadErrors();
            if (panel === 'activity') void loadActivity();
            if (panel === 'health') void loadHealth();
          }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {panels.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              panel === id
                ? 'bg-accent text-ink'
                : 'bg-elevated text-muted hover:text-bone border border-white/10'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {panel === 'errors' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={resolvedFilter}
                onChange={(e) => setResolvedFilter(e.target.value as typeof resolvedFilter)}
                className="rounded-lg border border-white/10 bg-elevated px-3 py-2 text-sm"
              >
                <option value="open">Unresolved</option>
                <option value="resolved">Resolved</option>
                <option value="all">All</option>
              </select>
              <select
                value={errorSource}
                onChange={(e) => setErrorSource(e.target.value)}
                className="rounded-lg border border-white/10 bg-elevated px-3 py-2 text-sm"
              >
                <option value="all">All sources</option>
                <option value="api">API</option>
                <option value="client">Client</option>
                <option value="spotify">Spotify</option>
                <option value="db">DB</option>
                <option value="pusher">Pusher</option>
              </select>
              <Input
                placeholder="Filter username"
                value={errorUser}
                onChange={(e) => setErrorUser(e.target.value)}
                className="max-w-[180px]"
              />
              <Button size="sm" onClick={() => void loadErrors()}>
                Apply
              </Button>
            </div>
            <p className="text-xs text-faint">{errorTotal} matching errors</p>
            <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-elevated/60">
              {errors.length === 0 ? (
                <p className="p-6 text-sm text-muted">No errors found.</p>
              ) : (
                errors.map((err) => (
                  <button
                    key={err.id}
                    type="button"
                    onClick={() => setSelectedError(err)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-surface/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-bone">{err.message}</span>
                      <span className="shrink-0 rounded bg-white/5 px-2 py-0.5 text-xs text-muted">
                        {err.source}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-faint">
                      <span>{new Date(err.created_at).toLocaleString()}</span>
                      {err.username ? <span>@{err.username}</span> : null}
                      {err.route ? <span className="truncate">{err.route}</span> : null}
                      {err.resolved ? (
                        <span className="text-success">resolved</span>
                      ) : (
                        <span className="text-error">open</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-elevated/60 p-4 lg:col-span-2">
            {selectedError ? (
              <div className="space-y-3">
                <h3 className="font-display text-lg font-semibold">Error detail</h3>
                <p className="text-sm text-bone">{selectedError.message}</p>
                <dl className="space-y-1 text-xs text-muted">
                  <div>ID: <code className="text-faint">{selectedError.id}</code></div>
                  <div>Level: {selectedError.level}</div>
                  <div>Source: {selectedError.source}</div>
                  <div>Route: {selectedError.route || '—'}</div>
                  <div>User: {selectedError.username || '—'}</div>
                  <div>When: {new Date(selectedError.created_at).toLocaleString()}</div>
                </dl>
                {selectedError.stack ? (
                  <pre className="max-h-48 overflow-auto rounded-lg bg-ink p-3 text-[11px] text-faint">
                    {selectedError.stack}
                  </pre>
                ) : null}
                {!selectedError.resolved ? (
                  <Button size="sm" onClick={() => void markResolved(selectedError.id)}>
                    <CheckCircle2 className="h-4 w-4" />
                    Mark resolved
                  </Button>
                ) : (
                  <p className="text-xs text-success">
                    Resolved by {selectedError.resolved_by} at{' '}
                    {selectedError.resolved_at
                      ? new Date(selectedError.resolved_at).toLocaleString()
                      : '—'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">Select an error to inspect stack and metadata.</p>
            )}
          </div>
        </div>
      )}

      {panel === 'activity' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Filter username"
              value={activityUser}
              onChange={(e) => setActivityUser(e.target.value)}
              className="max-w-[180px]"
            />
            <select
              value={activityAction}
              onChange={(e) => setActivityAction(e.target.value)}
              className="rounded-lg border border-white/10 bg-elevated px-3 py-2 text-sm"
            >
              <option value="all">All actions</option>
              <option value="auth.login">auth.login</option>
              <option value="auth.logout">auth.logout</option>
              <option value="auth.login_failed">auth.login_failed</option>
              <option value="auth.pin_ok">auth.pin_ok</option>
              <option value="auth.pin_failed">auth.pin_failed</option>
              <option value="request.submit">request.submit</option>
              <option value="request.approve">request.approve</option>
              <option value="request.reject">request.reject</option>
              <option value="settings.update">settings.update</option>
              <option value="spotify.disconnect">spotify.disconnect</option>
            </select>
            <Button size="sm" onClick={() => void loadActivity()}>
              Apply
            </Button>
          </div>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-elevated/60">
            {activity.length === 0 ? (
              <p className="p-6 text-sm text-muted">No activity yet.</p>
            ) : (
              activity.map((row) => (
                <div key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-bone">{row.summary}</span>
                    <code className="text-xs text-accent">{row.action}</code>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-faint">
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                    <span>{row.actor_role}</span>
                    {row.username ? <span>@{row.username}</span> : null}
                    {row.route ? <span>{row.route}</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {panel === 'health' && (
        <div className="space-y-4">
          {health ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-elevated p-4">
                  <p className="text-xs text-muted">Overall</p>
                  <p className="mt-1 font-display text-xl font-bold capitalize">{health.health.overall}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-elevated p-4">
                  <p className="text-xs text-muted">Unresolved errors</p>
                  <p className="mt-1 font-display text-xl font-bold">{health.unresolvedErrors}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-elevated p-4">
                  <p className="text-xs text-muted">Checks healthy</p>
                  <p className="mt-1 font-display text-xl font-bold">
                    {health.health.summary.healthy}/{health.health.summary.total}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-elevated p-4">
                  <p className="text-xs text-muted">Process uptime</p>
                  <p className="mt-1 font-display text-xl font-bold">
                    {Math.floor(health.uptimeSeconds / 60)}m
                  </p>
                </div>
              </div>
              <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-elevated/60">
                {health.health.checks.map((check) => (
                  <div key={check.name} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="font-medium text-bone">{check.name}</p>
                      <p className="text-sm text-muted">{check.message}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold capitalize ${
                        check.status === 'healthy'
                          ? 'bg-success/15 text-success'
                          : check.status === 'degraded'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-error/15 text-error'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <PageLoader label="Running health checks..." fullScreen={false} />
          )}
        </div>
      )}

      {panel === 'drilldown' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <Input
                label="Username"
                placeholder="djname"
                value={drillUser}
                onChange={(e) => setDrillUser(e.target.value)}
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <Input
                label="Event ID"
                placeholder="uuid"
                value={drillEventId}
                onChange={(e) => setDrillEventId(e.target.value)}
              />
            </div>
            <Button onClick={() => void runDrilldown()} disabled={!drillUser && !drillEventId}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-elevated/60 p-4">
              <h3 className="mb-3 font-display font-semibold">Errors</h3>
              {drillErrors.length === 0 ? (
                <p className="text-sm text-muted">No errors for this subject.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {drillErrors.map((e) => (
                    <li key={e.id} className="border-b border-white/5 pb-2">
                      <p className="text-bone">{e.message}</p>
                      <p className="text-xs text-faint">
                        {new Date(e.created_at).toLocaleString()} · {e.source}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-elevated/60 p-4">
              <h3 className="mb-3 font-display font-semibold">Activity</h3>
              {drillActivity.length === 0 ? (
                <p className="text-sm text-muted">No activity for this subject.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {drillActivity.map((a) => (
                    <li key={a.id} className="border-b border-white/5 pb-2">
                      <p className="text-bone">{a.summary}</p>
                      <p className="text-xs text-faint">
                        {new Date(a.created_at).toLocaleString()} · {a.action}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
