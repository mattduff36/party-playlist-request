'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import PartyPassPanel from '@/components/payments/PartyPassPanel';

function PartyPassAccountInner() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const checkout = params.get('checkout');

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-400/80">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Party Pass
        </h1>
        {checkout === 'cancelled' && (
          <p className="mt-3 text-sm text-amber-200">
            Checkout cancelled — no charge was made.
          </p>
        )}
        {checkout === 'success' && (
          <p className="mt-3 text-sm text-zinc-400">
            Returning from Checkout. Status below is verified server-side — the
            success URL alone never grants access.
          </p>
        )}

        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <PartyPassPanel sessionId={sessionId} />
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          <Link href="/pricing" className="text-zinc-300 underline">
            Pricing
          </Link>
          {' · '}
          <Link href="/legal/refund" className="text-zinc-300 underline">
            Refund policy
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function PartyPassAccountPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 p-8 text-zinc-400">
          Loading Party Pass…
        </main>
      }
    >
      <PartyPassAccountInner />
    </Suspense>
  );
}
