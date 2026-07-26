'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Lock } from 'lucide-react';
import PageLoader from '@/components/ui/PageLoader';
import { isValidAccessCodeFormat } from '@/lib/access-code';

export type DisplayRealtimeMode = 'guest' | 'display' | 'owner';

export interface DisplayAuthContext {
  username: string;
  accessCode?: string;
  eventId?: string;
  realtimeMode: DisplayRealtimeMode;
}

interface DisplayAuthGateProps {
  children: (ctx: DisplayAuthContext) => ReactNode;
  /** When set, verify this access code and set guest cookie */
  accessCode?: string;
}

async function verifyAccessCodeAndStore(
  username: string,
  code: string
): Promise<
  | { ok: true; accessCode: string; eventId?: string }
  | { ok: false; error: string }
> {
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
  return {
    ok: true,
    accessCode: resolved,
    eventId: typeof data.event?.id === 'string' ? data.event.id : undefined,
  };
}

async function verifyDisplayToken(
  username: string,
  displayToken: string
): Promise<
  | { ok: true; eventId: string }
  | { ok: false; error: string }
> {
  const response = await fetch('/api/events/verify-display-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, displayToken }),
  });
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || 'Invalid display token' };
  }
  const eventId = data.event?.id;
  if (typeof eventId !== 'string' || !eventId) {
    return { ok: false, error: 'Display session missing event id' };
  }
  return { ok: true, eventId };
}

export default function DisplayAuthGate({ children, accessCode }: DisplayAuthGateProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const codeFromParams =
    accessCode ||
    (typeof params.accessCode === 'string' ? decodeURIComponent(params.accessCode) : undefined);
  const displayTokenFromQuery = searchParams.get('dt')?.trim() || undefined;

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authCtx, setAuthCtx] = useState<DisplayAuthContext | null>(null);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, codeFromParams, displayTokenFromQuery]);

  async function checkAuth() {
    setLoading(true);
    setError(null);

    try {
      // Display token path: ?dt= → verify-display-token → pp_display_access cookie
      if (displayTokenFromQuery) {
        const result = await verifyDisplayToken(username, displayTokenFromQuery);
        if (result.ok) {
          setAuthCtx({
            username,
            eventId: result.eventId,
            realtimeMode: 'display',
          });
          setAuthenticated(true);
          // Drop token from URL so it is not left in history/referrer
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('dt');
            window.history.replaceState({}, '', url.pathname + url.search);
          }
          setLoading(false);
          return;
        }
        setError(result.error);
        setLoading(false);
        return;
      }

      // Owner login bypass
      const meResponse = await fetch('/api/auth/me', { credentials: 'include' });
      if (meResponse.ok) {
        const { user } = await meResponse.json();
        if (user.username === username) {
          setAuthCtx({
            username,
            realtimeMode: 'owner',
          });
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
        const result = await verifyAccessCodeAndStore(username, codeFromParams);
        if (result.ok) {
          setAuthCtx({
            username,
            accessCode: result.accessCode,
            eventId: result.eventId,
            realtimeMode: 'guest',
          });
          setAuthenticated(true);
          setLoading(false);
          return;
        }
        setError(result.error);
        setLoading(false);
        return;
      }

      // Existing display cookie (pp_display_access) — restore without re-consuming token
      const displaySession = await fetch('/api/events/display-session', {
        credentials: 'include',
      });
      if (displaySession.ok) {
        const data = await displaySession.json();
        if (data.eventId && data.username === username) {
          setAuthCtx({
            username,
            eventId: data.eventId,
            realtimeMode: 'display',
          });
          setAuthenticated(true);
          setLoading(false);
          return;
        }
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
            const result = await verifyAccessCodeAndStore(username, auth.accessCode);
            if (result.ok) {
              setAuthCtx({
                username,
                accessCode: result.accessCode,
                eventId: result.eventId,
                realtimeMode: 'guest',
              });
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
        `To open the display, use /${username}/[access-code]/display or a display link with ?dt= (from the admin panel).`
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

  if (!authenticated || !authCtx) {
    return null;
  }

  return <>{children(authCtx)}</>;
}
