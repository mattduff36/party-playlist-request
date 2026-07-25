'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Lock } from 'lucide-react';
import PageLoader from '@/components/ui/PageLoader';
import { isValidAccessCodeFormat } from '@/lib/access-code';

interface DisplayAuthGateProps {
  children: (username: string, accessCode?: string) => ReactNode;
  /** When set, verify this access code and set guest cookie */
  accessCode?: string;
}

async function verifyAndStore(
  username: string,
  code: string
): Promise<{ ok: true; accessCode: string } | { ok: false; error: string }> {
  const response = await fetch('/api/events/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      username,
      accessCode: code,
      pin: code,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || 'Invalid access code' };
  }
  const resolved = data.event?.accessCode || code;
  sessionStorage.setItem(
    `display_auth_${username}`,
    JSON.stringify({
      accessCode: resolved,
      timestamp: Date.now(),
    })
  );
  return { ok: true, accessCode: resolved };
}

export default function DisplayAuthGate({ children, accessCode }: DisplayAuthGateProps) {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const codeFromParams =
    accessCode ||
    (typeof params.accessCode === 'string' ? decodeURIComponent(params.accessCode) : undefined);

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCode, setResolvedCode] = useState<string | undefined>(codeFromParams);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, codeFromParams]);

  async function checkAuth() {
    setLoading(true);
    setError(null);

    try {
      // Owner login bypass
      const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
      if (meResponse.ok) {
        const { user } = await meResponse.json();
        if (user.username === username) {
          setAuthenticated(true);
          setLoading(false);
          return;
        }
        if (!codeFromParams) {
          setError(
            `You're logged in as ${user.username} but trying to access ${username}'s display.`
          );
          setLoading(false);
          return;
        }
      }

      // Prefer URL access code — always re-verify to set guest cookie
      if (codeFromParams && isValidAccessCodeFormat(codeFromParams)) {
        const result = await verifyAndStore(username, codeFromParams);
        if (result.ok) {
          setResolvedCode(result.accessCode);
          setAuthenticated(true);
          setLoading(false);
          return;
        }
        setError(result.error);
        setLoading(false);
        return;
      }

      // SessionStorage fallback — re-verify stored code so cookie is refreshed
      const stored = sessionStorage.getItem(`display_auth_${username}`);
      if (stored) {
        try {
          const auth = JSON.parse(stored);
          if (
            Date.now() - auth.timestamp < 24 * 60 * 60 * 1000 &&
            auth.accessCode &&
            isValidAccessCodeFormat(auth.accessCode)
          ) {
            const result = await verifyAndStore(username, auth.accessCode);
            if (result.ok) {
              setResolvedCode(result.accessCode);
              setAuthenticated(true);
              setLoading(false);
              return;
            }
          }
          sessionStorage.removeItem(`display_auth_${username}`);
        } catch {
          sessionStorage.removeItem(`display_auth_${username}`);
        }
      }

      setError(
        `To open the display, use /${username}/[access-code]/display (code from the admin panel).`
      );
      setLoading(false);
    } catch (err) {
      console.error('Display auth error:', err);
      setError('Failed to authenticate. Please try again.');
      setLoading(false);
    }
  }

  if (loading) {
    return <PageLoader label="Loading display..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ink text-bone flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-elevated rounded-xl shadow-2xl p-8 border border-white/10">
          <div className="flex flex-col items-center mb-6">
            <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
            <h1 className="text-2xl font-bold text-center mb-2">Access Denied</h1>
          </div>

          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            <p>{error}</p>
          </div>

          {error.includes('logged in as') && (
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-accent hover:bg-accent-hover text-ink font-bold py-3 px-4 rounded-lg transition-colors duration-300 mb-3"
            >
              <Lock className="inline h-5 w-5 mr-2" />
              Switch Account
            </button>
          )}

          <button
            onClick={() => router.push('/login')}
            className="w-full bg-white/10 hover:bg-white/15 text-bone font-medium py-2 px-4 rounded-lg transition-colors duration-300"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children(username, resolvedCode)}</>;
}
