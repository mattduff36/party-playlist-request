'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { QrCode, Copy, Monitor, CheckCircle, RefreshCw, Loader2, Lock } from 'lucide-react';

export default function EventInfoPanel() {
  const pathname = usePathname();
  const username = pathname?.split('/')[1] || '';
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayToken, setDisplayToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchEvent();
  }, []);

  const fetchEvent = async () => {
    try {
      const response = await fetch('/api/events/current');
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

  const generateDisplayToken = async () => {
    setGeneratingToken(true);
    try {
      const response = await fetch('/api/events/display-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usesRemaining: 999, hoursValid: 24 })
      });

      if (response.ok) {
        const data = await response.json();
        setDisplayToken(data.displayToken.token);
      } else {
        console.error('Failed to generate display token');
      }
    } catch (error) {
      console.error('Error generating display token:', error);
    } finally {
      setGeneratingToken(false);
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
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500 mr-3" />
          <span className="text-gray-400">Loading event info...</span>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400 text-center">No active event</p>
      </div>
    );
  }

  const requestUrl = `${window.location.origin}/${username}/request`;
  const requestUrlWithBypass = `${requestUrl}?bt=${event.bypass_token}`;
  const displayUrl = displayToken 
    ? `${window.location.origin}/${username}/display?dt=${displayToken}`
    : null;

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Event Information</h2>
        <button
          onClick={fetchEvent}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* PIN Display */}
      <div className="bg-purple-900/30 border-2 border-purple-600 rounded-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Lock className="h-5 w-5 text-purple-400 mr-2" />
            <span className="text-gray-300 font-medium">Event PIN</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-6xl font-bold text-white tracking-widest font-mono mb-2">
            {event.pin}
          </div>
          <p className="text-gray-400 text-sm">
            Share this PIN with guests to request songs
          </p>
        </div>
      </div>

      {/* Request URL */}
      <div className="space-y-3">
        <label className="block text-gray-300 font-medium">Request Page URL</label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={requestUrl}
            readOnly
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
          />
          <button
            onClick={() => copyToClipboard(requestUrl, 'requestUrl')}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Copy URL"
          >
            {copied === 'requestUrl' ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <Copy className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        <p className="text-gray-500 text-xs">
          Guests will need to enter the PIN when they visit this URL
        </p>
      </div>

      {/* QR Code URL (with bypass token) */}
      <div className="space-y-3">
        <label className="block text-gray-300 font-medium flex items-center">
          <QrCode className="h-5 w-5 mr-2 text-purple-400" />
          QR Code URL (No PIN Required)
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={requestUrlWithBypass}
            readOnly
            className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm overflow-x-auto"
          />
          <button
            onClick={() => copyToClipboard(requestUrlWithBypass, 'qrUrl')}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            title="Copy URL"
          >
            {copied === 'qrUrl' ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <Copy className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        <p className="text-gray-500 text-xs">
          Use this URL to generate QR codes - guests won't need the PIN
        </p>
      </div>

      {/* Display Token */}
      <div className="space-y-3 border-t border-gray-700 pt-6">
        <label className="block text-gray-300 font-medium flex items-center">
          <Monitor className="h-5 w-5 mr-2 text-purple-400" />
          Display Screen URL
        </label>
        
        {!displayToken ? (
          <button
            onClick={generateDisplayToken}
            disabled={generatingToken}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {generatingToken ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Monitor className="h-5 w-5 mr-2" />
                Generate Display URL
              </>
            )}
          </button>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={displayUrl || ''}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm overflow-x-auto"
              />
              <button
                onClick={() => copyToClipboard(displayUrl || '', 'displayUrl')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Copy URL"
              >
                {copied === 'displayUrl' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            <a
              href={displayUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-center"
            >
              Open Display Screen →
            </a>
            <p className="text-gray-500 text-xs">
              Open this URL on your display screen (TV, projector, etc.)
            </p>
          </>
        )}
      </div>

      {/* Event Expiry */}
      <div className="text-center text-gray-500 text-xs border-t border-gray-700 pt-4">
        Event expires: {new Date(event.expires_at).toLocaleString()}
      </div>
    </div>
  );
}

