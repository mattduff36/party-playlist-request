'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import MoodShell from '@/components/MoodShell';
import PageLoader from '@/components/ui/PageLoader';
import { AccessCodeEntryForm } from '@/components/request/AccessCodeEntryForm';
import { isValidAccessCodeFormat } from '@/lib/access-code';
import {
  fallbackDisplayMoodSettings,
  hasConfirmedDisplayMood,
} from '@/styles/theme';
import type { EventConfig } from '@/lib/db/schema';

/**
 * Legacy / bare request URL: enter access code, then redirect to
 * /{username}/{accessCode}/request
 */
export default function RequestAccessCodeEntryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const bypassToken = searchParams.get('bt');

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [eventSettings, setEventSettings] = useState<EventConfig | null>(null);
  const [moodConfirmed, setMoodConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Legacy QR bypass → verify then redirect into canonical URL
  useEffect(() => {
    if (!bypassToken) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setVerifying(true);
      try {
        const response = await fetch('/api/events/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, bypassToken }),
        });
        const data = await response.json();
        if (!cancelled && response.ok && data.event?.accessCode) {
          router.replace(`/${username}/${data.event.accessCode}/request`);
          return;
        }
        if (!cancelled) {
          setCodeError(data.error || 'Invalid bypass link');
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setCodeError('Connection error. Please try again.');
          setIsLoading(false);
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bypassToken, username, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/public/event-config?username=${encodeURIComponent(username)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data.config) {
            setEventSettings(data.config);
            if (hasConfirmedDisplayMood(data.config)) {
              setMoodConfirmed(true);
            }
          }
        }
      } catch {
        // use fallback mood
      } finally {
        if (!cancelled) {
          setMoodConfirmed(true);
          if (!bypassToken) setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, bypassToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAccessCodeFormat(code)) {
      setCodeError('Enter a valid 6-digit (or secure) access code');
      return;
    }

    setVerifying(true);
    setCodeError('');
    try {
      const response = await fetch('/api/events/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, accessCode: code, pin: code }),
      });
      const data = await response.json();
      if (response.ok) {
        const resolved = data.event?.accessCode || code;
        router.push(`/${username}/${resolved}/request`);
      } else {
        setCodeError(data.error || 'Access denied');
      }
    } catch {
      setCodeError('Connection error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const moodProps = {
    mood: eventSettings?.display_mood ?? fallbackDisplayMoodSettings().display_mood,
    legacyPrimaryColor: eventSettings?.theme_primary_color,
  };

  if (isLoading || !moodConfirmed) {
    return <PageLoader label={verifying ? 'Verifying access...' : 'Loading...'} />;
  }

  return (
    <MoodShell {...moodProps} className="flex flex-col items-center justify-center p-4">
      <AccessCodeEntryForm
        username={username}
        code={code}
        codeError={codeError}
        verifying={verifying}
        onCodeChange={setCode}
        onClearError={() => setCodeError('')}
        onSubmit={handleSubmit}
      />
    </MoodShell>
  );
}
