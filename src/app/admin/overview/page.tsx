'use client';

import { Play, Pause, SkipForward, Volume2, Music, Users, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { useCallback, useState, useEffect, useRef } from 'react';
import { useAdminData } from '@/contexts/AdminDataContext';

export default function OverviewPage() {
  const {
    playbackState,
    stats,
    eventSettings,
    handlePlaybackControl,
    handleQueueReorder,
    loading
  } = useAdminData();

  // Debug logging removed to prevent console spam

  // Simple live progress without render loops
  const [liveProgress, setLiveProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (playbackState?.is_playing && playbackState.spotify_connected) {
      // Set initial progress
      setLiveProgress(playbackState.progress_ms || 0);
      
      // Update progress every second
      intervalRef.current = setInterval(() => {
        setLiveProgress(prev => {
          const newProgress = prev + 1000; // Add 1 second
          const maxProgress = playbackState.duration_ms || 0;
          return newProgress >= maxProgress ? maxProgress : newProgress;
        });
      }, 1000);
    } else {
      // Not playing, use static progress
      setLiveProgress(playbackState?.progress_ms || 0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playbackState?.progress_ms, playbackState?.is_playing, playbackState?.spotify_connected, playbackState?.duration_ms]);

  // Calculate progress values
  const progressPercentage = playbackState?.duration_ms 
    ? Math.min(100, Math.max(0, (liveProgress / playbackState.duration_ms) * 100))
    : 0;

  const formatDuration = useCallback((ms: number) => {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-gray-800 rounded-lg p-4 md:p-6">
          <div className="flex items-center">
            <Music className="w-8 h-8 text-blue-400 mr-3" />
            <div>
              <p className="text-sm text-gray-400">Total Requests</p>
              <p className="text-2xl font-bold text-white">{stats?.total_requests || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 md:p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-yellow-400 mr-3" />
            <div>
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-2xl font-bold text-white">{stats?.pending_requests || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 md:p-6">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-green-400 mr-3" />
            <div>
              <p className="text-sm text-gray-400">Unique Requesters</p>
              <p className="text-2xl font-bold text-white">{stats?.unique_requesters || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Now Playing */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold text-white mb-4">Now Playing</h2>
        
        {playbackState?.spotify_connected ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-600 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg">
                {playbackState.image_url ? (
                  <img 
                    src={playbackState.image_url} 
                    alt="Album art" 
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <Music className="w-10 h-10 text-gray-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate text-sm md:text-base">
                  {playbackState.track_name || 'No track playing'}
                </h3>
                <p className="text-gray-400 text-xs md:text-sm truncate">
                  {playbackState.artist_name} • {playbackState.album_name}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  <span>
                    {formatDuration(liveProgress)}
                  </span>
                  {' / '}
                  {formatDuration(playbackState?.duration_ms || 0)}
                </p>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 shadow-inner">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-200 shadow-sm"
                style={{ 
                  width: `${progressPercentage}%`
                }}
              ></div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center space-x-6">
              <button
                onClick={() => handlePlaybackControl(playbackState.is_playing ? 'pause' : 'play')}
                className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {playbackState.is_playing ? (
                  <Pause className="w-7 h-7 text-white" />
                ) : (
                  <Play className="w-7 h-7 text-white ml-1" />
                )}
              </button>
              
              <button
                onClick={() => handlePlaybackControl('skip')}
                className="flex items-center justify-center w-12 h-12 bg-gray-600 hover:bg-gray-500 rounded-full transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <SkipForward className="w-6 h-6 text-white" />
              </button>
              
              <div className="flex items-center space-x-2 text-gray-300 bg-gray-700/50 px-3 py-2 rounded-full">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm font-medium">{playbackState.volume_percent || 0}%</span>
              </div>
            </div>

            {/* Device Info */}
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Playing on <span className="text-green-400 font-medium">{playbackState.device_name}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">Connect to Spotify</h3>
            <p className="text-gray-500 mb-4">
              Connect your Spotify account to see what's playing and control playback.
            </p>
            <a
              href="/admin/spotify-setup"
              className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Connect Spotify
            </a>
          </div>
        )}
      </div>

      {/* Up Next */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-white">🎶 Up Next</h2>
          <button className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
            View All →
          </button>
        </div>
        
        {playbackState?.spotify_connected && playbackState.queue && playbackState.queue.length > 0 ? (
          <>
            <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
              {playbackState.queue.map((track: any, index: number) => (
                <div 
                  key={`${track.uri || 'unknown'}-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700/70 rounded-lg transition-all duration-200"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {track.album?.images?.[0]?.url ? (
                        <img 
                          src={track.album.images[0].url} 
                          alt={track.album?.name || 'Album'}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Music className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">
                        {index + 1}. {track.name}
                      </div>
                      <div className="text-xs text-gray-300 truncate">
                        {track.artists?.map((a: any) => a.name).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {track.requester_nickname && (
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        {track.requester_nickname}
                      </div>
                    )}
                    <span className="text-gray-400 text-xs">
                      {formatDuration(track.duration_ms || 0)}
                    </span>
                    <div className="flex flex-col space-y-1">
                    <button
                      disabled={true}
                      className="p-1 rounded transition-colors text-gray-600 cursor-not-allowed"
                      title="Queue reordering temporarily disabled"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      disabled={true}
                      className="p-1 rounded transition-colors text-gray-600 cursor-not-allowed"
                      title="Queue reordering temporarily disabled"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Spotify API Limitation Notice */}
            <div className="mt-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
              <div className="flex items-start space-x-2">
                <div className="w-4 h-4 text-amber-400 mt-0.5">ℹ️</div>
                <div>
                  <p className="text-amber-200 text-xs font-medium">Queue Reordering</p>
                  <p className="text-amber-300/80 text-xs mt-1">
                    Queue reordering is temporarily disabled. Feature will be re-enabled in a future update.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {playbackState?.spotify_connected 
                ? 'No upcoming songs in queue'
                : 'Connect to Spotify to see upcoming songs'
              }
            </p>
            {!playbackState?.spotify_connected && (
              <a
                href="/admin/spotify-setup"
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors mt-4"
              >
                Connect Spotify
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
