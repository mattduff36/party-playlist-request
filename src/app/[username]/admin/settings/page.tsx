'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Copy, CheckCircle, Monitor, QrCode, Lock, Loader2 } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { useRouter, usePathname } from 'next/navigation';
import { useGlobalEvent } from '@/lib/state/global-event-client';

export default function SettingsPage() {
  const { eventSettings, loading, updateEventSettings } = useAdminData();
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useGlobalEvent();
  const username = pathname?.split('/')[1] || '';
  
  const [formData, setFormData] = useState({
    event_title: '',
    request_limit: 10,
    auto_approve: false,
    decline_explicit: false,
  });
  
  const [event, setEvent] = useState<any>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch event when component mounts OR when event status changes to Live/Standby
  useEffect(() => {
    const fetchEvent = async () => {
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
  }, [state?.status]);

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

  // Handle Spotify connection
  const handleSpotifyConnect = async () => {
    try {
      // Get Spotify authorization URL
      const response = await fetch('/api/spotify/auth', {
        credentials: 'include' // JWT auth via cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to get Spotify auth URL:', errorData.error);
        return;
      }

      const data = await response.json();
      
      // Store OAuth data in localStorage for callback
      localStorage.setItem('spotify_state', data.state);
      localStorage.setItem('spotify_code_verifier', data.code_verifier);
      
      // Redirect to Spotify authorization
      window.location.href = data.auth_url;
    } catch (err) {
      console.error('Error connecting to Spotify:', err);
    }
  };

  // Update form data when eventSettings loads
  useEffect(() => {
    if (eventSettings) {
      setFormData({
        event_title: eventSettings.event_title || '',
        request_limit: (eventSettings as any).request_limit || 10,
        auto_approve: (eventSettings as any).auto_approve || false,
        decline_explicit: (eventSettings as any).decline_explicit || false,
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
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-6">Event Settings</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Title */}
          <div>
            <label htmlFor="event_title" className="block text-sm font-medium text-gray-300 mb-2">
              Event Title
            </label>
            <input
              type="text"
              id="event_title"
              name="event_title"
              value={formData.event_title}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter event title..."
            />
            <p className="text-gray-500 text-sm mt-1">
              This will be displayed on the main request page
            </p>
          </div>

          {/* Request Limit */}
          <div>
            <label htmlFor="request_limit" className="block text-sm font-medium text-gray-300 mb-2">
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
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-gray-500 text-sm mt-1">
              Maximum number of songs each user can request
            </p>
          </div>


          {/* Request Management Section */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">🎵 Request Management</h3>
            
            <div className="space-y-4">
              {/* Auto-approve checkbox */}
              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="auto_approve"
                    name="auto_approve"
                    checked={formData.auto_approve}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <label htmlFor="auto_approve" className="ml-3 text-sm font-medium text-gray-300">
                    Auto-approve all requests
                  </label>
                </div>
                <p className="text-gray-500 text-sm mt-2 ml-7">
                  When enabled, all song requests will be automatically approved and added to the queue
                </p>
              </div>

              {/* Decline explicit checkbox */}
              <div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="decline_explicit"
                    name="decline_explicit"
                    checked={formData.decline_explicit}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                  />
                  <label htmlFor="decline_explicit" className="ml-3 text-sm font-medium text-gray-300">
                    Auto-decline explicit songs
                  </label>
                </div>
                <p className="text-gray-500 text-sm mt-2 ml-7">
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
                  saveMessage.includes('Error') ? 'text-red-400' : 'text-green-400'
                }`}>
                  {saveMessage}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white font-medium rounded-lg transition-colors"
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
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">ℹ️ Event Information</h3>
        
        {loadingEvent ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500 mr-3" />
            <span className="text-gray-400">Loading event info...</span>
          </div>
        ) : !event || state?.status === 'offline' ? (
          <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600">
            <p className="text-gray-400 text-center">
              {state?.status === 'offline' 
                ? 'No active event - Set event to Live or Standby to view information'
                : 'No active event'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event PIN */}
            <div className="flex items-center justify-between p-4 bg-purple-900/20 border border-purple-600/50 rounded-lg">
              <div>
                <h4 className="text-white font-medium mb-1">Event PIN</h4>
                <p className="text-gray-400 text-sm">Guests need this PIN to access the request page</p>
              </div>
              <div className="flex items-center space-x-2">
                <Lock className="h-5 w-5 text-purple-400" />
                <span className="text-3xl font-bold text-white tracking-wider font-mono">{event.pin}</span>
              </div>
            </div>

            {/* Request URL */}
            <div className="space-y-3">
              <label className="block text-gray-300 font-medium">Request Page URL</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={`${window.location.origin}/${username}/request`}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                />
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/${username}/request`, 'requestUrl')}
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
                  value={`${window.location.origin}/${username}/request?bt=${event.bypass_token}`}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm overflow-x-auto"
                />
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/${username}/request?bt=${event.bypass_token}`, 'qrUrl')}
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

            {/* Display Screen URL */}
            <div className="space-y-3 border-t border-gray-700 pt-6">
              <label className="block text-gray-300 font-medium flex items-center">
                <Monitor className="h-5 w-5 mr-2 text-purple-400" />
                Display Screen URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={`${window.location.origin}/${username}/display/${event.pin}`}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm overflow-x-auto"
                />
                <button
                  onClick={() => copyToClipboard(`${window.location.origin}/${username}/display/${event.pin}`, 'displayUrl')}
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
              <p className="text-gray-500 text-xs">
                Open this URL on your display screen (TV, projector, etc.) - Uses event PIN for access
              </p>
            </div>

            {/* Event Expiry */}
            <div className="text-center text-gray-500 text-xs border-t border-gray-700 pt-4">
              Event expires: {new Date(event.expires_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Spotify Setup */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🎵 Spotify Integration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Spotify Connection</h4>
              <p className="text-gray-400 text-sm">Connect your Spotify account to control music playback</p>
            </div>
            <button
              onClick={handleSpotifyConnect}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              Connect Spotify
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
