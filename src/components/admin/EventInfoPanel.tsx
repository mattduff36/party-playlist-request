'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { QrCode, Copy, Monitor, CheckCircle, RefreshCw, Lock, Loader2 } from 'lucide-react';
import { useGlobalEvent } from '@/lib/state/global-event-client';

interface EventInfoPanelProps {
  showHeader?: boolean;
}

export default function EventInfoPanel({ showHeader = true }: EventInfoPanelProps = {}) {
  const pathname = usePathname();
  const username = pathname?.split('/')[1] || '';
  const { state } = useGlobalEvent(); // Listen to event status changes
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch event when component mounts OR when event status changes to Live/Standby
  useEffect(() => {
    // Only fetch if event is Live or Standby (event is ON)
    if (state?.status === 'live' || state?.status === 'standby') {
      console.log('📅 Event is active, fetching event info...');
      fetchEvent();
    } else if (state?.status === 'offline') {
      // Clear event when going offline
      console.log('📅 Event is offline, clearing event info');
      setEvent(null);
      setLoading(false); // Stop loading when offline
    }
  }, [state?.status]); // Re-fetch when status changes

  const fetchEvent = async () => {
    try {
      const response = await fetch('/api/events/current', {
        credentials: 'include' // ✅ CRITICAL: Send JWT cookie for user-specific event
      });
      if (response.ok) {
        const data = await response.json();
        setEvent(data.event);
      }
    } catch (error) {
      console.error('Failed to fetch event:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-elevated rounded-lg p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent mr-3" />
          <span className="text-muted">Loading event info...</span>
        </div>
      </div>
    );
  }

  if (!event || state?.status === 'offline') {
    return (
      <div className="bg-elevated rounded-lg p-6">
        <p className="text-muted text-center">
          {state?.status === 'offline' 
            ? 'No active event - Set event to Live or Standby to start'
            : 'No active event'}
        </p>
      </div>
    );
  }

  const accessCode = event.access_code || event.pin;
  const requestUrl = `${window.location.origin}/${username}/${accessCode}/request`;
  const displayUrl = `${window.location.origin}/${username}/${accessCode}/display`;

  return (
    <div className="bg-elevated rounded-lg p-6 space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-bone">Event Information</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-accent/10 border border-accent/40 rounded-lg px-4 py-2">
              <Lock className="h-4 w-4 text-accent" />
              <span className="text-muted text-sm">Code:</span>
              <span className="text-2xl font-bold text-bone tracking-wider font-mono">{accessCode}</span>
            </div>
            <button
              onClick={fetchEvent}
              className="p-2 hover:bg-surface rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5 text-muted" />
            </button>
          </div>
        </div>
      )}

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
        <p className="text-faint text-xs">
          Share this link or QR — guests do not need to type the access code
        </p>
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
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-surface hover:bg-surface text-bone font-medium py-2 px-4 rounded-lg transition-colors text-center"
        >
          Open Display Screen →
        </a>
        <p className="text-faint text-xs">
          Open this URL on your display screen (TV, projector, etc.)
        </p>
      </div>

      {/* Event Expiry */}
      <div className="text-center text-faint text-xs border-t border-white/10 pt-4">
        Event expires: {new Date(event.expires_at).toLocaleString()}
      </div>
    </div>
  );
}

