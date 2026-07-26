'use client';

import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import { CreditCard, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface PartyPassEntitlement {
  id: string;
  status: string;
  purchased_at: string;
  use_by_at: string;
  activated_at: string | null;
  starts_at: string | null;
  expires_at: string | null;
  linked_event_id: string | null;
}

interface StatusResponse {
  product: {
    name: string;
    amountPence: number;
    currency: string;
    activeDays: number;
  };
  checkoutEnabled: boolean;
  canStartEvent: boolean;
  reason: string;
  betaActive: boolean;
  active: PartyPassEntitlement | null;
  unactivated: PartyPassEntitlement | null;
  history: PartyPassEntitlement[];
  sessionVerification?: {
    verified: boolean;
    paymentStatus: string | null;
    activated: boolean;
  } | null;
}

function formatMoney(pence: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(pence / 100);
  } catch {
    return `£${(pence / 100).toFixed(2)}`;
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function PartyPassPanel(props: {
  sessionId?: string | null;
  compact?: boolean;
}) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmActivate, setConfirmActivate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (props.sessionId) params.set('session_id', props.sessionId);
      const res = await fetch(`/api/payments/status?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setError('Could not load Party Pass status');
        return;
      }
      const json = (await res.json()) as StatusResponse;
      setData(json);
      if (json.sessionVerification) {
        if (json.sessionVerification.verified) {
          setMessage(
            json.sessionVerification.activated
              ? 'Payment verified. Your pass is already activated.'
              : 'Payment verified. Activate your pass when you are ready — the 30-day window starts then.'
          );
        } else {
          setMessage(
            'Checkout returned, but payment is not verified yet. Refresh shortly or contact support if this persists.'
          );
        }
      }
    } catch {
      setError('Could not load Party Pass status');
    } finally {
      setLoading(false);
    }
  }, [props.sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startCheckout() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await authenticatedFetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Deliberately send misleading client fields — server must ignore
          pricePence: 1,
          userId: 'attacker',
          durationDays: 9999,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Checkout unavailable');
        return;
      }
      if (json.url) {
        // Mock Preview checkout grants entitlement server-side then redirects to success.
        window.location.href = json.url as string;
        return;
      }
      if (json.mock && json.purchaseId) {
        setMessage('Payment accepted (Preview mock). Activate when ready.');
        await load();
        return;
      }
      setError('Checkout session missing redirect URL');
    } catch {
      setError('Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function activatePass() {
    if (!data?.unactivated?.id || !confirmActivate) return;
    setBusy(true);
    setError('');
    try {
      const res = await authenticatedFetch('/api/payments/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entitlementId: data.unactivated.id,
          confirm: true,
          durationDays: 9999, // ignored server-side
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Activation failed');
        return;
      }
      setMessage('Party Pass activated. Your 30-day window has started.');
      setConfirmActivate(false);
      await load();
    } catch {
      setError('Activation failed');
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError('');
    try {
      const res = await authenticatedFetch('/api/payments/portal', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Billing portal unavailable');
        return;
      }
      if (json.url) window.location.href = json.url as string;
    } catch {
      setError('Billing portal failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading Party Pass…
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-red-400">{error || 'Unavailable'}</p>
    );
  }

  const price = formatMoney(data.product.amountPence, data.product.currency);

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 text-amber-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">
            {data.product.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {price} · one active event · {data.product.activeDays}-day window
            starts when you activate (not at purchase).
          </p>
        </div>
      </div>

      <ul className="space-y-1 text-sm text-zinc-400">
        <li>Works with Spotify when connected, or Manual request-only mode (no Spotify required).</li>
        <li>You need internet, a playback device, and speakers for the room.</li>
        <li>Event history stays readable after the pass expires.</li>
      </ul>

      {data.betaActive && (
        <p className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Beta entitlement active — you can start events.
        </p>
      )}

      {data.active && (
        <div className="rounded-md border border-emerald-800/60 bg-emerald-950/40 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Party Pass active
          </p>
          <p className="mt-1 text-zinc-300">
            Started {formatWhen(data.active.starts_at)} · expires{' '}
            {formatWhen(data.active.expires_at)}
          </p>
        </div>
      )}

      {data.unactivated && (
        <div className="rounded-md border border-amber-800/60 bg-amber-950/30 p-3 text-sm space-y-3">
          <p className="flex items-center gap-2 font-medium text-amber-200">
            <Clock className="h-4 w-4" />
            Purchased — not activated
          </p>
          <p className="text-zinc-300">
            Activate by {formatWhen(data.unactivated.use_by_at)}. Activation
            starts your {data.product.activeDays}-day window.
          </p>
          <label className="flex items-start gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={confirmActivate}
              onChange={(e) => setConfirmActivate(e.target.checked)}
              className="mt-1"
            />
            <span>
              I understand activation starts the {data.product.activeDays}-day
              Party Pass window now.
            </span>
          </label>
          <button
            type="button"
            disabled={busy || !confirmActivate}
            onClick={() => void activatePass()}
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            {busy ? 'Activating…' : 'Activate Party Pass'}
          </button>
        </div>
      )}

      {!data.active && !data.unactivated && !data.betaActive && (
        <div className="rounded-md border border-zinc-700 bg-zinc-900/50 p-3 text-sm text-zinc-300">
          <p className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            No active pass. Purchase a Party Pass to run a paid event.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {data.checkoutEnabled ? (
          <button
            type="button"
            disabled={busy || Boolean(data.active || data.unactivated)}
            onClick={() => void startCheckout()}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : `Buy Party Pass — ${price}`}
          </button>
        ) : (
          <p className="text-sm text-zinc-500">
            Checkout is disabled on this deployment (test-mode feature flag).
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void openPortal()}
          className="rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-200"
        >
          Receipts / invoices
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-400"
        >
          Refresh
        </button>
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!props.compact && data.history.length > 0 && (
        <div className="pt-2">
          <h3 className="text-sm font-medium text-zinc-300">Pass history</h3>
          <ul className="mt-2 space-y-1 text-xs text-zinc-500">
            {data.history.slice(0, 8).map((row) => (
              <li key={row.id}>
                {row.status} · purchased {formatWhen(row.purchased_at)}
                {row.expires_at ? ` · expires ${formatWhen(row.expires_at)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
