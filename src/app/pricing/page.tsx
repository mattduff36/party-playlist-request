'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import PartyPassPanel from '@/components/payments/PartyPassPanel';

export default function PricingPage() {
  useEffect(() => {
    void fetch('/api/payments/status?view=pricing', { credentials: 'include' }).catch(
      () => undefined
    );
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-400/80">
          PartyPlaylist
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Party Pass
        </h1>
        <p className="mt-3 max-w-xl text-zinc-400">
          One-off access for a single active event. Buy in advance, activate when
          you are ready — that is when the 30-day window starts.
        </p>

        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <PartyPassPanel />
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/account/party-pass" className="text-amber-300 underline">
            Manage your Party Pass
          </Link>
          {' · '}
          <Link href="/login" className="text-zinc-300 underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
