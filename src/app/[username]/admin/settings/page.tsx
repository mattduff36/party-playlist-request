'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Copy, CheckCircle, Monitor, QrCode, Lock, Loader2, Music, Info } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { useRouter, usePathname } from 'next/navigation';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import Checkbox from '@/components/ui/Checkbox';
import PartyPassPanel from '@/components/payments/PartyPassPanel';

export default function SettingsPage() {
  const { eventSettings, loading, updateEventSettings } = useAdminData();
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useGlobalEvent();
  const username = pathname?.split('/')[1] || '';
  const formHydratedRef = useRef(false);
  
  const [formData, setFormData] = useState({
    event_title: '',
    request_limit: 10,
    auto_approve: false,
    decline_explicit: false,
  });
  const [secureUrlAccess, setSecureUrlAccess] = useState(false);
  const [savingSecure, setSavingSecure] = useState(false);
  
  const [event, setEvent] = useState<{
    id: string;
    event_title?: string | null;
    status?: string | null;
    created_at?: string | null;
    access_code?: string | null;
    pin?: string | null;
    expires_at?: string | null;
  } | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [playbackMode, setPlaybackMode] = useState<'spotify' | 'manual'>('spotify');
  const [savingMode, setSavingMode] = useState(false);
  const [modeMessage, setModeMessage] = useState('');

  // Fetch event when hydrate finishes or status becomes live/standby
  useEffect(() => {
    if (state?.isLoading) {
      return;
    }

    let cancelled = false;

    const fetchEvent = async () => {
      setLoadingEvent(true);
      try {
        if (state?.status === 'live' || state?.status === 'standby') {
          const response = await fetch('/api/events/current', {
            credentials: 'include',
            signal: AbortSignal.timeout(12_000),
          });
          if (!cancelled && response.ok) {
            const data = await response.json();
            setEvent(data.event ?? null);
          }
        } else if (!cancelled) {
          setEvent(null);
        }
      } catch (error) {
        console.error('Failed to fetch event:', error);
      } finally {
        if (!cancelled) {
          setLoadingEvent(false);
        }
      }
    };

    void fetchEvent();
    return () => {
      cancelled = true;
    };
  }, [state?.status, state?.isLoading]);

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  useEffect(() => {
    if (eventSettings && typeof eventSettings.secure_url_access === 'boolean') {
      setSecureUrlAccess(Boolean(eventSettings.secure_url_access));
    }
  }, [eventSettings?.secure_url_access]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/playback-mode', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && (data.mode === 'manual' || data.mode === 'spotify')) {
          setPlaybackMode(data.mode);
        }
      } catch {
        /* default spotify */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlaybackModeChange = async (mode: 'spotify' | 'manual') => {
    setSavingMode(true);
    setModeMessage('');
    try {
      const { authenticatedFetch } = await import('@/lib/api/authenticated-fetch');
      const res = await authenticatedFetch('/api/admin/playback-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setModeMessage(data.error || 'Failed to update playback mode');
        return;
      }
      setPlaybackMode(mode);
      setModeMessage(
        mode === 'manual'
          ? 'Switched to Manual request mode. Spotify controls are hidden.'
          : 'Switched to Spotify mode. Approved requests are not re-queued automatically.'
      );
    } catch {
      setModeMessage('Network error updating playback mode');
    } finally {
      setSavingMode(false);
    }
  };

  // One-shot hydrate — do not wipe mid-edit on background settings refresh
  useEffect(() => {
    if (eventSettings && !formHydratedRef.current) {
      formHydratedRef.current = true;
      setFormData({
        event_title: eventSettings.event_title || '',
        request_limit: eventSettings.request_limit || 10,
        auto_approve: eventSettings.auto_approve || false,
        decline_explicit: eventSettings.decline_explicit || false,
      });
    }
  }, [eventSettings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');

    console.log('🔧 Settings form submission:', {
      formData,
      auto_approve: formData.auto_approve,
      decline_explicit: formData.decline_explicit,
      request_limit: formData.request_limit
    });

    try {
      await updateEventSettings(formData);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('❌ Settings save error:', error);
      setSaveMessage('Error saving settings. Please try again.');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-elevated rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-surface rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-surface rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-surface rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-elevated rounded-lg p-6">
        <PartyPassPanel compact />
      </div>

      <div className="bg-elevated rounded-lg p-6">
        <h2 className="text-2xl font-bold text-bone mb-6">Event Settings</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Title */}
          <div>
            <label htmlFor="event_title" className="block text-sm font-medium text-muted mb-2">
              Event Title
            </label>
            <input
              type="text"
              id="event_title"
              name="event_title"
              value={formData.event_title}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Enter event title..."
            />
            <p className="text-faint text-sm mt-1">
              This will be displayed on the main request page
            </p>
          </div>

          {/* Request Limit */}
          <div>
            <label htmlFor="request_limit" className="block text-sm font-medium text-muted mb-2">
              Request Limit per User
            </label>
            <input
              type="number"
              id="request_limit"
              name="request_limit"
              value={formData.request_limit}
              onChange={handleInputChange}
              min="1"
              max="50"
              className="w-full px-4 py-3 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <p className="text-faint text-sm mt-1">
              Maximum number of songs each user can request
            </p>
          </div>


          {/* Playback provider mode (PRD-07) */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold text-bone mb-2 flex items-center gap-2">
              <Info className="h-5 w-5 text-accent" />
              Playback mode
            </h3>
            <p className="text-faint text-sm mb-4">
              What this mode does: Manual request mode collects and moderates song
              requests for your event. PartyPlaylist does not play music itself —
              use any separate device or service for playback.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={savingMode || playbackMode === 'spotify'}
                onClick={() => void handlePlaybackModeChange('spotify')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  playbackMode === 'spotify'
                    ? 'bg-accent/20 border-accent text-bone'
                    : 'border-white/15 text-muted hover:bg-white/5'
                } disabled:opacity-60`}
              >
                Spotify
              </button>
              <button
                type="button"
                disabled={savingMode || playbackMode === 'manual'}
                onClick={() => void handlePlaybackModeChange('manual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  playbackMode === 'manual'
                    ? 'bg-accent/20 border-accent text-bone'
                    : 'border-white/15 text-muted hover:bg-white/5'
                } disabled:opacity-60`}
              >
                Manual request mode
              </button>
            </div>
            {modeMessage ? (
              <p className="text-sm text-muted mt-3">{modeMessage}</p>
            ) : null}
          </div>

          {/* Request Management Section */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold text-bone mb-4 flex items-center gap-2">
              <Music className="h-5 w-5 text-accent" />
              Request Management
            </h3>
            
            <div className="space-y-4">
              {/* Auto-approve checkbox */}
              <div>
                <div className="flex items-center">
                  <Checkbox
                    id="auto_approve"
                    name="auto_approve"
                    checked={formData.auto_approve}
                    onChange={handleCheckboxChange}
                  />
                  <label htmlFor="auto_approve" className="ml-3 text-sm font-medium text-muted">
                    Auto-approve all requests
                  </label>
                </div>
                <p className="text-faint text-sm mt-2 ml-7">
                  When enabled, all song requests will be automatically approved and added to the queue
                </p>
              </div>

              {/* Decline explicit checkbox */}
              <div>
                <div className="flex items-center">
                  <Checkbox
                    id="decline_explicit"
                    name="decline_explicit"
                    checked={formData.decline_explicit}
                    onChange={handleCheckboxChange}
                  />
                  <label htmlFor="decline_explicit" className="ml-3 text-sm font-medium text-muted">
                    Auto-decline explicit songs
                  </label>
                </div>
                <p className="text-faint text-sm mt-2 ml-7">
                  When enabled, any song request marked as EXPLICIT will be automatically declined
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4">
            <div>
              {saveMessage && (
                <p className={`text-sm ${
                  saveMessage.includes('Error') ? 'text-red-400' : 'text-accent'
                }`}>
                  {saveMessage}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-3 bg-accent hover:bg-accent disabled:bg-accent/40 text-bone font-medium rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>


      {/* Event Information */}
      <div className="bg-elevated rounded-lg p-6">
        <h3 className="text-lg font-semibold text-bone mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2 text-accent" />
          Event Information
        </h3>
        
        {loadingEvent ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-accent mr-3" />
            <span className="text-muted">Loading event info...</span>
          </div>
        ) : !event || state?.status === 'offline' ? (
          <div className="p-4 bg-surface/30 rounded-lg border border-white/10">
            <p className="text-muted text-center">
              {state?.status === 'offline' 
                ? 'No active event - Set event to Live or Standby to view information'
                : 'No active event'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const accessCode = event.access_code || event.pin;
              const requestUrl = `${window.location.origin}/${username}/${accessCode}/request`;
              const displayUrl = `${window.location.origin}/${username}/${accessCode}/display`;
              return (
                <>
                  <div className="flex items-center justify-between p-4 bg-accent/10 border border-accent/40 rounded-lg">
                    <div>
                      <h4 className="text-bone font-medium mb-1">Access code</h4>
                      <p className="text-muted text-sm">
                        Included in guest links; guests scanning the QR do not need to type it
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Lock className="h-5 w-5 text-accent" />
                      <span className="text-3xl font-bold text-bone tracking-wider font-mono">
                        {accessCode}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-muted font-medium flex items-center">
                      <QrCode className="h-5 w-5 mr-2 text-accent" />
                      Request / QR URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={requestUrl}
                        readOnly
                        className="flex-1 px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone text-sm overflow-x-auto"
                      />
                      <button
                        onClick={() => copyToClipboard(requestUrl, 'requestUrl')}
                        className="p-2 bg-surface hover:bg-surface rounded-lg transition-colors"
                        title="Copy URL"
                      >
                        {copied === 'requestUrl' ? (
                          <CheckCircle className="h-5 w-5 text-accent" />
                        ) : (
                          <Copy className="h-5 w-5 text-muted" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 border-t border-white/10 pt-6">
                    <label className="block text-muted font-medium flex items-center">
                      <Monitor className="h-5 w-5 mr-2 text-accent" />
                      Display Screen URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={displayUrl}
                        readOnly
                        className="flex-1 px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone text-sm overflow-x-auto"
                      />
                      <button
                        onClick={() => copyToClipboard(displayUrl, 'displayUrl')}
                        className="p-2 bg-surface hover:bg-surface rounded-lg transition-colors"
                        title="Copy URL"
                      >
                        {copied === 'displayUrl' ? (
                          <CheckCircle className="h-5 w-5 text-accent" />
                        ) : (
                          <Copy className="h-5 w-5 text-muted" />
                        )}
                      </button>
                    </div>
                    <p className="text-faint text-xs">
                      Open this URL on your display screen (TV, projector, etc.)
                    </p>
                  </div>

                  <div className="text-center text-faint text-xs border-t border-white/10 pt-4">
                    Event expires:{' '}
                    {event.expires_at
                      ? new Date(event.expires_at).toLocaleString()
                      : '—'}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* PRD-08: templates, signage, guardrails */}
      <div className="bg-elevated rounded-lg p-6 border border-white/10 space-y-4">
        <h3 className="text-lg font-semibold text-bone">Event templates &amp; beta assets</h3>
        <p className="text-muted text-sm">
          Templates initialise settings (they do not lock them). Signage PDFs are
          print-ready; access codes print only when you opt in.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['blank', 'Blank'],
              ['birthday', 'Birthday'],
              ['anniversary', 'Anniversary'],
              ['house_party', 'House party'],
              ['wedding_reception', 'Wedding reception'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={async () => {
                try {
                  const { authenticatedFetch } = await import(
                    '@/lib/api/authenticated-fetch'
                  );
                  const res = await authenticatedFetch('/api/admin/templates', {
                    method: 'POST',
                    body: JSON.stringify({ templateId: id }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Template failed');
                  setSaveMessage(`Applied template: ${label}`);
                  setTimeout(() => setSaveMessage(''), 3000);
                  window.location.reload();
                } catch (err) {
                  setSaveMessage(
                    err instanceof Error ? err.message : 'Template failed'
                  );
                  setTimeout(() => setSaveMessage(''), 3000);
                }
              }}
              className="rounded border border-white/15 px-3 py-1.5 text-xs text-bone hover:border-accent"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {(['a4', 'a5', 'table_card', 'screen_16x9'] as const).map((format) => (
            <a
              key={format}
              href={`/api/admin/signage?format=${format}`}
              className="rounded border border-white/15 px-3 py-1.5 text-xs text-bone hover:border-accent"
            >
              Download {format} PDF
            </a>
          ))}
        </div>
        <div className="flex items-start justify-between gap-4 p-4 bg-surface rounded-lg">
          <div>
            <h4 className="text-bone font-medium">Print access code on signage</h4>
            <p className="text-muted text-sm mt-1">
              Off by default. Only enable if you want the code visible on posters.
            </p>
          </div>
          <Checkbox
            checked={Boolean(
              (eventSettings as { print_access_code_on_signage?: boolean } | null)
                ?.print_access_code_on_signage
            )}
            onChange={async (e) => {
              try {
                await updateEventSettings({
                  print_access_code_on_signage: e.target.checked,
                } as never);
                setSaveMessage('Signage access-code preference saved.');
                setTimeout(() => setSaveMessage(''), 3000);
              } catch {
                setSaveMessage('Failed to save signage preference.');
                setTimeout(() => setSaveMessage(''), 3000);
              }
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            Artist cooldown (minutes)
            <input
              type="number"
              min={0}
              defaultValue={
                (eventSettings as { artist_cooldown_minutes?: number } | null)
                  ?.artist_cooldown_minutes ?? 0
              }
              onBlur={async (e) => {
                const { authenticatedFetch } = await import(
                  '@/lib/api/authenticated-fetch'
                );
                await authenticatedFetch('/api/admin/guardrails', {
                  method: 'PUT',
                  body: JSON.stringify({
                    artist_cooldown_minutes: Number(e.target.value) || 0,
                  }),
                });
              }}
              className="mt-1 w-full rounded border border-white/10 bg-surface px-3 py-2 text-bone"
            />
          </label>
          <label className="block text-sm text-muted">
            Max active requests per guest
            <input
              type="number"
              min={0}
              placeholder="Unlimited"
              defaultValue={
                (
                  eventSettings as {
                    max_active_requests_per_guest?: number | null;
                  } | null
                )?.max_active_requests_per_guest ?? ''
              }
              onBlur={async (e) => {
                const { authenticatedFetch } = await import(
                  '@/lib/api/authenticated-fetch'
                );
                const raw = e.target.value.trim();
                await authenticatedFetch('/api/admin/guardrails', {
                  method: 'PUT',
                  body: JSON.stringify({
                    max_active_requests_per_guest:
                      raw === '' ? null : Number(raw),
                  }),
                });
              }}
              className="mt-1 w-full rounded border border-white/10 bg-surface px-3 py-2 text-bone"
            />
          </label>
        </div>
        <p className="text-faint text-xs">
          Manage must-play / do-not-play lists via{' '}
          <code className="text-muted">PUT /api/admin/guardrails</code> (JSON
          arrays). Guest-facing duplicate/cooldown copy is returned from that API.
        </p>
      </div>

      {/* Advanced Settings */}
      <div className="bg-elevated rounded-lg p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-bone mb-2">Advanced Settings</h3>
        <p className="text-muted text-sm mb-6">
          Optional security controls. Changing Secure URL access regenerates the active
          event&apos;s access code — old QR codes and links will stop working.
        </p>
        <div className="flex items-start justify-between gap-4 p-4 bg-surface rounded-lg">
          <div className="min-w-0">
            <h4 className="text-bone font-medium">Secure URL access</h4>
            <p className="text-muted text-sm mt-1">
              {secureUrlAccess
                ? 'Guest links use a longer random code (harder to guess).'
                : 'Guest links use a 6-digit code (easy to type).'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {savingSecure && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
            <Checkbox
              checked={secureUrlAccess}
              disabled={savingSecure}
              onChange={async (e) => {
                const next = e.target.checked;
                const previous = secureUrlAccess;
                setSecureUrlAccess(next);
                setSavingSecure(true);
                try {
                  await updateEventSettings({ secure_url_access: next });
                  // Refresh event so nav / URLs pick up regenerated code
                  if (state?.status === 'live' || state?.status === 'standby') {
                    const response = await fetch('/api/events/current', {
                      credentials: 'include',
                    });
                    if (response.ok) {
                      const data = await response.json();
                      setEvent(data.event);
                      window.dispatchEvent(new CustomEvent('pp:access-code-changed'));
                    }
                  }
                  setSaveMessage(
                    next
                      ? 'Secure URL access enabled — access code regenerated.'
                      : 'Secure URL access disabled — access code regenerated.'
                  );
                  setTimeout(() => setSaveMessage(''), 4000);
                } catch (error) {
                  console.error('Failed to update secure URL access:', error);
                  setSecureUrlAccess(previous);
                  setSaveMessage('Failed to update Secure URL access.');
                  setTimeout(() => setSaveMessage(''), 3000);
                } finally {
                  setSavingSecure(false);
                }
              }}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
