'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Palette, Eye, Mic, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';

export default function DisplaySettingsPage() {
  const { eventSettings, loading, updateEventSettings } = useAdminData();
  
  const [formData, setFormData] = useState({
    // Display messages
    welcome_message: '',
    secondary_message: '',
    tertiary_message: '',
    
    // QR Code settings
    show_qr_code: true,
    qr_boost_duration: 5, // seconds
    
    // UI Customization
    theme_primary_color: '#9333ea', // purple-600
    theme_secondary_color: '#3b82f6', // blue-500
    theme_tertiary_color: '#4f46e5', // indigo-600
    show_scrolling_bar: true,
    
    // Advanced features
    karaoke_mode: false, // Disabled for now
  });
  
  // Notice Board (Message System) state
  const [messageText, setMessageText] = useState('');
  const [messageDuration, setMessageDuration] = useState('30'); // Default 30 seconds
  const [customMinutes, setCustomMinutes] = useState('5');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageStatus, setMessageStatus] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    displayMessages: true,
    colorTheme: false,
    noticeBoard: false,
    advancedFeatures: false,
  });
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Update form data when eventSettings loads
  useEffect(() => {
    if (eventSettings) {
      setFormData({
        welcome_message: eventSettings.welcome_message || '',
        secondary_message: (eventSettings as any).secondary_message || '',
        tertiary_message: (eventSettings as any).tertiary_message || '',
        show_qr_code: (eventSettings as any).show_qr_code ?? true,
        qr_boost_duration: (eventSettings as any).qr_boost_duration || 5,
        theme_primary_color: (eventSettings as any).theme_primary_color || '#9333ea',
        theme_secondary_color: (eventSettings as any).theme_secondary_color || '#3b82f6',
        theme_tertiary_color: (eventSettings as any).theme_tertiary_color || '#4f46e5',
        show_scrolling_bar: (eventSettings as any).show_scrolling_bar ?? true,
        karaoke_mode: (eventSettings as any).karaoke_mode || false,
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

  // Notice Board message functions
  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      setMessageStatus('Please enter a message');
      setTimeout(() => setMessageStatus(''), 3000);
      return;
    }

    setSendingMessage(true);
    setMessageStatus('');

    try {
      // Calculate duration in seconds
      let durationInSeconds = null;
      if (messageDuration === 'indefinite') {
        durationInSeconds = null; // Indefinite
      } else if (messageDuration === 'custom') {
        durationInSeconds = parseInt(customMinutes) * 60;
      } else {
        durationInSeconds = parseInt(messageDuration);
      }

      const response = await fetch('/api/admin/message', {
        method: 'POST',
        credentials: 'include', // JWT auth via cookies
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_text: messageText.trim(),
          message_duration: durationInSeconds
        })
      });

      if (response.ok) {
        setMessageStatus('Message sent successfully!');
        setMessageText(''); // Clear the input
        setTimeout(() => setMessageStatus(''), 3000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setMessageStatus('Failed to send message. Please try again.');
      setTimeout(() => setMessageStatus(''), 3000);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleClearMessage = async () => {
    setSendingMessage(true);
    setMessageStatus('');

    try {
      const response = await fetch('/api/admin/message', {
        method: 'DELETE',
        credentials: 'include' // JWT auth via cookies
      });

      if (response.ok) {
        setMessageStatus('Message cleared successfully!');
        setTimeout(() => setMessageStatus(''), 3000);
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error('❌ Error clearing message:', error);
      setMessageStatus('Failed to clear message. Please try again.');
      setTimeout(() => setMessageStatus(''), 3000);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');

    console.log('🎨 Display settings form submission:', formData);
    console.log('🎨 Form data keys:', Object.keys(formData));
    console.log('🎨 Form data values:', Object.values(formData));

    try {
      console.log('📤 Calling updateEventSettings...');
      await updateEventSettings(formData);
      console.log('✅ updateEventSettings completed');
      setSaveMessage('Display settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('❌ Display settings save error:', error);
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Messages Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('displayMessages')}
              className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white flex items-center">
                💬 Display Messages
              </h3>
              {expandedSections.displayMessages ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.displayMessages && (
              <div className={`p-4 space-y-6 transition-opacity ${!formData.show_scrolling_bar ? 'opacity-50' : ''}`}>
            
            {/* Scrolling Bar Toggle */}
            <div className="bg-gray-700/50 rounded-lg p-4 border-2 border-purple-500/30 mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="show_scrolling_bar"
                  name="show_scrolling_bar"
                  checked={formData.show_scrolling_bar}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                />
                <label htmlFor="show_scrolling_bar" className="ml-3 text-base font-semibold text-white">
                  Show Scrolling Message Bar
                </label>
              </div>
              <p className="text-gray-400 text-sm mt-2 ml-8">
                Display the scrolling message bar at the bottom of the screen. When disabled, the display messages below will not be shown.
              </p>
            </div>
            
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
                disabled={!formData.show_scrolling_bar}
                rows={1}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Welcome! This is a welcome message."
              />
              <p className="text-gray-500 text-sm mt-1">
                Primary message shown on the request page and display screen
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
                  disabled={!formData.show_scrolling_bar}
                  rows={1}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:cursor-not-allowed disabled:opacity-50"
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
                  disabled={!formData.show_scrolling_bar}
                  rows={1}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Secondary message to be placed here!"
                />
              </div>
              
              <p className="text-gray-500 text-sm mt-1">
                Messages shown in the scrolling bar at the bottom of the display screen
              </p>
            </div>
              </div>
            )}
          </div>

          {/* Theme Colors Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('colorTheme')}
              className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Palette className="w-5 h-5 mr-2" />
                Colour Theme
              </h3>
              {expandedSections.colorTheme ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.colorTheme && (
              <div className="p-4 space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Primary Colour */}
              <div>
                <label htmlFor="theme_primary_color" className="block text-sm font-medium text-gray-300 mb-2">
                  Primary Colour
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    id="theme_primary_color"
                    name="theme_primary_color"
                    value={formData.theme_primary_color}
                    onChange={handleInputChange}
                    className="w-12 h-12 rounded cursor-pointer bg-gray-700 border-2 border-gray-600"
                  />
                  <input
                    type="text"
                    value={formData.theme_primary_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, theme_primary_color: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="#9333ea"
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Main gradient color
                </p>
              </div>

              {/* Secondary Colour */}
              <div>
                <label htmlFor="theme_secondary_color" className="block text-sm font-medium text-gray-300 mb-2">
                  Secondary Colour
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    id="theme_secondary_color"
                    name="theme_secondary_color"
                    value={formData.theme_secondary_color}
                    onChange={handleInputChange}
                    className="w-12 h-12 rounded cursor-pointer bg-gray-700 border-2 border-gray-600"
                  />
                  <input
                    type="text"
                    value={formData.theme_secondary_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, theme_secondary_color: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="#3b82f6"
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Middle gradient color
                </p>
              </div>

              {/* Tertiary Colour */}
              <div>
                <label htmlFor="theme_tertiary_color" className="block text-sm font-medium text-gray-300 mb-2">
                  Tertiary Colour
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    id="theme_tertiary_color"
                    name="theme_tertiary_color"
                    value={formData.theme_tertiary_color}
                    onChange={handleInputChange}
                    className="w-12 h-12 rounded cursor-pointer bg-gray-700 border-2 border-gray-600"
                  />
                  <input
                    type="text"
                    value={formData.theme_tertiary_color}
                    onChange={(e) => setFormData(prev => ({ ...prev, theme_tertiary_color: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="#4f46e5"
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  End gradient color
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-300 mb-2">Colour Preview</p>
              <div 
                className="h-24 rounded-lg"
                style={{
                  background: `linear-gradient(to bottom right, ${formData.theme_primary_color}, ${formData.theme_secondary_color}, ${formData.theme_tertiary_color})`
                }}
              />
            </div>
              </div>
            )}
          </div>

          {/* Notice Board Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('noticeBoard')}
              className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white flex items-center">
                📢 Notice Board
              </h3>
              {expandedSections.noticeBoard ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.noticeBoard && (
              <div className="p-4 space-y-6">
            <p className="text-gray-400 text-sm mb-6">
              Send messages to display in the center of the display screen. Perfect for announcements, requests, or special messages.
            </p>
            
            <div className="space-y-4">
              {/* Message Text Input */}
              <div>
                <label htmlFor="message_text" className="block text-sm font-medium text-gray-300 mb-2">
                  Message Text
                </label>
                <textarea
                  id="message_text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Enter your message here..."
                  maxLength={500}
                />
                <p className="text-gray-500 text-xs mt-1">
                  {messageText.length}/500 characters
                </p>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Duration
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="duration"
                        value="10"
                        checked={messageDuration === '10'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="ml-2 text-gray-300">10 seconds</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="duration"
                        value="30"
                        checked={messageDuration === '30'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="ml-2 text-gray-300">30 seconds</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="duration"
                        value="60"
                        checked={messageDuration === '60'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="ml-2 text-gray-300">1 minute</span>
                    </label>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="duration"
                        value="custom"
                        checked={messageDuration === 'custom'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="ml-2 text-gray-300">Custom:</span>
                    </label>
                    {messageDuration === 'custom' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(e.target.value)}
                          className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-gray-300 text-sm">minutes</span>
                      </div>
                    )}
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="duration"
                        value="indefinite"
                        checked={messageDuration === 'indefinite'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 focus:ring-purple-500 focus:ring-2"
                      />
                      <span className="ml-2 text-gray-300">Until removed</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageText.trim()}
                  className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                    sendingMessage || !messageText.trim()
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {sendingMessage ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleClearMessage}
                  disabled={sendingMessage}
                  className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                    sendingMessage
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  Clear Message
                </button>
              </div>

              {/* Status Message */}
              {messageStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  messageStatus.includes('successfully') || messageStatus.includes('cleared')
                    ? 'bg-green-900/50 text-green-300 border border-green-700'
                    : 'bg-red-900/50 text-red-300 border border-red-700'
                }`}>
                  {messageStatus}
                </div>
              )}
            </div>
              </div>
            )}
          </div>

          {/* Advanced Features Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('advancedFeatures')}
              className="w-full flex items-center justify-between p-4 bg-gray-700/50 hover:bg-gray-700/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Mic className="w-5 h-5 mr-2" />
                Advanced Features
              </h3>
              {expandedSections.advancedFeatures ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {expandedSections.advancedFeatures && (
              <div className="p-4 space-y-6">
            
            <div className="space-y-4">
              {/* Karaoke Mode checkbox - DISABLED */}
              <div className="opacity-50">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="karaoke_mode"
                    name="karaoke_mode"
                    checked={formData.karaoke_mode}
                    onChange={handleCheckboxChange}
                    disabled={true}
                    className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2 cursor-not-allowed"
                  />
                  <label htmlFor="karaoke_mode" className="ml-3 text-sm font-medium text-gray-300 cursor-not-allowed">
                    Karaoke Mode
                  </label>
                  <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-900/50 text-yellow-300 rounded-full border border-yellow-700">
                    COMING SOON
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-2 ml-7">
                  Enable karaoke-style lyrics display on the screen (feature in development)
                </p>
              </div>
            </div>
              </div>
            )}
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
                  Save Display Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

