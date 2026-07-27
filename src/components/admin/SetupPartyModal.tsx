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
      <div className="bg-ink border border-white/10 rounded-2xl max-w-md w-full shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent-hover rounded-full flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-ink" />
              </div>
              <h2 className="text-2xl font-bold text-bone">Welcome!</h2>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-bone transition-colors p-2 hover:bg-elevated rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-lg text-muted mb-6">
            Would you like to set up your party now?
          </p>
          <p className="text-sm text-muted mb-8">
            You can configure your event settings, connect Spotify, and get your party started.
          </p>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onConfirm}
              className="flex-1 bg-gradient-to-r from-accent to-accent-hover text-ink font-bold py-3 px-6 rounded-lg hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 transform hover:scale-105"
            >
              Yes, Let&apos;s Go!
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-elevated text-bone font-semibold py-3 px-6 rounded-lg hover:bg-surface transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

