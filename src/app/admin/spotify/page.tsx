'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Volume2, Music, RefreshCw, GripVertical } from 'lucide-react';
import { useAdminData } from '../../../hooks/useAdminData';

export default function SpotifyPage() {
  const {
    playbackState,
    realtimeProgress,
    handlePlaybackControl,
    lockInteraction,
    loading
  } = useAdminData();

  const [initialLoading, setInitialLoading] = useState(true);

  // Remove the loading animation after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatProgress = (current: number, total: number) => {
    return `${formatDuration(current)} / ${formatDuration(total)}`;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    lockInteraction(5000); // Prevent refreshes during drag
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex !== dropIndex) {
      // Here you would implement the actual reordering logic
      console.log(`Moving item from ${dragIndex} to ${dropIndex}`);
      // TODO: Implement Spotify queue reordering API call
    }
  };

  if (initialLoading && loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-gray-400">Loading Spotify interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Spotify Connection Status */}
      {!playbackState?.spotify_connected ? (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Spotify Not Connected</h2>
            <p className="text-gray-400 mb-6">
              Connect your Spotify account to control playback and manage the queue.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Having connection issues? Try resetting your Spotify connection first.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/api/spotify/auth"
                className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Connect Spotify
              </a>
              <button
                onClick={() => {
                  fetch('/api/admin/spotify/reset', { method: 'POST' })
                    .then(() => window.location.reload());
                }}
                className="inline-flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Reset Connection
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Now Playing */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Now Playing</h2>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
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
                  <h3 className="text-white font-medium truncate text-lg">
                    {playbackState.track_name || 'No track playing'}
                  </h3>
                  <p className="text-gray-400 truncate">
                    {playbackState.artist_name} • {playbackState.album_name}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {formatProgress(realtimeProgress, playbackState.duration_ms)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-100"
                  style={{ 
                    width: `${Math.min(100, (realtimeProgress / playbackState.duration_ms) * 100)}%` 
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
            </div>
          </div>

          {/* Device Info */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Device Info</h3>
            <div className="text-gray-400">
              <p>Playing on <span className="text-green-400 font-medium">{playbackState.device_name}</span></p>
              <p className="text-sm mt-1">Volume: {playbackState.volume_percent || 0}%</p>
            </div>
          </div>

          {/* Queue Management */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Queue Management</h3>
              <p className="text-sm text-gray-400">Drag to reorder</p>
            </div>
            
            {playbackState.queue && playbackState.queue.length > 0 ? (
              <div className="space-y-3">
                {playbackState.queue.map((track: any, index: number) => (
                  <div
                    key={`${track.id}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-move"
                  >
                    <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    
                    <div className="w-10 h-10 bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                      {track.album?.images?.[0]?.url ? (
                        <img 
                          src={track.album.images[0].url} 
                          alt="Album art" 
                          className="w-full h-full object-cover rounded"
                        />
                      ) : (
                        <Music className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-medium truncate">
                        {track.name}
                      </h4>
                      <p className="text-gray-400 text-xs truncate">
                        {track.artists?.map((a: any) => a.name).join(', ')}
                      </p>
                    </div>
                    
                    <span className="text-gray-500 text-xs flex-shrink-0">
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No songs in queue</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
