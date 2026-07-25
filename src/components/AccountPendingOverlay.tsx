import Link from 'next/link';
import { Clock, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';

interface AccountPendingOverlayProps {
  status: 'pending' | 'rejected';
  username: string;
}

export default function AccountPendingOverlay({
  status,
  username,
}: AccountPendingOverlayProps) {
  const isPending = status === 'pending';

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-bone">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 80% 0%, rgba(29,185,84,0.14), transparent 45%)',
        }}
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-elevated/90 p-8 text-center">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              isPending ? 'bg-accent/15 text-accent' : 'bg-red-500/15 text-red-400'
            }`}
          >
            {isPending ? (
              <Clock className="h-7 w-7" aria-hidden />
            ) : (
              <XCircle className="h-7 w-7" aria-hidden />
            )}
          </div>

          {isPending ? (
            <>
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-accent">
                Pending
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold">
                Account pending approval
              </h1>
              <p className="mt-3 text-muted leading-relaxed">
                Hi {username} — you can sign in, but the DJ dashboard is locked until a
                superadmin approves your account.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-red-400">
                Not approved
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold">
                Application not approved
              </h1>
              <p className="mt-3 text-muted leading-relaxed">
                Your account application was not approved. If you think this is a
                mistake, contact support for help.
              </p>
            </>
          )}

          <div className="mt-8 space-y-3">
            <Link href="/contact" className="block">
              <Button variant="secondary" className="w-full" size="lg">
                Contact support
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
