'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Music } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { eventSettings, loading, updateEventSettings } = useAdminData();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    event_title: '',
    welcome_message: '',
    secondary_message: '',
    tertiary_message: '',
    request_limit: 10,
    auto_approve: false,
    force_polling: false,
    requests_page_enabled: false,
    display_page_enabled: false,
  });
  
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Update form data when eventSettings loads
  useEffect(() => {
    if (eventSettings) {
      setFormData({
        event_title: eventSettings.event_title || '',
        welcome_message: eventSettings.welcome_message || '',
        secondary_message: eventSettings.secondary_message || '',
        tertiary_message: eventSettings.tertiary_message || '',
        request_limit: eventSettings.request_limit || 10,
        auto_approve: eventSettings.auto_approve || false,
        force_polling: eventSettings.force_polling || false,
        requests_page_enabled: eventSettings.requests_page_enabled ?? false,
        display_page_enabled: eventSettings.display_page_enabled ?? false,
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
      force_polling: formData.force_polling,
      auto_approve: formData.auto_approve,
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

          {/* Display Screen Messages Section */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">Display Screen Messages</h3>
            
            {/* Welcome Message */}
            <div className="mb-6">
              <label htmlFor="welcome_message" className="block text-sm font-medium text-gray-300 mb-2">
                Welcome Message
              </label>
              <textarea
                id="welcome_message"
                name="welcome_message"
                value={formData.welcome_message}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Welcome! This is a welcome message."
              />
              <p className="text-gray-500 text-sm mt-1">
                Primary message shown on the display screen, and to users when requesting songs
              </p>
            </div>

            {/* Scrolling Messages */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Scrolling Messages
              </label>
              
              {/* First Scrolling Message */}
              <div className="mb-4">
                <textarea
                  id="secondary_message"
                  name="secondary_message"
                  value={formData.secondary_message}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Request your song now! Scan the QR code, or visit partyplaylist.co.uk"
                />
              </div>
              
              {/* Second Scrolling Message */}
              <div className="mb-2">
                <textarea
                  id="tertiary_message"
                  name="tertiary_message"
                  value={formData.tertiary_message}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Secondary message to be placed here!"
                />
              </div>
              
              <p className="text-gray-500 text-sm mt-1">
                Additional information or instructions for users shown on the display screen
              </p>
            </div>
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

          {/* Real-time System Status */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-4">⚡ Real-time System (Pusher)</h4>
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-green-400 font-medium">Pusher WebSocket Active</p>
                  <p className="text-gray-400 text-sm">All updates are instant - no polling needed!</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Admin Page Polling */}
              <div>
                <label htmlFor="admin_polling_interval" className="block text-sm font-medium text-gray-300 mb-2">
                  Admin Page Refresh
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    id="admin_polling_interval"
                    name="admin_polling_interval"
                    value={formData.admin_polling_interval || 15}
                    onChange={handleInputChange}
                    min="5"
                    max="300"
                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-gray-400 text-sm">seconds</span>
                </div>
              </div>

              {/* Display Page Polling */}
              <div>
                <label htmlFor="display_polling_interval" className="block text-sm font-medium text-gray-300 mb-2">
                  Display Page Refresh
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    id="display_polling_interval"
                    name="display_polling_interval"
                    value={formData.display_polling_interval || 20}
                    onChange={handleInputChange}
                    min="5"
                    max="300"
                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-gray-400 text-sm">seconds</span>
                </div>
              </div>

              {/* Now Playing Polling */}
              <div>
                <label htmlFor="now_playing_polling_interval" className="block text-sm font-medium text-gray-300 mb-2">
                  Now Playing Status
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    id="now_playing_polling_interval"
                    name="now_playing_polling_interval"
                    value={formData.now_playing_polling_interval || 5}
                    onChange={handleInputChange}
                    min="1"
                    max="60"
                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-gray-400 text-sm">seconds</span>
                </div>
              </div>

              {/* SSE Update Interval */}
              <div>
                <label htmlFor="sse_update_interval" className="block text-sm font-medium text-gray-300 mb-2">
                  Real-time Updates
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    id="sse_update_interval"
                    name="sse_update_interval"
                    value={formData.sse_update_interval || 3}
                    onChange={handleInputChange}
                    min="1"
                    max="30"
                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-gray-400 text-sm">seconds</span>
                </div>
              </div>
            </div>
            
            <div className="mt-3 text-xs text-gray-500">
              <p>• <strong>Admin/Display Refresh:</strong> How often pages refresh when SSE is unavailable</p>
              <p>• <strong>Now Playing Status:</strong> How often the music progress bar updates</p>
              <p>• <strong>Real-time Updates:</strong> How often SSE sends updates (affects server load)</p>
            </div>
          </div>

          {/* Auto Approve */}
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
          <p className="text-gray-500 text-sm">
            When enabled, all song requests will be automatically approved and added to the queue
          </p>

          {/* Page Control Settings */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4">🎛️ Page Controls</h3>
            <p className="text-gray-400 text-sm mb-6">
              Manually control which pages are accessible to users. When disabled, users will see a "party starting soon" message.
            </p>
            
            <div className="space-y-4">
              {/* Requests Page Control */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Song Request Page</h4>
                  <p className="text-gray-400 text-sm">Allow users to submit song requests</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="requests_page_enabled"
                    name="requests_page_enabled"
                    checked={formData.requests_page_enabled}
                    onChange={handleCheckboxChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Display Page Control */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">Display Screen</h4>
                  <p className="text-gray-400 text-sm">Show the public display screen with current songs</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="display_page_enabled"
                    name="display_page_enabled"
                    checked={formData.display_page_enabled}
                    onChange={handleCheckboxChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Force Polling */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="force_polling"
              name="force_polling"
              checked={formData.force_polling}
              onChange={handleCheckboxChange}
              className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
            />
            <label htmlFor="force_polling" className="ml-3 text-sm font-medium text-gray-300">
              Force Polling Mode (Disable SSE)
            </label>
          </div>
          <p className="text-gray-500 text-sm">
            When enabled, uses polling instead of Server-Sent Events for real-time updates. Enable this if you're experiencing connection issues.
          </p>

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
              onClick={() => router.push('/admin/spotify-setup')}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Music className="w-4 h-4 mr-2" />
              Setup Spotify
            </button>
          </div>
        </div>
      </div>

      {/* Additional Settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Database Management</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Initialize Database</h4>
              <p className="text-gray-400 text-sm">Set up the database tables (only needed once)</p>
            </div>
            <button
              onClick={() => {
                fetch('/api/admin/init-db', { method: 'POST' })
                  .then(res => res.json())
                  .then(data => alert(data.message || 'Database initialized'))
                  .catch(err => alert('Error initializing database'));
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Initialize
            </button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
            <div>
              <h4 className="text-white font-medium">Reset Spotify Connection</h4>
              <p className="text-gray-400 text-sm">Clear Spotify tokens and force re-authentication</p>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset the Spotify connection?')) {
                  fetch('/api/admin/spotify/reset', { method: 'POST' })
                    .then(() => {
                      alert('Spotify connection reset. Please reconnect.');
                      window.location.reload();
                    })
                    .catch(err => alert('Error resetting Spotify connection'));
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
