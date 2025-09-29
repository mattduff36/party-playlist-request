import React from 'react';

interface PartyNotStartedProps {
  variant: 'home' | 'display';
  eventConfig?: {
    event_title?: string;
    welcome_message?: string;
    secondary_message?: string;
    tertiary_message?: string;
  };
}

const PartyNotStarted: React.FC<PartyNotStartedProps> = ({ variant, eventConfig }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center relative p-4 sm:p-6 lg:p-8">
      <div className="text-center px-4 py-8 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl 2xl:max-w-6xl mx-auto">
        {/* Music Note Icon */}
        <div className="flex justify-center mb-6 sm:mb-8 lg:mb-12">
          <div className="text-6xl sm:text-8xl lg:text-9xl xl:text-[12rem] text-gray-400 opacity-60">🎵</div>
        </div>
        
        {/* Main Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold text-white mb-3 sm:mb-4 lg:mb-6 leading-tight">
          {eventConfig?.event_title || 'PartyPlaylist.co.uk'}
        </h1>
        
        {/* Subtitle */}
        <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-semibold text-yellow-400 mb-4 sm:mb-6 lg:mb-8">
          Be your own DJ!
        </h2>
        
        {/* Status Message */}
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl text-gray-300 mb-6 sm:mb-8 lg:mb-12">
          {eventConfig?.welcome_message || 'Requests are not active at the moment.'}
        </p>

        {/* Additional Info */}
        <div className="space-y-3 sm:space-y-4 lg:space-y-6 text-gray-400 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl mx-auto">
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
        className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-400 text-xs sm:text-sm lg:text-base opacity-20 hover:opacity-40 transition-all duration-300 border border-gray-600"
        title="Admin Access"
      >
        admin
      </a>
    </div>
  );
};

export default PartyNotStarted;
