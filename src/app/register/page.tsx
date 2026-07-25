'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-bone">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 80% 0%, rgba(245,166,35,0.14), transparent 45%)',
        }}
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-elevated/90 p-8 ss-reveal">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="font-display text-3xl font-bold">Registration closed</h1>
            <p className="mt-2 text-muted">Account creation is invitation-only for now</p>
          </div>

          <div className="mb-6 rounded-xl border border-accent/25 bg-accent/10 p-5">
            <p className="font-semibold text-bone">Limited access</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              We&apos;re in a controlled rollout. New DJ accounts are created by administrators.
              If you want Party Playlist for your events, request access via contact.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/login" className="block">
              <Button className="w-full" size="lg">
                Already have an account? Sign in
              </Button>
            </Link>
            <Link href="/contact" className="block">
              <Button variant="secondary" className="w-full" size="lg">
                Request access
              </Button>
            </Link>
            <Link href="/" className="block text-center text-sm text-faint hover:text-bone">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
