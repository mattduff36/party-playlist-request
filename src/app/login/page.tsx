'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import SessionTransferModal from '@/components/admin/SessionTransferModal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState<{
    username: string;
    password: string;
    sessionInfo?: {
      created_at: string;
      device_info?: string;
    };
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      if (data.requiresTransfer) {
        setTransferData({ ...data, password });
        setShowTransferModal(true);
        setLoading(false);
        return;
      }

      if (data.user?.role === 'superadmin') {
        router.push('/superadmin');
        return;
      }

      router.push(`/${username}/admin/overview`);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  async function handleTransferSession() {
    if (!transferData) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/transfer-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: transferData.username,
          password: transferData.password,
        }),
      });

      if (!response.ok) {
        setError('Failed to transfer session');
        setLoading(false);
        setShowTransferModal(false);
        return;
      }

      setShowTransferModal(false);
      router.push(`/${transferData.username}/admin/overview`);
    } catch {
      setError('Network error during transfer');
      setLoading(false);
      setShowTransferModal(false);
    }
  }

  function handleCancelTransfer() {
    setShowTransferModal(false);
    setTransferData(null);
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-bone">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(29,185,84,0.16), transparent 45%), radial-gradient(ellipse at 100% 80%, rgba(29,185,84,0.06), transparent 40%)',
        }}
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md ss-reveal">
          <Link href="/" className="mb-10 flex items-center justify-center gap-2">
            <span className="font-display text-2xl font-bold tracking-tight">
              Party <span className="text-accent">Playlist</span>
            </span>
          </Link>

          <div className="rounded-2xl border border-white/10 bg-elevated/90 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <h1 className="font-display text-3xl font-bold">Welcome back</h1>
            <p className="mt-1 text-muted">Sign in to run your event</p>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-error/40 bg-error/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
                <p className="text-sm text-bone/90">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <Input
                label="Username"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
                placeholder="yourname"
                autoComplete="username"
                disabled={loading}
              />
              <Input
                label="Password"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />

              <div className="text-right">
                <Link href="/auth/forgot-password" className="text-sm text-accent hover:text-accent-hover">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              No account?{' '}
              <Link href="/register" className="font-semibold text-accent hover:text-accent-hover">
                Request access
              </Link>
            </p>
            <p className="mt-3 text-center">
              <Link href="/" className="text-sm text-faint hover:text-bone">
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>

      <SessionTransferModal
        isOpen={showTransferModal && !!transferData}
        onTransfer={handleTransferSession}
        onCancel={handleCancelTransfer}
        sessionInfo={transferData?.sessionInfo}
      />
    </div>
  );
}
