'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { useAdminData } from '../../../hooks/useAdminData';

export default function SettingsPage() {
  const { eventSettings, updateEventSettings, loading } = useAdminData({ disablePolling: true });
  
  const [formData, setFormData] = useState({
    event_title: '',
    welcome_message: '',
    secondary_message: '',
    tertiary_message: '',
    request_limit: 10,
    auto_approve: false,
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

    try {
      await updateEventSettings(formData);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
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
                placeholder="Enter welcome message..."
              />
              <p className="text-gray-500 text-sm mt-1">
                Primary message shown to users when requesting songs
              </p>
            </div>

            {/* Secondary Message */}
            <div className="mb-6">
              <label htmlFor="secondary_message" className="block text-sm font-medium text-gray-300 mb-2">
                Secondary Message
              </label>
              <textarea
                id="secondary_message"
                name="secondary_message"
                value={formData.secondary_message}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Enter secondary message..."
              />
              <p className="text-gray-500 text-sm mt-1">
                Additional information or instructions for users
              </p>
            </div>

            {/* Tertiary Message */}
            <div>
              <label htmlFor="tertiary_message" className="block text-sm font-medium text-gray-300 mb-2">
                Scrolling Messages
              </label>
              <textarea
                id="tertiary_message"
                name="tertiary_message"
                value={formData.tertiary_message}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Enter display screen messages..."
              />
              <p className="text-gray-500 text-sm mt-1">
                Messages that scroll on the display screen (separate multiple messages with commas)
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
