import React from 'react';

interface PartyNotStartedProps {
  variant: 'display' | 'request';
}

const PartyNotStarted: React.FC<PartyNotStartedProps> = ({ variant }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center relative overflow-hidden">
      {/* Background Pattern - Subtle */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, #1DB954 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      <div className="relative z-10 text-center px-4 py-8 max-w-4xl mx-auto">
        {/* Music Note Icon with Spotify Green Glow */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 blur-3xl bg-[#1DB954] opacity-30 rounded-full"></div>
            <div className="relative text-8xl md:text-9xl text-[#1DB954] opacity-90">🎵</div>
          </div>
        </div>
        
        {/* Main Branding */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
          Party Playlist
        </h1>
        
        {/* Tagline */}
        <p className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-8">
          <span className="text-white">Let Your Guests</span>
          <br />
          <span className="text-[#1DB954]">Choose The Music</span>
        </p>
        
        {/* Status Message */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 md:p-8 mb-8 border border-[#1DB954]/20">
          <p className="text-xl md:text-2xl text-gray-300 mb-4">
            {variant === 'display' 
              ? "No Event Currently Active" 
              : "Party Not Started Yet"}
          </p>
          <p className="text-base md:text-lg text-gray-400">
            {variant === 'display'
              ? "This screen will show live music updates when an event is running"
              : "The DJ hasn't started the party yet. Check back soon!"}
          </p>
        </div>

        {/* Features - Compact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-[#1DB954]/10">
            <div className="text-3xl mb-2">🎧</div>
            <h3 className="text-sm font-semibold text-[#1DB954] mb-1">Spotify Integration</h3>
            <p className="text-xs text-gray-400">Real-time queue management</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-[#1DB954]/10">
            <div className="text-3xl mb-2">📱</div>
            <h3 className="text-sm font-semibold text-[#1DB954] mb-1">Guest Requests</h3>
            <p className="text-xs text-gray-400">Simple song submission</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-[#1DB954]/10">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-sm font-semibold text-[#1DB954] mb-1">Live Updates</h3>
            <p className="text-xs text-gray-400">Instant notifications</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="space-y-4">
          <p className="text-gray-400 text-sm md:text-base">
            Perfect for parties, weddings, bars, and events
          </p>
          <a 
            href="/"
            className="inline-block bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-black font-bold py-3 px-8 rounded-full text-base md:text-lg hover:shadow-lg hover:shadow-[#1DB954]/50 transition-all duration-300 transform hover:scale-105"
          >
            Learn More at PartyPlaylist.co.uk
          </a>
        </div>
      </div>
    </div>
  );
};

export default PartyNotStarted;
