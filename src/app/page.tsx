'use client';

import { useState, useEffect } from 'react';
// Using simple icons instead of heroicons for now
import axios from 'axios';

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

interface SearchResult {
  tracks: Track[];
  query: string;
  total: number;
}

interface RequestResponse {
  success: boolean;
  message: string;
  request?: {
    id: string;
    track: {
      name: string;
      artists: string[];
      album: string;
    };
  };
}

const API_BASE = '/api';

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');

  // Search for tracks
  const searchTracks = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get<SearchResult>(`${API_BASE}/search`, {
        params: { q: query.trim(), limit: 20 },
        timeout: 15000 // 15 second timeout for search
      });
      setSearchResults(response.data.tracks);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchTracks(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Submit request
  const submitRequest = async (track?: Track, url?: string) => {
    setIsSubmitting(true);
    setRequestStatus('idle');

    try {
      const requestData: any = {
        requester_nickname: nickname || undefined
      };

      if (track) {
        requestData.track_uri = track.uri;
      } else if (url) {
        requestData.track_url = url;
      }

      const response = await axios.post<RequestResponse>(`${API_BASE}/request`, requestData, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setRequestStatus('success');
        setStatusMessage(response.data.message);
        // setSelectedTrack(null);
        setSearchQuery('');
        setSearchResults([]);
        setSpotifyUrl('');
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setRequestStatus('idle');
        }, 5000);
      }
    } catch (error: any) {
      console.error('Request submission error:', error);
      setRequestStatus('error');
      
      // Handle different types of errors
      let errorMessage = 'Failed to submit request. Please try again.';
      
      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response received (timeout, network error)
        errorMessage = 'Request timeout or network error. Please check your connection and try again.';
      } else {
        // Something else happened
        errorMessage = error.message || 'An unexpected error occurred.';
      }
      
      setStatusMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 text-yellow-400 text-6xl">🎵</div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            🎉 Party DJ Requests
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Request your favorite songs and let&apos;s keep the party going!
          </p>
        </div>

        {/* Status Messages */}
        {requestStatus === 'success' && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-green-500 text-white p-4 rounded-lg flex items-center">
              <span className="text-2xl mr-2">✅</span>
              <span>{statusMessage}</span>
            </div>
          </div>
        )}

        {requestStatus === 'error' && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-red-500 text-white p-4 rounded-lg">
              {statusMessage}
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          {/* Nickname Input */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <label className="block text-white text-sm font-medium mb-2">
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your name..."
              className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>

          {/* Search Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">🔍 Search for Songs</h2>
            
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by song title, artist, or album..."
                className="w-full pl-10 pr-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
            </div>

            {isSearching && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto"></div>
                <p className="text-gray-300 mt-2">Searching...</p>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="bg-white/20 rounded-lg p-4 hover:bg-white/30 transition-colors cursor-pointer"
                    onClick={() => {/* setSelectedTrack(track) */}}
                  >
                    <div className="flex items-center space-x-4">
                      {track.image && (
                        <img
                          src={track.image}
                          alt={track.album}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">
                          {track.name}
                          {track.explicit && (
                            <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded">
                              EXPLICIT
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-300 text-sm truncate">
                          {track.artists.join(', ')} • {track.album}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {formatDuration(track.duration_ms)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          submitRequest(track);
                        }}
                        disabled={isSubmitting}
                        className="bg-yellow-400 hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spotify URL Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">🎵 Or Paste Spotify Link</h2>
            
            <div className="space-y-4">
              <input
                type="url"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                placeholder="https://open.spotify.com/track/..."
                className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
              />
              
              <button
                onClick={() => submitRequest(undefined, spotifyUrl)}
                disabled={isSubmitting || !spotifyUrl.trim()}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </div>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-8 text-center text-gray-300">
            <p className="mb-2">
              💡 <strong>Tip:</strong> Search for songs or paste Spotify links
            </p>
            <p className="text-sm">
              Your requests will be reviewed by the DJ before being added to the queue
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}