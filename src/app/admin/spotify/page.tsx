'use client';

import { Music, Clock } from 'lucide-react';

export default function SpotifyPage() {
  return (
    <div className="space-y-6">
      {/* Coming Soon Message */}
      <div className="bg-gray-800 rounded-lg p-8">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Music className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Spotify Controls</h2>
          <div className="flex items-center justify-center space-x-2 text-purple-400 mb-6">
            <Clock className="w-5 h-5" />
            <span className="text-lg font-medium">Updates to this page coming soon!</span>
          </div>
          <p className="text-gray-400 text-lg max-w-md mx-auto mb-8">
            We're working on enhanced Spotify controls and queue management features. 
            For now, use the Overview page to manage your music.
          </p>
          <div className="bg-gray-700/50 rounded-lg p-4 max-w-sm mx-auto">
            <p className="text-gray-300 text-sm">
              💡 <strong>Tip:</strong> You can control playback and reorder songs from the Overview page
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}