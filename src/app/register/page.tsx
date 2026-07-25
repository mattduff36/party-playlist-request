'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  useEffect(() => {
    if (username.length < 3) {
      setUsernameStatus({ checking: false, available: null, message: '' });
      return;
    }

    const handle = setTimeout(async () => {
      setUsernameStatus((prev) => ({ ...prev, checking: true }));
      try {
        const response = await fetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        });
        const data = await response.json();
        setUsernameStatus({
          checking: false,
          available: Boolean(data.available),
          message: data.available
            ? 'Username is available'
            : data.error || 'Username is not available',
        });
      } catch {
        setUsernameStatus({
          checking: false,
          available: null,
          message: '',
        });
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [username]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (usernameStatus.available === false) {
      setError(usernameStatus.message || 'Username is not available');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

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
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md ss-reveal">
          <Link href="/" className="mb-10 flex items-center justify-center gap-2">
            <span className="font-display text-2xl font-bold tracking-tight">
              Party <span className="text-accent">Playlist</span>
            </span>
          </Link>

          <div className="rounded-2xl border border-white/10 bg-elevated/90 p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {success ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h1 className="font-display text-3xl font-bold">Check your email</h1>
                <p className="mt-3 text-muted leading-relaxed">
                  We sent a verification link to <span className="text-bone">{email}</span>.
                  After you verify, you can sign in — the DJ dashboard unlocks once a
                  superadmin approves your account.
                </p>
                <Link href="/login" className="mt-8 block">
                  <Button className="w-full" size="lg">
                    Go to sign in
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="font-display text-3xl font-bold">Apply for an account</h1>
                  </div>
                </div>
                <p className="mt-2 text-muted">
                  Anyone can apply. Access is enabled after admin approval.
                </p>

                {error && (
                  <div className="mt-6 flex items-start gap-3 rounded-lg border border-error/40 bg-error/10 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
                    <p className="text-sm text-bone/90">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <Input
                      label="Username"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      required
                      placeholder="yourname"
                      autoComplete="username"
                      disabled={loading}
                      minLength={3}
                      maxLength={30}
                      pattern="[a-z0-9_-]{3,30}"
                    />
                    {username.length >= 3 && (
                      <p
                        className={`mt-1.5 text-xs ${
                          usernameStatus.checking
                            ? 'text-faint'
                            : usernameStatus.available
                              ? 'text-accent'
                              : usernameStatus.available === false
                                ? 'text-error'
                                : 'text-faint'
                        }`}
                      >
                        {usernameStatus.checking
                          ? 'Checking availability…'
                          : usernameStatus.message}
                      </p>
                    )}
                  </div>
                  <Input
                    label="Email"
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                  <Input
                    label="Password"
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    disabled={loading}
                    minLength={8}
                  />

                  <Button
                    type="submit"
                    disabled={loading || usernameStatus.available === false}
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      'Apply for an account'
                    )}
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-muted">
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    className="font-semibold text-accent hover:text-accent-hover"
                  >
                    Sign in
                  </Link>
                </p>
                <p className="mt-3 text-center">
                  <Link href="/" className="text-sm text-faint hover:text-bone">
                    ← Back to home
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
