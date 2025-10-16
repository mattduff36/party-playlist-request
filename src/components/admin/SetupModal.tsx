/**
 * Setup Modal Component
 * 
 * Step-by-step party setup wizard for first-time configuration
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Check, ArrowRight, Music2, AlertCircle } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

interface SetupFormData {
  eventTitle: string;
  welcomeMessage: string;
  autoDeclineExplicit: boolean;
  autoApprove: boolean;
  maxRequestsPerUser: number;
}

export default function SetupModal({ isOpen, onClose, username }: SetupModalProps) {
  const { stats, updateEventSettings } = useAdminData();
  const [step, setStep] = useState(1);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<SetupFormData>({
    eventTitle: 'Party Playlist!',
    welcomeMessage: 'Welcome to the Party!',
    autoDeclineExplicit: true,
    autoApprove: false,
    maxRequestsPerUser: 10
  });

  // Check Spotify connection status
  useEffect(() => {
    if (isOpen) {
      checkSpotifyConnection();
    }
  }, [isOpen]);

  const checkSpotifyConnection = async () => {
    try {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include'
      });
      const data = await response.json();
      setIsSpotifyConnected(data.connected || false);
    } catch (error) {
      console.error('Failed to check Spotify connection:', error);
      setIsSpotifyConnected(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Save event settings using AdminDataContext
      await updateEventSettings({
        event_title: formData.eventTitle,
        welcome_message: formData.welcomeMessage,
        decline_explicit: formData.autoDeclineExplicit,
        auto_approve: formData.autoApprove,
        request_limit: formData.maxRequestsPerUser === 0 ? null : formData.maxRequestsPerUser
      });

      // Check Spotify connection status again
      await checkSpotifyConnection();
      
      // Move to final step
      setStep(2);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectSpotify = () => {
    // Redirect to Spotify auth
    window.location.href = '/api/spotify/auth';
  };

  const handleComplete = () => {
    onClose();
    // Reset to step 1 for next time
    setTimeout(() => setStep(1), 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
          <div className="flex items-center space-x-3">
            <Music2 className="w-8 h-8 text-[#1DB954]" />
            <div>
              <h2 className="text-2xl font-bold text-white">Party Setup</h2>
              <p className="text-gray-400 text-sm">Configure your event settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            // Step 1: Configuration
            <div className="space-y-6">
              {/* Event Title */}
              <div>
                <label className="block text-white font-medium mb-2">
                  What is the name of the Party?
                </label>
                <input
                  type="text"
                  value={formData.eventTitle}
                  onChange={(e) => setFormData({ ...formData, eventTitle: e.target.value })}
                  placeholder="Party Playlist!"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-transparent"
                />
              </div>

              {/* Welcome Message */}
              <div>
                <label className="block text-white font-medium mb-2">
                  What is the Welcome message?
                </label>
                <input
                  type="text"
                  value={formData.welcomeMessage}
                  onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                  placeholder="Welcome to the Party!"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-transparent"
                />
              </div>

              {/* Auto-decline explicit */}
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <div className="text-white font-medium">Auto-decline explicit songs?</div>
                  <div className="text-gray-400 text-sm">Automatically reject songs marked as explicit</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoDeclineExplicit}
                    onChange={(e) => setFormData({ ...formData, autoDeclineExplicit: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1DB954]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1DB954]"></div>
                </label>
              </div>

              {/* Auto-approve */}
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div>
                  <div className="text-white font-medium">Auto-approve all requests?</div>
                  <div className="text-gray-400 text-sm">Approve all song requests automatically</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoApprove}
                    onChange={(e) => setFormData({ ...formData, autoApprove: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1DB954]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1DB954]"></div>
                </label>
              </div>

              {/* Max requests per user */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Maximum number of requests per user?
                  <span className="text-gray-400 text-sm ml-2">(Type 0 for unlimited)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxRequestsPerUser}
                  onChange={(e) => setFormData({ ...formData, maxRequestsPerUser: parseInt(e.target.value) || 0 })}
                  placeholder="10"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:border-transparent"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-900/20 border border-red-600 rounded-lg flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-red-300">{error}</span>
                </div>
              )}

              {/* Apply Button */}
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Apply Settings</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          ) : (
            // Step 2: Spotify Connection Status
            <div className="space-y-6">
              {isSpotifyConnected ? (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">You're all set!</h3>
                  <p className="text-gray-400 mb-6">
                    Your Spotify account is connected and settings are configured.
                  </p>
                  <button
                    onClick={handleComplete}
                    className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-3 px-8 rounded-lg transition-all duration-300 inline-flex items-center space-x-2"
                  >
                    <Check className="w-5 h-5" />
                    <span>Complete Setup</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Music2 className="w-10 h-10 text-yellow-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">One more step!</h3>
                  <p className="text-gray-400 mb-6">
                    Connect your Spotify account to start playing music.
                  </p>
                  <button
                    onClick={handleConnectSpotify}
                    className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold py-3 px-8 rounded-lg transition-all duration-300 inline-flex items-center space-x-2"
                  >
                    <Music2 className="w-5 h-5" />
                    <span>Connect Spotify Account</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

