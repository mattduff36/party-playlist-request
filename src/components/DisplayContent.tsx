import React from 'react';

interface Request {
  id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  requester_nickname: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  created_at: string;
  approved_at?: string;
}

interface NowPlaying {
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  progress_ms: number;
  is_playing: boolean;
}

interface DisplayContentProps {
  eventConfig?: {
    event_title?: string;
    welcome_message?: string;
    secondary_message?: string;
    tertiary_message?: string;
  };
  requests: Request[];
  nowPlaying: NowPlaying | null;
  lastUpdate: Date | null;
}

// Helper function to format duration
const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Helper function to format progress
const formatProgress = (progressMs: number, durationMs: number): string => {
  const progress = Math.floor((progressMs / durationMs) * 100);
  return `${progress}%`;
};

const DisplayContent: React.FC<DisplayContentProps> = ({
  eventConfig,
  requests,
  nowPlaying,
  lastUpdate,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-white mb-2 sm:mb-3 lg:mb-4">
            {eventConfig?.event_title || 'Party DJ Requests'}
          </h1>
          <p className="text-gray-300 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl">
            {eventConfig?.welcome_message || 'Request your favorite songs and let\'s keep the party going!'}
          </p>
        </div>

        {/* Now Playing Section */}
        {nowPlaying && (
          <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl mx-auto mb-6 sm:mb-8 lg:mb-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-6 lg:p-8">
              <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-3 sm:mb-4 lg:mb-6 text-center">Now Playing</h2>
              <div className="text-center">
                <h3 className="text-white text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl font-semibold mb-2 sm:mb-3 lg:mb-4">{nowPlaying.track_name}</h3>
                <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl mb-2 sm:mb-3 lg:mb-4">{nowPlaying.artist_name}</p>
                <p className="text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl mb-3 sm:mb-4 lg:mb-6">{nowPlaying.album_name}</p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-1 sm:h-2 lg:h-3 mb-2 sm:mb-3 lg:mb-4">
                  <div
                    className="bg-blue-500 h-1 sm:h-2 lg:h-3 rounded-full transition-all duration-1000"
                    style={{ width: formatProgress(nowPlaying.progress_ms, nowPlaying.duration_ms) }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-gray-400 mb-2 sm:mb-3 lg:mb-4">
                  <span>{formatDuration(nowPlaying.progress_ms)}</span>
                  <span>{formatDuration(nowPlaying.duration_ms)}</span>
                </div>
                
                <div className="mt-2 sm:mt-3 lg:mt-4">
                  <span className={`inline-block w-2 h-2 sm:w-3 sm:h-3 lg:w-4 lg:h-4 rounded-full ${nowPlaying.is_playing ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="ml-2 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-gray-300">
                    {nowPlaying.is_playing ? 'Playing' : 'Paused'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Requests Queue */}
        <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl mx-auto">
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-3 sm:mb-4 lg:mb-6">Request Queue</h2>
          
          {requests.length === 0 ? (
            <div className="text-center py-8 sm:py-12 lg:py-16">
              <div className="text-gray-400 text-4xl sm:text-6xl lg:text-8xl xl:text-9xl mb-3 sm:mb-4 lg:mb-6">🎵</div>
              <p className="text-gray-300 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl">No requests yet. Be the first to request a song!</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3 lg:space-y-4">
              {requests.map((request, index) => (
                <div
                  key={request.id}
                  className={`bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 lg:p-6 ${
                    request.status === 'approved' ? 'border-l-2 sm:border-l-4 border-green-500' :
                    request.status === 'rejected' ? 'border-l-2 sm:border-l-4 border-red-500' :
                    request.status === 'played' ? 'border-l-2 sm:border-l-4 border-blue-500' :
                    'border-l-2 sm:border-l-4 border-yellow-500'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 sm:space-x-4">
                        <span className="text-white font-bold text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl">#{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-white font-semibold text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl truncate">{request.track_name}</h3>
                          <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl truncate">{request.artist_name}</p>
                          <p className="text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg truncate">{request.album_name}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right sm:text-left sm:min-w-0">
                      <div className="text-white font-semibold text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl truncate">{request.requester_nickname}</div>
                      <div className="text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg">{formatDuration(request.duration_ms)}</div>
                      <div className={`text-xs sm:text-sm md:text-base lg:text-lg font-semibold ${
                        request.status === 'approved' ? 'text-green-400' :
                        request.status === 'rejected' ? 'text-red-400' :
                        request.status === 'played' ? 'text-blue-400' :
                        'text-yellow-400'
                      }`}>
                        {request.status === 'approved' ? '✅ Approved' :
                         request.status === 'rejected' ? '❌ Rejected' :
                         request.status === 'played' ? '🎵 Played' :
                         '⏳ Pending'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl mx-auto mt-8 sm:mt-12 lg:mt-16 text-center">
          <p className="text-gray-300 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl mb-3 sm:mb-4 lg:mb-6">
            {eventConfig?.secondary_message || 'Your requests will be reviewed by the DJ'}
          </p>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
            {eventConfig?.tertiary_message || 'Keep the party going!'}
          </p>
          
          {lastUpdate && (
            <p className="text-gray-500 text-xs sm:text-sm md:text-base lg:text-lg mt-3 sm:mt-4 lg:mt-6">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisplayContent;
