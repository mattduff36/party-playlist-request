'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Copy, CheckCircle, Monitor, QrCode, Lock, Loader2, Music, Info } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { useRouter, usePathname } from 'next/navigation';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import Checkbox from '@/components/ui/Checkbox';

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
  
  const [event, setEvent] = useState<any>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch event when component mounts OR when event status changes to Live/Standby
  useEffect(() => {
    const fetchEvent = async () => {
      if (state?.isLoading) {
        return;
      }
      // Only fetch if event is Live or Standby (event is ON)
      if (state?.status === 'live' || state?.status === 'standby') {
        try {
          const response = await fetch('/api/events/current', {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            setEvent(data.event);
          }
        } catch (error) {
          console.error('Failed to fetch event:', error);
        }
      } else {
        setEvent(null);
      }
      setLoadingEvent(false);
    };

    fetchEvent();
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

  // Handle Spotify connection — navigate directly so the browser follows the 307 to Spotify.
  // Do not fetch() this endpoint: it returns a redirect, not JSON, so fetch fails silently.
  function handleSpotifyConnect() {
    window.location.href = '/api/spotify/auth';
  }

  useEffect(() => {
    if (eventSettings && typeof eventSettings.secure_url_access === 'boolean') {
      setSecureUrlAccess(Boolean(eventSettings.secure_url_access));
    }
  }, [eventSettings?.secure_url_access]);

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
                    Event expires: {new Date(event.expires_at).toLocaleString()}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Spotify Setup */}
      <div className="bg-elevated rounded-lg p-6">
        <h3 className="text-lg font-semibold text-bone mb-4 flex items-center gap-2">
          <Music className="h-5 w-5 text-accent" />
          Spotify Integration
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
            <div>
              <h4 className="text-bone font-medium">Spotify Connection</h4>
              <p className="text-muted text-sm">Connect your Spotify account to control music playback</p>
            </div>
            <button
              onClick={handleSpotifyConnect}
              className="inline-flex items-center px-4 py-2 bg-accent hover:bg-accent-hover text-bone rounded-lg transition-colors"
            >
              Connect Spotify
            </button>
          </div>
        </div>
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
