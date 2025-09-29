import React, { useState } from 'react';

interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  explicit: boolean;
  preview_url?: string;
  image?: string;
}

interface RequestFormProps {
  eventConfig?: {
    event_title?: string;
    welcome_message?: string;
    secondary_message?: string;
    tertiary_message?: string;
  };
  onSearch: (query: string) => Promise<void>;
  onSubmitRequest: (track: Track) => Promise<void>;
  searchResults: Track[];
  isSearching: boolean;
  isSubmitting: boolean;
  requestStatus: 'idle' | 'success' | 'error';
  statusMessage: string;
  nickname: string;
  onNicknameChange: (nickname: string) => void;
  notifications: Array<{
    id: string;
    type: 'approved' | 'play_next';
    trackName: string;
    artistName: string;
    timestamp: number;
  }>;
  onDismissNotifications: () => void;
}

// Helper function to format duration
const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const RequestForm: React.FC<RequestFormProps> = ({
  eventConfig,
  onSearch,
  onSubmitRequest,
  searchResults,
  isSearching,
  isSubmitting,
  requestStatus,
  statusMessage,
  nickname,
  onNicknameChange,
  notifications,
  onDismissNotifications,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

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

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="fixed top-2 right-2 sm:top-4 sm:right-4 lg:top-6 lg:right-6 z-50 space-y-2 max-w-xs sm:max-w-sm">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-green-500 text-white px-3 py-2 sm:px-6 sm:py-3 rounded-lg shadow-lg animate-pulse text-xs sm:text-sm lg:text-base"
                onClick={onDismissNotifications}
              >
                <div className="font-bold">
                  {notification.type === 'play_next' ? '🎵 Playing Next!' : '✅ Request Approved!'}
                </div>
                <div className="text-xs sm:text-sm">
                  {notification.trackName} by {notification.artistName}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Section */}
        <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl 2xl:max-w-6xl mx-auto mb-6 sm:mb-8 lg:mb-12">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search for songs, artists, or albums..."
              className="w-full px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-6 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl rounded-full border-0 focus:ring-2 sm:focus:ring-4 focus:ring-blue-500 focus:outline-none"
              disabled={isSearching}
            />
            {isSearching && (
              <div className="absolute right-3 sm:right-4 lg:right-6 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 sm:h-6 sm:w-6 lg:h-8 lg:w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Nickname Input */}
        <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto mb-6 sm:mb-8 lg:mb-12">
          <input
            type="text"
            value={nickname}
            onChange={(e) => onNicknameChange(e.target.value)}
            placeholder="Enter your nickname"
            className="w-full px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 text-sm sm:text-base md:text-lg lg:text-xl rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            maxLength={50}
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl mx-auto">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-3 sm:mb-4 lg:mb-6">Search Results</h2>
            <div className="space-y-2 sm:space-y-3 lg:space-y-4">
              {searchResults.map((track) => (
                <div
                  key={track.id}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4 lg:p-6 hover:bg-white/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl truncate">{track.name}</h3>
                      <p className="text-gray-300 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl truncate">{track.artists.join(', ')}</p>
                      <p className="text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg truncate">{track.album}</p>
                      <p className="text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg">{formatDuration(track.duration_ms)}</p>
                    </div>
                    <button
                      onClick={() => onSubmitRequest(track)}
                      disabled={isSubmitting || !nickname.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-3 sm:py-2 sm:px-4 lg:py-3 lg:px-6 rounded-lg transition-colors text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl whitespace-nowrap"
                    >
                      {isSubmitting ? 'Submitting...' : 'Request'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto mt-4 sm:mt-6 lg:mt-8">
            <div
              className={`p-3 sm:p-4 lg:p-6 rounded-lg text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl ${
                requestStatus === 'success'
                  ? 'bg-green-500 text-white'
                  : requestStatus === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-500 text-white'
              }`}
            >
              {statusMessage}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl 2xl:max-w-6xl mx-auto mt-8 sm:mt-12 lg:mt-16 text-center">
          <p className="text-gray-300 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl mb-3 sm:mb-4 lg:mb-6">
            {eventConfig?.secondary_message || 'Your requests will be reviewed by the DJ'}
          </p>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl">
            {eventConfig?.tertiary_message || 'Keep the party going!'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RequestForm;
