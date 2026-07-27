'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';
import { READINESS_CHECKS, type ReadinessCheckId } from '@/lib/beta/readiness';

interface Evaluation {
  score: number;
  canMarkReady: boolean;
  blockingFailures: ReadinessCheckId[];
  warningFailures: ReadinessCheckId[];
  readyConfirmPending?: boolean;
}

interface ReadinessWizardProps {
  username: string;
}

export default function ReadinessWizard({ username }: ReadinessWizardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [score, setScore] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [lifecyclePhase, setLifecyclePhase] = useState('draft');
  const [playbackMode, setPlaybackMode] = useState('spotify');
  const [eventTitle, setEventTitle] = useState('');
  const [venueLabel, setVenueLabel] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/admin/readiness');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load readiness');
      setStep(data.state?.currentStep || 1);
      setScore(data.evaluation?.score ?? data.readinessScore ?? 0);
      setEvaluation(data.evaluation);
      setLifecyclePhase(data.lifecyclePhase || 'draft');
      setPlaybackMode(data.playbackMode || 'spotify');
      setVenueLabel(data.venueLabel || '');
      if (data.scheduledStartAt) {
        setScheduledStartAt(String(data.scheduledStartAt).slice(0, 16));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authenticatedFetch('/api/admin/readiness', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Save failed');
      }
      setEvaluation(data.evaluation);
      setScore(data.evaluation?.score ?? score);
      if (data.lifecyclePhase) setLifecyclePhase(data.lifecyclePhase);
      if (data.state?.currentStep) setStep(data.state.currentStep);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const completeStep = async (checkId: ReadinessCheckId, nextStep: number) => {
    await patch({
      currentStep: nextStep,
      check: { id: checkId, completed: true },
    });
    setStep(nextStep);
  };

  const saveBasics = async () => {
    const data = await patch({
      currentStep: 2,
      basics: {
        eventTitle: eventTitle || 'Party Playlist',
        venueLabel: venueLabel || null,
        scheduledStartAt: scheduledStartAt || null,
      },
      check: { id: 'basics', completed: true },
    });
    if (data) setStep(2);
  };

  const setMode = async (mode: 'spotify' | 'manual') => {
    const res = await authenticatedFetch('/api/admin/playback-mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to set playback mode');
      return;
    }
    setPlaybackMode(mode);
    await completeStep('playback_mode', 3);
  };

  const markReady = async (allowWarningOverride: boolean) => {
    const data = await patch({
      markReady: true,
      allowWarningOverride,
      overrideReason: allowWarningOverride ? overrideReason : null,
    });
    if (data) {
      setMessage('Event marked Ready.');
      setLifecyclePhase('ready');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400 p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading readiness wizard…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Event readiness · {username}
        </p>
        <h1 className="text-2xl font-semibold text-zinc-100">
          Guided setup checklist
        </h1>
        <p className="text-sm text-zinc-400">
          Score {score}% · Phase: {lifecyclePhase} · Mode: {playbackMode}
        </p>
        <div className="h-2 rounded bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          {message}
        </div>
      )}

      <ol className="grid gap-2 sm:grid-cols-2 text-xs text-zinc-400">
        {READINESS_CHECKS.map((c) => {
          const pendingConfirm =
            c.id === 'ready_confirm' && Boolean(evaluation?.readyConfirmPending);
          const blocked = evaluation?.blockingFailures?.includes(c.id);
          return (
            <li key={c.id} className="flex items-center gap-2">
              {blocked || pendingConfirm ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
              )}
              <span>
                {c.step}. {c.label}
              </span>
            </li>
          );
        })}
      </ol>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
        {step === 1 && (
          <>
            <h2 className="text-lg text-zinc-100">1. Name, date/time, venue</h2>
            <label className="block text-sm text-zinc-300">
              Event title
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Birthday Party"
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Venue label (optional)
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={venueLabel}
                onChange={(e) => setVenueLabel(e.target.value)}
              />
            </label>
            <label className="block text-sm text-zinc-300">
              Scheduled start (optional)
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={scheduledStartAt}
                onChange={(e) => setScheduledStartAt(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveBasics()}
              className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg text-zinc-100">2. Playback mode</h2>
            <p className="text-sm text-zinc-400">
              Choose Spotify (device required) or Manual text requests (no Spotify).
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void setMode('spotify')}
                className="rounded border border-zinc-600 px-4 py-2 text-sm hover:border-emerald-500"
              >
                Spotify mode
              </button>
              <button
                type="button"
                onClick={() => void setMode('manual')}
                className="rounded border border-zinc-600 px-4 py-2 text-sm hover:border-emerald-500"
              >
                Manual mode
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg text-zinc-100">3. Spotify / device</h2>
            {playbackMode === 'manual' ? (
              <p className="text-sm text-zinc-400">
                Manual mode selected — Spotify connect is not required.
              </p>
            ) : (
              <p className="text-sm text-zinc-400">
                Connect Spotify and select a playback device on the Spotify page,
                then mark this step complete.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {playbackMode !== 'manual' && (
                <a
                  href={`/${username}/admin/spotify`}
                  className="rounded border border-zinc-600 px-4 py-2 text-sm hover:border-emerald-500"
                >
                  Open Spotify settings
                </a>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void completeStep(
                    playbackMode === 'manual' ? 'playback_mode' : 'spotify_device',
                    4
                  ).then(() => {
                    if (playbackMode !== 'manual') {
                      void patch({
                        check: { id: 'spotify_connect', completed: true },
                      });
                    }
                  })
                }
                className="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
              >
                Mark complete
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg text-zinc-100">4. Moderation</h2>
            <p className="text-sm text-zinc-400">
              Confirm auto-approve, explicit filter, and request limits on Settings,
              then continue.
            </p>
            <a
              href={`/${username}/admin/settings`}
              className="inline-block rounded border border-zinc-600 px-4 py-2 text-sm"
            >
              Open settings
            </a>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeStep('moderation', 5)}
              className="ml-3 rounded bg-emerald-600 px-4 py-2 text-sm text-white"
            >
              Continue
            </button>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="text-lg text-zinc-100">5. Guest access</h2>
            <p className="text-sm text-zinc-400">
              Start standby/live when ready to mint an access code. Review page
              toggles for guest/display.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeStep('guest_access', 6)}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
            >
              Continue
            </button>
          </>
        )}

        {step === 6 && (
          <>
            <h2 className="text-lg text-zinc-100">6. Display / theme</h2>
            <a
              href={`/${username}/admin/display`}
              className="inline-block rounded border border-zinc-600 px-4 py-2 text-sm"
            >
              Open display
            </a>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeStep('display_theme', 7)}
              className="ml-3 rounded bg-emerald-600 px-4 py-2 text-sm text-white"
            >
              Continue
            </button>
          </>
        )}

        {step === 7 && (
          <>
            <h2 className="text-lg text-zinc-100">7. QR / signage</h2>
            <p className="text-sm text-zinc-400">
              Preview and download print-ready PDFs (A4, A5, table card, 16:9).
            </p>
            <div className="flex flex-wrap gap-2">
              {(['a4', 'a5', 'table_card', 'screen_16x9'] as const).map((f) => (
                <a
                  key={f}
                  href={`/api/admin/signage?format=${f}`}
                  className="rounded border border-zinc-600 px-3 py-1.5 text-xs"
                >
                  Download {f}
                </a>
              ))}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeStep('signage', 8)}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
            >
              Continue
            </button>
          </>
        )}

        {step === 8 && (
          <>
            <h2 className="text-lg text-zinc-100">8. End-to-end test</h2>
            <p className="text-sm text-zinc-400">
              Submit a test guest request and approve it once, then mark complete.
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeStep('e2e_test', 9)}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
            >
              Test done — continue
            </button>
          </>
        )}

        {step >= 9 && (
          <>
            <h2 className="text-lg text-zinc-100">9. Recovery + Ready</h2>
            <p className="text-sm text-zinc-400">
              Review the recovery centre, then click Mark event Ready. That click
              is the final confirmation. Warnings need an explicit override reason.
            </p>
            {lifecyclePhase === 'ended' && (
              <p className="text-sm text-amber-200">
                This event has ended. Mark event Ready to restart the lifecycle
                for another run.
              </p>
            )}
            {lifecyclePhase === 'archived' && (
              <p className="text-sm text-amber-200">
                This event is archived and cannot be marked Ready. Start a new
                event first.
              </p>
            )}
            <a
              href={`/${username}/admin/recovery`}
              className="inline-block rounded border border-zinc-600 px-4 py-2 text-sm"
            >
              Open recovery centre
            </a>
            <button
              type="button"
              disabled={saving}
              onClick={() => void completeStep('recovery', 9)}
              className="ml-3 rounded border border-zinc-600 px-4 py-2 text-sm"
            >
              Recovery reviewed
            </button>

            {evaluation && evaluation.warningFailures.length > 0 && (
              <label className="block text-sm text-amber-200">
                Override reason for warnings
                <input
                  className="mt-1 w-full rounded border border-amber-700/50 bg-zinc-950 px-3 py-2 text-zinc-100"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why warnings are acceptable"
                />
              </label>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={saving || lifecyclePhase === 'archived'}
                onClick={() => void markReady(false)}
                className="rounded bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Mark event Ready
              </button>
              {evaluation && evaluation.warningFailures.length > 0 && (
                <button
                  type="button"
                  disabled={
                    saving ||
                    !overrideReason.trim() ||
                    lifecyclePhase === 'archived'
                  }
                  onClick={() => void markReady(true)}
                  className="rounded border border-amber-500 px-4 py-2 text-sm text-amber-100 disabled:opacity-50"
                >
                  Ready with warning override
                </button>
              )}
            </div>
            {evaluation && !evaluation.canMarkReady && (
              <p className="text-xs text-amber-300">
                Blocking: {evaluation.blockingFailures.join(', ') || 'none'}.
                Warnings: {evaluation.warningFailures.join(', ') || 'none'}.
              </p>
            )}
            {evaluation?.canMarkReady && evaluation.readyConfirmPending && (
              <p className="text-xs text-zinc-400">
                All required checks passed. Click Mark event Ready to confirm.
              </p>
            )}
          </>
        )}
      </section>

      <div className="flex justify-between text-sm">
        <button
          type="button"
          disabled={step <= 1 || saving}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="inline-flex items-center gap-1 text-zinc-400 disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="text-zinc-400 hover:text-zinc-200"
        >
          Refresh status
        </button>
      </div>
    </div>
  );
}
