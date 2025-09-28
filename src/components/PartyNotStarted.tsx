import React from 'react';

interface PartyNotStartedProps {
  variant: 'home' | 'display';
}

const PartyNotStarted: React.FC<PartyNotStartedProps> = ({ variant }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center relative p-4">
      <div className="text-center px-4 py-8 max-w-2xl mx-auto">
        {/* Music Note Icon */}
        <div className="flex justify-center mb-8">
          <div className="text-8xl text-gray-400 opacity-60">🎵</div>
        </div>
        
        {/* Main Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
          PartyPlaylist.co.uk
        </h1>
        
        {/* Subtitle */}
        <h2 className="text-2xl md:text-3xl font-semibold text-yellow-400 mb-6">
          Be your own DJ!
        </h2>
        
        {/* Status Message */}
        <p className="text-xl md:text-2xl text-gray-300 mb-8">
          Your party hasn't started yet, or has already ended!
        </p>

        {/* Additional Info */}
        <div className="space-y-4 text-gray-400 text-lg max-w-lg mx-auto">
          <p>
            This app allows you to host interactive music request parties. Guests can request songs from Spotify, and you, as the DJ, can manage the queue in real-time.
          </p>
          <p>
            To start a new party, an admin needs to log in to the admin panel.
          </p>
        </div>
      </div>
      
      {/* Very faint admin link for beta testing - bottom right corner */}
      <a 
        href="/admin" 
        className="absolute bottom-4 right-4 w-16 h-16 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-400 text-sm opacity-20 hover:opacity-40 transition-all duration-300 border border-gray-600"
        title="Admin Access"
      >
        admin
      </a>
    </div>
  );
};

export default PartyNotStarted;
