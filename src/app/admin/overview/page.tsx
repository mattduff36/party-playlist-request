'use client';

import { Play, Pause, SkipForward, Volume2, Music, Users, Clock } from 'lucide-react';
import { useCallback } from 'react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { useLiveProgress } from '../../../hooks/useLiveProgress';

export default function OverviewPage() {
  const {
    playbackState,
    stats,
    eventSettings,
    handlePlaybackControl,
    loading
  } = useAdminData();

  console.log('📊 OverviewPage rendering with:', {
    playbackState_connected: playbackState?.spotify_connected,
    playbackState_track: playbackState?.track_name,
    stats_total: stats?.total_requests,
    stats_pending: stats?.pending_requests,
    loading
  });

  // Use live progress hook for smooth animation and real-time updates
  const liveProgress = useLiveProgress(playbackState, 1000);

  const formatDuration = useCallback((ms: number) => {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const formatProgress = useCallback((current: number, total: number) => {
    const currentFormatted = formatDuration(current);
    const totalFormatted = formatDuration(total);
    return `${currentFormatted} / ${totalFormatted}`;
  }, [formatDuration]);

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
    <div className="space-y-6">
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
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                {playbackState.album_image_url ? (
                  <img 
                    src={playbackState.album_image_url} 
                    alt="Album art" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Music className="w-8 h-8 text-gray-400" />
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
                  <span className={liveProgress.isAnimating ? 'text-green-400' : ''}>
                    {liveProgress.currentTime}
                  </span>
                  {' / '}
                  {liveProgress.totalTime}
                </p>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-75 ${
                  liveProgress.isAnimating 
                    ? 'bg-green-400 shadow-sm shadow-green-400/50' 
                    : 'bg-green-500'
                }`}
                style={{ 
                  width: `${liveProgress.progressPercentage}%`,
                  transition: liveProgress.isAnimating 
                    ? 'width 75ms linear, background-color 200ms ease' 
                    : 'width 200ms ease, background-color 200ms ease'
                }}
              ></div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => handlePlaybackControl(playbackState.is_playing ? 'pause' : 'play')}
                className="flex items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
              >
                {playbackState.is_playing ? (
                  <Pause className="w-6 h-6 text-white" />
                ) : (
                  <Play className="w-6 h-6 text-white ml-1" />
                )}
              </button>
              
              <button
                onClick={() => handlePlaybackControl('skip')}
                className="flex items-center justify-center w-12 h-12 bg-gray-600 hover:bg-gray-700 rounded-full transition-colors"
              >
                <SkipForward className="w-6 h-6 text-white" />
              </button>
              
              <div className="flex items-center space-x-2 text-gray-400">
                <Volume2 className="w-5 h-5" />
                <span className="text-sm">{playbackState.volume_percent || 0}%</span>
              </div>
            </div>

            {/* Device Info */}
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Playing on <span className="text-green-400">{playbackState.device_name}</span>
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

      {/* Coming Up Next */}
      <div className="bg-gray-800 rounded-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-white">Coming Up Next</h2>
          <button className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
            View All →
          </button>
        </div>
        
        {playbackState?.spotify_connected && playbackState.queue && playbackState.queue.length > 0 ? (
          <div className="space-y-3">
            {playbackState.queue.slice(0, 3).map((track: any, index: number) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                  <Music className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-medium truncate">
                    {track.name}
                  </h4>
                  <p className="text-gray-400 text-xs truncate">
                    {track.artists?.map((a: any) => a.name).join(', ')}
                  </p>
                </div>
                <span className="text-gray-500 text-xs">
                  {formatDuration(track.duration_ms || 0)}
                </span>
              </div>
            ))}
          </div>
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
