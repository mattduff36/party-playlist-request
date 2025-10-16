'use client';

import React from 'react';
import { Wand2, X } from 'lucide-react';

interface SetupPartyModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function SetupPartyModal({ isOpen, onConfirm, onClose }: SetupPartyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#1DB954] to-[#1ed760] rounded-full flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-black" />
              </div>
              <h2 className="text-2xl font-bold text-white">Welcome! 🎉</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-lg text-gray-300 mb-6">
            Would you like to set up your party now?
          </p>
          <p className="text-sm text-gray-400 mb-8">
            You can configure your event settings, connect Spotify, and get your party started.
          </p>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onConfirm}
              className="flex-1 bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-black font-bold py-3 px-6 rounded-lg hover:shadow-lg hover:shadow-[#1DB954]/50 transition-all duration-300 transform hover:scale-105"
            >
              Yes, Let's Go!
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

