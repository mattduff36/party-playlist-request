'use client';

import { useState, useEffect } from 'react';
import { Music2, X } from 'lucide-react';

interface SpotifyConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SpotifyConnectionModal({ isOpen, onClose }: SpotifyConnectionModalProps) {
  const [connecting, setConnecting] = useState(false);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Get Spotify authorization URL
      const response = await fetch('/api/spotify/auth', {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to get Spotify auth URL:', errorData.error);
        setConnecting(false);
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
      setConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <Music2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Connect Spotify</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={connecting}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-300 text-base mb-6">
            To enable music playback and manage your queue, you need to connect your Spotify account.
          </p>
          <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600 mb-6">
            <p className="text-sm text-gray-400">
              You'll be redirected to Spotify to authorize this application. After authorization, you'll be able to:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Control playback (play, pause, skip)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Add approved requests to your Spotify queue</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>View what's currently playing</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-700/30 rounded-b-lg flex gap-3">
          <button
            onClick={onClose}
            disabled={connecting}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {connecting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Music2 className="w-4 h-4" />
                Connect Spotify
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


