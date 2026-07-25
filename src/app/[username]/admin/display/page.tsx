'use client';

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import {
  Save,
  RefreshCw,
  Palette,
  Mic,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  Megaphone,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import {
  DISPLAY_MOOD_IDS,
  DISPLAY_MOODS,
  DisplayMood,
  resolveDisplayMood,
} from '@/styles/theme';
import Checkbox from '@/components/ui/Checkbox';
import Radio from '@/components/ui/Radio';

const SCROLLING_MESSAGE_PLACEHOLDER = 'Your requests will be reviewed by the DJ';
const SCROLLING_MESSAGE_SECOND_PLACEHOLDER = 'Keep the party going!';
const MAX_SCROLLING_MESSAGES = 2;

interface ScrollingMessageRowProps {
  id: string;
  name: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  showAdd: boolean;
  showDelete: boolean;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onAdd: () => void;
  onDelete: () => void;
}

function ScrollingMessageRow({
  id,
  name,
  value,
  placeholder,
  disabled,
  showAdd,
  showDelete,
  onChange,
  onAdd,
  onDelete,
}: ScrollingMessageRowProps) {
  return (
    <div className="flex gap-2 items-start">
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        rows={1}
        className="flex-1 min-w-0 px-4 py-3 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder}
      />
      {showAdd && (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          aria-label="Add scrolling message"
          className="shrink-0 p-3 rounded-lg border border-white/10 text-muted hover:text-bone hover:bg-surface/70 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
      {showDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Remove scrolling message"
          className="shrink-0 p-3 rounded-lg border border-white/10 text-muted hover:text-red-300 hover:bg-red-900/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

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
    
    // Guest + display visual mood
    display_mood: 'club' as DisplayMood,
    show_scrolling_bar: true,
    
    // Advanced features
    karaoke_mode: false, // Disabled for now
    
    // Notice Board features
    show_approval_messages: false,
  });

  // 1 field by default; 2 when tertiary has content or user clicks +
  const [scrollingFieldCount, setScrollingFieldCount] = useState(1);
  
  // Notice Board (Message System) state
  const [messageText, setMessageText] = useState('');
  const [messageDuration, setMessageDuration] = useState('30'); // Default 30 seconds
  const [customMinutes, setCustomMinutes] = useState('5');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageStatus, setMessageStatus] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [moodApplying, setMoodApplying] = useState(false);
  const [moodStatus, setMoodStatus] = useState('');
  const formHydratedRef = useRef(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    displayMessages: true,
    moodTheme: true,
    noticeBoard: false,
    advancedFeatures: false,
  });
  
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Hydrate once from server; later refreshes only sync mood (instant apply)
  // so unsaved message edits are not wiped.
  useEffect(() => {
    if (!eventSettings) return;

    const resolvedMood = resolveDisplayMood(
      eventSettings.display_mood,
      eventSettings.theme_primary_color
    );

    if (!formHydratedRef.current) {
      formHydratedRef.current = true;
      const secondary = eventSettings.secondary_message || '';
      const tertiary = eventSettings.tertiary_message || '';
      setFormData({
        welcome_message: eventSettings.welcome_message || '',
        secondary_message: secondary,
        tertiary_message: tertiary,
        show_qr_code: eventSettings.show_qr_code ?? true,
        qr_boost_duration: eventSettings.qr_boost_duration || 5,
        display_mood: resolvedMood,
        show_scrolling_bar: eventSettings.show_scrolling_bar ?? true,
        karaoke_mode: eventSettings.karaoke_mode || false,
        show_approval_messages: eventSettings.show_approval_messages || false,
      });
      setScrollingFieldCount(tertiary.trim() ? 2 : 1);
      return;
    }

    setFormData((prev) =>
      prev.display_mood === resolvedMood
        ? prev
        : { ...prev, display_mood: resolvedMood }
    );
  }, [eventSettings]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleMoodSelect = async (moodId: DisplayMood) => {
    if (formData.display_mood === moodId || moodApplying) return;

    const previousMood = formData.display_mood;
    setFormData((prev) => ({ ...prev, display_mood: moodId }));
    setMoodApplying(true);
    setMoodStatus('');

    try {
      await updateEventSettings({ display_mood: moodId });
      setMoodStatus('Mood applied');
      setTimeout(() => setMoodStatus(''), 2000);
    } catch (error) {
      console.error('❌ Error applying display mood:', error);
      setFormData((prev) => ({ ...prev, display_mood: previousMood }));
      setMoodStatus('Could not apply mood');
      setTimeout(() => setMoodStatus(''), 3000);
    } finally {
      setMoodApplying(false);
    }
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

  const handleSubmit = async (e: FormEvent) => {
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display Messages Section */}
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('displayMessages')}
              className="w-full flex items-center justify-between p-4 bg-surface/60 hover:bg-surface/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-bone flex items-center">
                <MessageSquareText className="w-5 h-5 mr-2 text-accent" />
                Display Messages
              </h3>
              {expandedSections.displayMessages ? (
                <ChevronUp className="w-5 h-5 text-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted" />
              )}
            </button>
            
            {expandedSections.displayMessages && (
              <div className={`p-4 space-y-6 transition-opacity ${!formData.show_scrolling_bar ? 'opacity-50' : ''}`}>
            
            {/* Scrolling Bar Toggle */}
            <div className="bg-surface/60 rounded-lg p-4 border-2 border-accent/30 mb-6">
              <div className="flex items-center">
                <Checkbox
                  id="show_scrolling_bar"
                  name="show_scrolling_bar"
                  checked={formData.show_scrolling_bar}
                  onChange={handleCheckboxChange}
                  size="md"
                />
                <label htmlFor="show_scrolling_bar" className="ml-3 text-base font-semibold text-bone">
                  Show Scrolling Message Bar
                </label>
              </div>
              <p className="text-muted text-sm mt-2 ml-8">
                Display the scrolling message bar at the bottom of the screen. When disabled, the display messages below will not be shown.
              </p>
            </div>
            
            {/* Welcome Message */}
            <div className="mb-6">
              <label htmlFor="welcome_message" className="block text-sm font-medium text-muted mb-2">
                Welcome Message
              </label>
              <textarea
                id="welcome_message"
                name="welcome_message"
                value={formData.welcome_message}
                onChange={handleInputChange}
                disabled={!formData.show_scrolling_bar}
                rows={1}
                className="w-full px-4 py-3 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Welcome! This is a welcome message."
              />
              <p className="text-faint text-sm mt-1">
                Primary message shown on the request page and display screen
              </p>
            </div>

            {/* Scrolling Messages */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Scrolling Messages
              </label>

              <div className="space-y-3">
                <ScrollingMessageRow
                  id="secondary_message"
                  name="secondary_message"
                  value={formData.secondary_message}
                  placeholder={SCROLLING_MESSAGE_PLACEHOLDER}
                  disabled={!formData.show_scrolling_bar}
                  onChange={handleInputChange}
                  showAdd={scrollingFieldCount < MAX_SCROLLING_MESSAGES}
                  showDelete={false}
                  onAdd={() => setScrollingFieldCount(2)}
                  onDelete={() => {}}
                />

                {scrollingFieldCount >= 2 && (
                  <ScrollingMessageRow
                    id="tertiary_message"
                    name="tertiary_message"
                    value={formData.tertiary_message}
                    placeholder={SCROLLING_MESSAGE_SECOND_PLACEHOLDER}
                    disabled={!formData.show_scrolling_bar}
                    onChange={handleInputChange}
                    showAdd={false}
                    showDelete
                    onAdd={() => {}}
                    onDelete={() => {
                      setFormData((prev) => ({ ...prev, tertiary_message: '' }));
                      setScrollingFieldCount(1);
                    }}
                  />
                )}
              </div>
              
              <p className="text-faint text-sm mt-1">
                Messages shown in the scrolling bar at the bottom of the display screen
              </p>
            </div>
              </div>
            )}
          </div>

          {/* Display Mood Section */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('moodTheme')}
              className="w-full flex items-center justify-between p-4 bg-surface/60 hover:bg-surface transition-colors"
            >
              <h3 className="text-lg font-semibold text-bone flex items-center font-display">
                <Palette className="w-5 h-5 mr-2 text-accent" />
                Display Mood
              </h3>
              {expandedSections.moodTheme ? (
                <ChevronUp className="w-5 h-5 text-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted" />
              )}
            </button>
            
            {expandedSections.moodTheme && (
              <div className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-muted">
                    Applies instantly to the guest request page and the TV display for this event.
                  </p>
                  {moodStatus && (
                    <p
                      className={`text-xs shrink-0 ${
                        moodStatus.includes('Could not') ? 'text-red-400' : 'text-accent'
                      }`}
                    >
                      {moodApplying ? 'Applying...' : moodStatus}
                    </p>
                  )}
                  {!moodStatus && moodApplying && (
                    <p className="text-xs shrink-0 text-muted">Applying...</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {DISPLAY_MOOD_IDS.map((moodId) => {
                    const mood = DISPLAY_MOODS[moodId];
                    const selected = formData.display_mood === moodId;
                    return (
                      <button
                        key={moodId}
                        type="button"
                        disabled={moodApplying}
                        onClick={() => handleMoodSelect(moodId)}
                        className={`text-left rounded-xl border p-4 transition-all disabled:opacity-70 ${
                          selected
                            ? 'border-accent ring-2 ring-accent/30 bg-accent/10'
                            : 'border-white/10 bg-elevated hover:border-white/20'
                        }`}
                      >
                        <div
                          className="h-16 rounded-lg mb-3 border"
                          style={{
                            background: `linear-gradient(135deg, ${mood.background}, ${mood.surface})`,
                            borderColor: mood.border,
                          }}
                        >
                          <div className="h-full flex items-end p-2">
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded"
                              style={{ background: mood.accent, color: '#0a0a0a' }}
                            >
                              {mood.label}
                            </span>
                          </div>
                        </div>
                        <p className="font-semibold text-bone">{mood.label}</p>
                        <p className="text-xs text-muted mt-1 leading-relaxed">{mood.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notice Board Section */}
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('noticeBoard')}
              className="w-full flex items-center justify-between p-4 bg-surface/60 hover:bg-surface/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-bone flex items-center">
                <Megaphone className="w-5 h-5 mr-2 text-accent" />
                Notice Board
              </h3>
              {expandedSections.noticeBoard ? (
                <ChevronUp className="w-5 h-5 text-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted" />
              )}
            </button>
            
            {expandedSections.noticeBoard && (
              <div className="p-4 space-y-6">
            <p className="text-muted text-sm mb-6">
              Send messages to display in the center of the display screen. Perfect for announcements, requests, or special messages.
            </p>
            
            <div className="space-y-4">
              {/* Auto-Approval Messages Setting */}
              <div className="bg-surface/60 rounded-lg p-4 border-2 border-accent/30 mb-4">
                <div className="flex items-center">
                  <Checkbox
                    id="show_approval_messages"
                    name="show_approval_messages"
                    checked={formData.show_approval_messages}
                    onChange={handleCheckboxChange}
                    size="md"
                  />
                  <label htmlFor="show_approval_messages" className="ml-3 text-base font-semibold text-bone">
                    Show Requests when Approved
                  </label>
                </div>
                <p className="text-muted text-sm mt-2 ml-8">
                  Automatically display a 10-second Notice Board message when a request is approved, showing the requester's name and song details.
                </p>
              </div>

              {/* Message Text Input */}
              <div>
                <label htmlFor="message_text" className="block text-sm font-medium text-muted mb-2">
                  Message Text
                </label>
                <textarea
                  id="message_text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                  placeholder="Enter your message here..."
                  maxLength={500}
                />
                <p className="text-faint text-xs mt-1">
                  {messageText.length}/500 characters
                </p>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Display Duration
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <Radio
                        name="duration"
                        value="10"
                        checked={messageDuration === '10'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                      />
                      <span className="ml-2 text-muted">10 seconds</span>
                    </label>
                    <label className="flex items-center">
                      <Radio
                        name="duration"
                        value="30"
                        checked={messageDuration === '30'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                      />
                      <span className="ml-2 text-muted">30 seconds</span>
                    </label>
                    <label className="flex items-center">
                      <Radio
                        name="duration"
                        value="60"
                        checked={messageDuration === '60'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                      />
                      <span className="ml-2 text-muted">1 minute</span>
                    </label>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <Radio
                        name="duration"
                        value="custom"
                        checked={messageDuration === 'custom'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                      />
                      <span className="ml-2 text-muted">Custom:</span>
                    </label>
                    {messageDuration === 'custom' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(e.target.value)}
                          className="w-16 px-2 py-1 bg-surface border border-white/10 rounded text-bone text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <span className="text-muted text-sm">minutes</span>
                      </div>
                    )}
                    <label className="flex items-center">
                      <Radio
                        name="duration"
                        value="indefinite"
                        checked={messageDuration === 'indefinite'}
                        onChange={(e) => setMessageDuration(e.target.value)}
                      />
                      <span className="ml-2 text-muted">Until removed</span>
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
                      ? 'bg-surface text-muted cursor-not-allowed'
                      : 'bg-accent hover:bg-accent text-bone'
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
                      ? 'bg-surface text-muted cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 text-bone'
                  }`}
                >
                  Clear Message
                </button>
              </div>

              {/* Status Message */}
              {messageStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  messageStatus.includes('successfully') || messageStatus.includes('cleared')
                    ? 'bg-accent/15 text-accent border border-accent/40'
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
          <div className="border border-white/10 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('advancedFeatures')}
              className="w-full flex items-center justify-between p-4 bg-surface/60 hover:bg-surface/70 transition-colors"
            >
              <h3 className="text-lg font-semibold text-bone flex items-center">
                <Mic className="w-5 h-5 mr-2" />
                Advanced Features
              </h3>
              {expandedSections.advancedFeatures ? (
                <ChevronUp className="w-5 h-5 text-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted" />
              )}
            </button>
            
            {expandedSections.advancedFeatures && (
              <div className="p-4 space-y-6">
            
            <div className="space-y-4">
              {/* Karaoke Mode checkbox - DISABLED */}
              <div className="opacity-50">
                <div className="flex items-center">
                  <Checkbox
                    id="karaoke_mode"
                    name="karaoke_mode"
                    checked={formData.karaoke_mode}
                    onChange={handleCheckboxChange}
                    disabled
                  />
                  <label htmlFor="karaoke_mode" className="ml-3 text-sm font-medium text-muted cursor-not-allowed">
                    Karaoke Mode
                  </label>
                  <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-yellow-900/50 text-yellow-300 rounded-full border border-yellow-700">
                    COMING SOON
                  </span>
                </div>
                <p className="text-faint text-sm mt-2 ml-7">
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

