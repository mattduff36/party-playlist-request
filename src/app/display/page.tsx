'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { usePusher } from '@/hooks/usePusher';
import { useLiveProgress } from '@/hooks/useLiveProgress';
import { RequestApprovedEvent } from '@/lib/pusher';

interface CurrentTrack {
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  progress_ms: number;
  uri: string;
  image_url?: string;
}

interface QueueItem {
  name: string;
  artists: string[];
  album: string;
  uri: string;
  requester_nickname?: string;
}

interface EventSettings {
  event_title: string;
  dj_name: string;
  venue_info: string;
  welcome_message: string;
  secondary_message: string;
  tertiary_message: string;
  show_qr_code: boolean;
  display_refresh_interval: number;
  // Legacy polling settings (no longer used - Pusher handles real-time updates)
}

interface Notification {
  id: string;
  type: 'approval' | 'rejection' | 'info';
  message: string;
  requester_name?: string;
  track_name?: string;
  created_at: string;
  shown: boolean;
}

interface RequestItem {
  id: string;
  track_name: string;
  artist_name: string;
  requester_nickname?: string;
  created_at: string;
}

export default function DisplayPage() {
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [upcomingSongs, setUpcomingSongs] = useState<QueueItem[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [deviceType, setDeviceType] = useState<'tv' | 'tablet' | 'mobile'>('tv');
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [showingNotification, setShowingNotification] = useState(false);
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set());
  const [approvedRequests, setApprovedRequests] = useState<RequestItem[]>([]);
  const [recentlyPlayedRequests, setRecentlyPlayedRequests] = useState<RequestItem[]>([]);
  
  // 🚀 PUSHER: Real-time updates with animation triggers
  const { isConnected, connectionState } = usePusher({
    onRequestApproved: (data: RequestApprovedEvent) => {
      console.log('🎉 PUSHER: Request approved!', data);
      
      // Add new song to queue
      const newSong: QueueItem = {
        name: data.track_name,
        artists: [data.artist_name],
        album: data.album_name,
        uri: data.track_uri,
        requester_nickname: data.requester_nickname
      };
      
      // Add to upcoming songs
      setUpcomingSongs(prev => [...prev, newSong]);
      
      // Add to approved requests list
      const newRequest: RequestItem = {
        id: data.id,
        track_name: data.track_name,
        artist_name: data.artist_name,
        requester_nickname: data.requester_nickname,
        created_at: new Date().toISOString()
      };
      setApprovedRequests(prev => [newRequest, ...prev].slice(0, 10)); // Keep only latest 10
      
      // 🎯 TRIGGER ANIMATION immediately!
      setAnimatingCards(prev => new Set([...prev, data.track_uri]));
      
      // Animation triggered (removed alert for production)
      console.log(`🎉 ANIMATION TRIGGERED! New song: ${data.track_name} by ${data.requester_nickname}`);
      
      // Remove animation after 1 second
      setTimeout(() => {
        setAnimatingCards(prev => {
          const updated = new Set(prev);
          updated.delete(data.track_uri);
          console.log('✅ Animation completed for:', data.track_name);
          return updated;
        });
      }, 1000);
    },
    onPlaybackUpdate: (data: any) => {
      console.log('🎵 PUSHER: Playback update received!', data);
      
      // Update current track
      if (data.current_track) {
        const newTrack = {
          name: data.current_track.name || '',
          artists: data.current_track.artists?.map((a: any) => a.name) || [],
          album: data.current_track.album?.name || '',
          duration_ms: data.current_track.duration_ms || 0,
          progress_ms: data.progress_ms || 0,
          uri: data.current_track.uri || '',
          image_url: data.current_track.album?.images?.[0]?.url
        };
        
        // Check if this track was in approved requests and move it to recently played
        setApprovedRequests(prev => {
          const matchingRequest = prev.find(req => 
            req.track_name === newTrack.name && req.artist_name === newTrack.artists.join(', ')
          );
          
          if (matchingRequest) {
            // Move to recently played
            setRecentlyPlayedRequests(prevPlayed => [matchingRequest, ...prevPlayed].slice(0, 10));
            // Remove from approved
            return prev.filter(req => req.id !== matchingRequest.id);
          }
          
          return prev;
        });
        
        setCurrentTrack(newTrack);
      }
      
      // Update queue
      if (data.queue) {
        setUpcomingSongs(data.queue.map((track: any) => ({
          name: track.name || '',
          artists: track.artists?.map((a: any) => a.name) || [],
          album: track.album?.name || '',
          uri: track.uri || '',
          requester_nickname: track.requester_nickname
        })));
      }
    }
  });
  
  // Live progress for smooth animation
  const playbackState = currentTrack ? {
    progress_ms: currentTrack.progress_ms,
    duration_ms: currentTrack.duration_ms,
    is_playing: true, // Assume playing if we have a current track
    spotify_connected: true
  } : null;
  
  const liveProgress = useLiveProgress(playbackState, 1000);

  // 🔄 Initial data load only (Pusher handles real-time updates)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [displayResponse, requestsResponse] = await Promise.all([
          fetch('/api/display/current'),
          fetch('/api/display/requests')
        ]);
        
        if (displayResponse.ok) {
          const data = await displayResponse.json();
          
          // Initialize current track
          if (data.current_track) {
            setCurrentTrack({
              name: data.current_track.name || '',
              artists: data.current_track.artists || [],
              album: data.current_track.album || '',
              duration_ms: data.current_track.duration_ms || 0,
              progress_ms: data.current_track.progress_ms || 0,
              uri: data.current_track.uri || '',
              image_url: data.current_track.image_url
            });
          }
          
          // Initialize event settings
          if (data.event_settings) {
            setEventSettings(data.event_settings);
          }
          
          // Initialize upcoming songs
          if (data.upcoming_songs) {
            setUpcomingSongs(data.upcoming_songs);
          }
        }
        
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          setApprovedRequests(requestsData.approved_requests || []);
          setRecentlyPlayedRequests(requestsData.recently_played_requests || []);
        }
      } catch (error) {
        console.error('Failed to fetch initial display data:', error);
      }
    };

    // One-time initial fetch only - Pusher handles all updates after this!
    fetchInitialData();
  }, []); // Empty dependency array - run once only

  // Detect device type
  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      if (width >= 1200) {
        setDeviceType('tv');
      } else if (width >= 768) {
        setDeviceType('tablet');
      } else {
        setDeviceType('mobile');
      }
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL('https://partyplaylist.co.uk/', {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeUrl(url);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, []);

  // Fetch all display data
  useEffect(() => {
    const fetchDisplayData = async () => {
      try {
        const response = await fetch('/api/display/current');
        if (response.ok) {
          const data = await response.json();
          setEventSettings(data.event_settings);
          setCurrentTrack(data.current_track);
          setUpcomingSongs(data.upcoming_songs || []);
        }
      } catch (error) {
        console.error('Error fetching display data:', error);
        // Set default settings if fetch fails
        if (!eventSettings) {
          setEventSettings({
            event_title: 'Party DJ Requests',
            dj_name: '',
            venue_info: '',
            welcome_message: 'Request your favorite songs!',
            secondary_message: 'Your requests will be reviewed by the DJ',
            tertiary_message: 'Keep the party going!',
            show_qr_code: true,
            display_refresh_interval: 20
          });
        }
      }
    };

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/notifications');
        if (response.ok) {
          const data = await response.json();
          if (data.notifications && data.notifications.length > 0) {
            // Mark all notifications as shown immediately since we handle approvals via queue changes
            for (const notification of data.notifications) {
              try {
                await fetch('/api/notifications', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ notificationId: notification.id })
                });
              } catch (error) {
                console.error('Error marking notification as shown:', error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchDisplayData();
    fetchNotifications();
    
    // No more polling - Pusher handles real-time updates!
  }, []); // Only run once

  // Rotate messages
  useEffect(() => {
    if (!eventSettings) return;

    const messages = [
      eventSettings.welcome_message,
      eventSettings.secondary_message,
      eventSettings.tertiary_message
    ].filter(msg => msg.trim() !== '');

    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 5000); // Change message every 5 seconds

    return () => clearInterval(interval);
  }, [eventSettings]);

  if (!eventSettings) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  const messages = [
    eventSettings.welcome_message,
    eventSettings.secondary_message,
    eventSettings.tertiary_message
  ].filter(msg => msg.trim() !== '');

  const currentMessage = messages[currentMessageIndex] || eventSettings.welcome_message;

  // Determine what to show in the scrolling message area (no more approval notifications in scrolling text)
  const displayContent = messages.join(' • ') + ' • ' + messages.join(' • ');
  const messageTextColor = 'text-white';

  // Connection status for display dots
  const spotifyConnected = !!currentTrack;

  // Status dots component
  const StatusDots = () => (
    <div className="fixed bottom-4 left-4 flex space-x-2 z-50">
      {/* Pusher Status Dot */}
      <div 
        className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} opacity-60`}
        title={`Pusher: ${connectionState}`}
      />
      {/* Spotify Status Dot */}
      <div 
        className={`w-3 h-3 rounded-full opacity-60 ${
          spotifyConnected ? 'bg-green-400' : 'bg-gray-500'
        }`}
        title={spotifyConnected ? 'Spotify Connected' : 'No Current Track'}
      />
    </div>
  );


  // TV Layout (Large screens)
  if (deviceType === 'tv') {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* Header - Fixed Height */}
          <div className="text-center py-4 flex-shrink-0">
            <h1 className="text-5xl font-bold mb-2">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
              <p className="text-xl text-purple-200">DJ {eventSettings.dj_name}</p>
            )}
            {eventSettings.venue_info && (
              <p className="text-lg text-blue-200 mt-1">{eventSettings.venue_info}</p>
            )}
          </div>

          {/* Main Content Area - Dynamic Height */}
          <div className="flex-1 grid grid-cols-4 gap-6 min-h-0 mb-4">
              {/* Now Playing + QR Code Column */}
              <div className="col-span-1 flex flex-col h-full">
                {/* Now Playing - Takes most of the space */}
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 flex-1 flex flex-col justify-center">
                  <h2 className="text-2xl font-semibold mb-6 text-center">🎵 Now Playing</h2>
                {currentTrack ? (
                  <div className="text-center">
                    {currentTrack.image_url && (
                      <img 
                        src={currentTrack.image_url} 
                        alt="Album Art" 
                          className="w-40 h-40 mx-auto rounded-lg shadow-lg mb-6"
                        />
                      )}
                      <h3 className="text-2xl font-bold mb-3 leading-tight">{currentTrack.name}</h3>
                      <p className="text-lg text-gray-300 mb-2">{currentTrack.artists.join(', ')}</p>
                      <p className="text-sm text-gray-400 mb-3">{currentTrack.album}</p>
                      
                  </div>
                ) : (
                    <div className="text-center text-gray-400 text-lg">
                    No song currently playing
                  </div>
                )}
              </div>

                {/* QR Code - Square block at bottom */}
                {eventSettings.show_qr_code && qrCodeUrl && (
                  <div className="bg-white rounded-2xl p-6 text-center mt-4">
                    <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-3 w-32 h-32" />
                    <p className="text-black text-lg font-semibold">Request your song now!</p>
                  </div>
                )}
              </div>

              {/* Up Next - Longer Section */}
              <div className="col-span-2">
                {upcomingSongs.length > 0 ? (
                  <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 h-full">
                  <h2 className="text-3xl font-semibold mb-6 text-center">🎶 Up Next</h2>
                    <div className="space-y-3 overflow-y-auto max-h-[calc(100%-4rem)]">
                      {upcomingSongs.slice(0, 12).map((song, index) => {
                        const isAnimating = animatingCards.has(song.uri);
                        if (isAnimating) {
                          console.log(`🎨 Rendering animated card for: ${song.name} (${song.uri})`);
                        }
                        return (
                        <div 
                          key={`${song.uri || 'unknown'}-${index}`} 
                          className={`flex items-center justify-between p-3 bg-white/10 rounded-lg transition-all duration-1000 ${
                            isAnimating
                              ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                              : ''
                          }`}
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="text-xl font-bold text-purple-300 flex-shrink-0 w-8">
                          {index + 1}
                        </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-lg font-semibold truncate">{song.name}</h4>
                              <p className="text-gray-300 text-sm truncate">{song.artists.join(', ')}</p>
                        </div>
                      </div>
                          {song.requester_nickname && (
                            <div className="flex-shrink-0 ml-3">
                              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                {song.requester_nickname}
                              </div>
                            </div>
                          )}
            </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 h-full flex items-center justify-center">
                    <div className="text-center text-gray-400 text-xl">
                      No upcoming songs in queue
                    </div>
                </div>
              )}
              </div>

              {/* Requests Section */}
              <div className="col-span-1">
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 h-full">
                  {approvedRequests.length > 0 ? (
                    <>
                      <h2 className="text-3xl font-semibold mb-6 text-center">🎵 Requests on the way for...</h2>
                      <div className="space-y-4 max-h-80 overflow-hidden">
                        {approvedRequests.slice(0, 6).map((request, index) => (
                          <div key={`${request.id}-${index}`} className="p-3 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg border border-green-500/30">
                            <div className="flex items-center space-x-3">
                              <div className="text-2xl">🎶</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-lg font-bold text-green-300 truncate">{request.requester_nickname || 'Anonymous'}</div>
                                <div className="text-sm text-gray-300 truncate">{request.track_name}</div>
                                <div className="text-xs text-green-400 truncate">{request.artist_name}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : recentlyPlayedRequests.length > 0 ? (
                    <>
                      <h2 className="text-3xl font-semibold mb-6 text-center">🎵 Recently played requests for...</h2>
                      <div className="space-y-4 max-h-80 overflow-hidden">
                        {recentlyPlayedRequests.slice(0, 6).map((request, index) => (
                          <div key={`${request.id}-${index}`} className="p-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                            <div className="flex items-center space-x-3">
                              <div className="text-2xl">✅</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-lg font-bold text-purple-300 truncate">{request.requester_nickname || 'Anonymous'}</div>
                                <div className="text-sm text-gray-300 truncate">{request.track_name}</div>
                                <div className="text-xs text-purple-400 truncate">{request.artist_name}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-3xl font-semibold mb-6 text-center">🎵 No requests yet!</h2>
                      <div className="text-center text-gray-400">
                        <p className="text-lg">Scan the QR code to make the first request!</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

          {/* Scrolling Messages Bar at Bottom - Fixed Height */}
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-3 overflow-hidden flex-shrink-0 h-16">
            <div className="flex items-center h-full">
              <div className="text-xl mr-3">📢</div>
              <div className="flex-1 overflow-hidden">
                  <div className={`animate-marquee whitespace-nowrap text-lg font-medium ${messageTextColor}`}>
                    {displayContent}
                  </div>
              </div>
            </div>
          </div>
        </div>
        <StatusDots />
      </div>
    );
  }

  // Tablet Layout
  if (deviceType === 'tablet') {
    const isLandscape = window.innerWidth > window.innerHeight;
    
    if (isLandscape) {
      // Tablet Landscape - Full desktop layout with smaller text
      return (
        <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-3 overflow-hidden">
          <div className="max-w-6xl mx-auto h-full flex flex-col">
            {/* Header - Fixed Height */}
            <div className="text-center py-2 flex-shrink-0">
              <h1 className="text-3xl font-bold mb-1">{eventSettings.event_title}</h1>
              {eventSettings.dj_name && (
                <p className="text-base text-purple-200">DJ {eventSettings.dj_name}</p>
              )}
              {eventSettings.venue_info && (
                <p className="text-sm text-blue-200">{eventSettings.venue_info}</p>
              )}
            </div>

            {/* Main Content Area - Dynamic Height */}
            <div className="flex-1 grid grid-cols-4 gap-4 min-h-0 mb-3">
              {/* Now Playing + QR Code Column */}
              <div className="col-span-1 flex flex-col h-full">
                {/* Now Playing - Takes most of the space */}
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex-1 flex flex-col justify-center">
                  <h2 className="text-lg font-semibold mb-3 text-center">🎵 Now Playing</h2>
                  {currentTrack ? (
                    <div className="text-center">
                      {currentTrack.image_url && (
                        <img 
                          src={currentTrack.image_url} 
                          alt="Album Art" 
                          className="w-24 h-24 mx-auto rounded-lg shadow-lg mb-3"
                        />
                      )}
                      <h3 className="text-base font-bold mb-2 leading-tight">{currentTrack.name}</h3>
                      <p className="text-sm text-gray-300 mb-1">{currentTrack.artists.join(', ')}</p>
                      <p className="text-xs text-gray-400 mb-2">{currentTrack.album}</p>
                      
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-sm">
                      No song currently playing
                    </div>
                  )}
                </div>

                {/* QR Code - Square block at bottom */}
                {eventSettings.show_qr_code && qrCodeUrl && (
                  <div className="bg-white rounded-xl p-3 text-center mt-3">
                    <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-2 w-20 h-20" />
                    <p className="text-black text-sm font-semibold">Request your song now!</p>
                  </div>
                )}
              </div>

              {/* Up Next - Longer Section */}
              <div className="col-span-2">
                {upcomingSongs.length > 0 ? (
                  <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 h-full">
                    <h2 className="text-xl font-semibold mb-4 text-center">🎶 Upcoming songs</h2>
                    <div className="space-y-2 overflow-y-auto h-full">
                      {upcomingSongs.slice(0, 10).map((song, index) => (
                        <div 
                          key={`${song.uri || 'unknown'}-${index}`} 
                          className={`flex items-center justify-between p-2 bg-white/5 rounded-lg transition-all duration-1000 ${
                            animatingCards.has(song.uri) 
                              ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                              : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate text-sm">{index + 1}. {song.name}</div>
                            <div className="text-xs text-gray-300 truncate">{song.artists.join(', ')}</div>
                          </div>
                          {song.requester_nickname && (
                            <div className="flex-shrink-0 ml-2">
                              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                {song.requester_nickname}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 h-full flex items-center justify-center">
                    <p className="text-gray-400 text-center text-base">No upcoming songs in queue</p>
                  </div>
                )}
              </div>

              {/* Requests Section */}
              <div className="col-span-1">
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 h-full">
                  {approvedRequests.length > 0 ? (
                    <>
                      <h2 className="text-lg font-semibold mb-4 text-center">🎵 Requests on the way for...</h2>
                      <div className="space-y-2 max-h-64 overflow-hidden">
                        {approvedRequests.slice(0, 8).map((request, index) => (
                          <div key={`${request.id}-${index}`} className="p-2 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg border border-green-500/30">
                            <div className="flex items-center space-x-2">
                              <div className="text-base">🎶</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-green-300 truncate">{request.requester_nickname || 'Anonymous'}</div>
                                <div className="text-xs text-gray-300 truncate">{request.track_name}</div>
                                <div className="text-xs text-green-400 truncate">{request.artist_name}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : recentlyPlayedRequests.length > 0 ? (
                    <>
                      <h2 className="text-lg font-semibold mb-4 text-center">🎵 Recently played requests for...</h2>
                      <div className="space-y-2 max-h-64 overflow-hidden">
                        {recentlyPlayedRequests.slice(0, 8).map((request, index) => (
                          <div key={`${request.id}-${index}`} className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                            <div className="flex items-center space-x-2">
                              <div className="text-base">✅</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-purple-300 truncate">{request.requester_nickname || 'Anonymous'}</div>
                                <div className="text-xs text-gray-300 truncate">{request.track_name}</div>
                                <div className="text-xs text-purple-400 truncate">{request.artist_name}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-semibold mb-4 text-center">🎵 No requests yet!</h2>
                      <div className="text-center text-gray-400">
                        <p className="text-sm">Scan the QR code to make the first request!</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Scrolling Messages Bar at Bottom - Fixed Height */}
            <div className="bg-black/50 backdrop-blur-sm rounded-xl p-2 overflow-hidden flex-shrink-0 h-12">
              <div className="flex items-center h-full">
                <div className="text-base mr-2">📢</div>
                <div className="flex-1 overflow-hidden">
                  <div className={`animate-marquee whitespace-nowrap text-sm font-medium ${messageTextColor}`}>
                    {displayContent}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <StatusDots />
        </div>
      );
    } else {
      // Tablet Portrait - Simplified layout
    return (
        <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4 overflow-hidden">
          <div className="max-w-2xl mx-auto h-full flex flex-col">
            <div className="text-center py-3 flex-shrink-0">
              <h1 className="text-2xl font-bold mb-1">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
                <p className="text-sm text-purple-200">DJ {eventSettings.dj_name}</p>
            )}
          </div>

              {/* Current Song */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex-shrink-0 mb-4">
              <h2 className="text-xl font-semibold mb-3 text-center">🎵 Now Playing</h2>
                {currentTrack ? (
                  <div className="text-center">
                  {currentTrack.image_url && (
                    <img 
                      src={currentTrack.image_url} 
                      alt="Album Art" 
                      className="w-32 h-32 mx-auto rounded-lg shadow-lg mb-4"
                    />
                  )}
                  <h3 className="text-lg font-bold mb-2">{currentTrack.name}</h3>
                  <p className="text-base text-gray-300 mb-3">{currentTrack.artists.join(', ')}</p>
                  
                  </div>
                ) : (
                  <div className="text-center text-gray-400">No song playing</div>
                )}
              </div>

              {/* Up Next */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex-1 min-h-0 overflow-hidden mb-4">
              <h2 className="text-xl font-semibold mb-3">🎶 Up Next</h2>
              {upcomingSongs.length > 0 ? (
                <div className="space-y-2 overflow-y-auto h-full">
                  {upcomingSongs.slice(0, 12).map((song, index) => (
                    <div 
                      key={`${song.uri || 'unknown'}-${index}`} 
                      className={`flex items-center justify-between p-3 bg-white/5 rounded-lg transition-all duration-1000 ${
                        animatingCards.has(song.uri) 
                          ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                          : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{index + 1}. {song.name}</div>
                        <div className="text-sm text-gray-300 truncate">{song.artists.join(', ')}</div>
                      </div>
                      {song.requester_nickname && (
                        <div className="flex-shrink-0 ml-3">
                          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                            {song.requester_nickname}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-center">No upcoming songs in queue</p>
                </div>
              )}
            </div>

            {/* Scrolling Messages Bar at Bottom */}
            <div className="bg-black/50 backdrop-blur-sm rounded-xl p-3 overflow-hidden flex-shrink-0 h-14">
              <div className="flex items-center h-full">
                <div className="text-lg mr-3">📢</div>
                <div className="flex-1 overflow-hidden">
                  <div className={`animate-marquee whitespace-nowrap text-base font-medium ${messageTextColor}`}>
                    {displayContent}
                </div>
              </div>
            </div>
          </div>
          <StatusDots />
        </div>
      </div>
    );
    }
  }

  // Mobile Layout
  const isLandscape = window.innerWidth > window.innerHeight;
  
  if (isLandscape) {
    // Mobile Landscape - Full desktop layout with very small text
  return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-2 overflow-hidden">
        <div className="max-w-5xl mx-auto h-full flex flex-col">
          {/* Header - Fixed Height */}
          <div className="text-center py-1 flex-shrink-0">
            <h1 className="text-lg font-bold mb-1">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
              <p className="text-xs text-purple-200">DJ {eventSettings.dj_name}</p>
            )}
            {eventSettings.venue_info && (
              <p className="text-xs text-blue-200">{eventSettings.venue_info}</p>
            )}
          </div>

          {/* Main Content Area - Dynamic Height */}
          <div className="flex-1 grid grid-cols-4 gap-2 min-h-0 mb-2">
            {/* Now Playing + QR Code Column */}
            <div className="col-span-1 flex flex-col h-full">
              {/* Now Playing - Takes most of the space */}
              <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 flex-1 flex flex-col justify-center">
                <h2 className="text-xs font-semibold mb-2 text-center">🎵 Now Playing</h2>
                {currentTrack ? (
        <div className="text-center">
                    {currentTrack.image_url && (
                      <img 
                        src={currentTrack.image_url} 
                        alt="Album Art" 
                        className="w-16 h-16 mx-auto rounded-lg shadow-lg mb-2"
                      />
                    )}
                    <h3 className="text-xs font-bold mb-1 leading-tight">{currentTrack.name}</h3>
                    <p className="text-xs text-gray-300 mb-1">{currentTrack.artists.join(', ')}</p>
                    <p className="text-xs text-gray-400">{currentTrack.album}</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 text-xs">
                    No song currently playing
                  </div>
                )}
              </div>

              {/* QR Code - Square block at bottom */}
              {eventSettings.show_qr_code && qrCodeUrl && (
                <div className="bg-white rounded-lg p-2 text-center mt-2">
                  <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-1 w-12 h-12" />
                  <p className="text-black text-xs font-semibold">Request now!</p>
                </div>
              )}
            </div>

            {/* Up Next - Longer Section */}
            <div className="col-span-2">
              {upcomingSongs.length > 0 ? (
                <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 h-full">
                  <h2 className="text-sm font-semibold mb-2 text-center">🎶 Upcoming songs</h2>
                  <div className="space-y-1 overflow-y-auto h-full">
                    {upcomingSongs.slice(0, 8).map((song, index) => (
                      <div 
                        key={`${song.uri || 'unknown'}-${index}`} 
                        className={`flex items-center justify-between p-1 bg-white/5 rounded transition-all duration-1000 ${
                          animatingCards.has(song.uri) 
                            ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                            : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-xs">{index + 1}. {song.name}</div>
                          <div className="text-xs text-gray-300 truncate">{song.artists.join(', ')}</div>
                        </div>
                        {song.requester_nickname && (
                          <div className="flex-shrink-0 ml-1">
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1 py-0.5 rounded-full text-xs font-bold">
                              {song.requester_nickname}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 h-full flex items-center justify-center">
                  <p className="text-gray-400 text-center text-xs">No upcoming songs in queue</p>
                </div>
              )}
            </div>

            {/* Requests Section */}
            <div className="col-span-1">
              <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 h-full">
                {approvedRequests.length > 0 ? (
                  <>
                    <h2 className="text-xs font-semibold mb-2 text-center">🎵 Requests on the way for...</h2>
                    <div className="space-y-1 max-h-32 overflow-hidden">
                      {approvedRequests.slice(0, 5).map((request, index) => (
                        <div key={request.id} className="p-1 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded border border-green-500/30">
                          <div className="flex items-center space-x-1">
                            <div className="text-xs">🎶</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-green-300 truncate">{request.requester_nickname || 'Anonymous'}</div>
                              <div className="text-xs text-gray-300 truncate">{request.track_name}</div>
                              <div className="text-xs text-green-400 truncate">{request.artist_name}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : recentlyPlayedRequests.length > 0 ? (
                  <>
                    <h2 className="text-xs font-semibold mb-2 text-center">🎵 Recently played requests for...</h2>
                    <div className="space-y-1 max-h-32 overflow-hidden">
                      {recentlyPlayedRequests.slice(0, 5).map((request, index) => (
                        <div key={request.id} className="p-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded border border-purple-500/30">
                          <div className="flex items-center space-x-1">
                            <div className="text-xs">✅</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-purple-300 truncate">{request.requester_nickname || 'Anonymous'}</div>
                              <div className="text-xs text-gray-300 truncate">{request.track_name}</div>
                              <div className="text-xs text-purple-400 truncate">{request.artist_name}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-xs font-semibold mb-2 text-center">🎵 No requests yet!</h2>
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400 text-center text-xs">Waiting for song requests...</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Scrolling Messages Bar at Bottom - Fixed Height */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-1 overflow-hidden flex-shrink-0 h-8">
            <div className="flex items-center h-full">
              <div className="text-xs mr-1">📢</div>
              <div className="flex-1 overflow-hidden">
                <div className={`animate-marquee whitespace-nowrap text-xs font-medium ${messageTextColor}`}>
                  {displayContent}
                </div>
              </div>
            </div>
          </div>
        </div>
        <StatusDots />
      </div>
    );
  } else {
    // Mobile Portrait - Simplified layout
    return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-3 overflow-hidden">
        <div className="max-w-sm mx-auto h-full flex flex-col">
          <div className="text-center flex-shrink-0 mb-3">
            <h1 className="text-xl font-bold mb-1">{eventSettings.event_title}</h1>
          {eventSettings.dj_name && (
              <p className="text-xs text-purple-200">DJ {eventSettings.dj_name}</p>
          )}
        </div>

        {/* Current Song */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-3 flex-shrink-0 mb-3">
          <h2 className="text-lg font-semibold mb-3 text-center">🎵 Now Playing</h2>
          {currentTrack ? (
            <div className="text-center">
                {currentTrack.image_url && (
                  <img 
                    src={currentTrack.image_url} 
                    alt="Album Art" 
                    className="w-24 h-24 mx-auto rounded-lg shadow-lg mb-3"
                  />
                )}
              <h3 className="text-lg font-bold mb-1">{currentTrack.name}</h3>
              <p className="text-sm text-gray-300 mb-3">{currentTrack.artists.join(', ')}</p>
              
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm">No song playing</div>
          )}
        </div>

          {/* Up Next */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-3 flex-1 min-h-0 overflow-hidden mb-3">
            <h2 className="text-base font-semibold mb-2">🎶 Up Next</h2>
            {upcomingSongs.length > 0 ? (
              <div className="space-y-2 overflow-y-auto h-full">
                {upcomingSongs.slice(0, 8).map((song, index) => (
                  <div 
                    key={`${song.uri || 'unknown'}-${index}`} 
                    className={`flex items-center justify-between p-2 bg-white/5 rounded text-xs transition-all duration-1000 ${
                      animatingCards.has(song.uri) 
                        ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                        : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{index + 1}. {song.name}</div>
                      <div className="text-gray-300 truncate">{song.artists.join(', ')}</div>
                    </div>
                    {song.requester_nickname && (
                      <div className="flex-shrink-0 ml-2">
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                          {song.requester_nickname}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-center text-sm">No upcoming songs in queue</p>
          </div>
        )}
          </div>

          {/* Scrolling Messages Bar at Bottom */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 overflow-hidden flex-shrink-0 h-12">
            <div className="flex items-center h-full">
              <div className="text-sm mr-2">📢</div>
              <div className="flex-1 overflow-hidden">
                <div className={`animate-marquee whitespace-nowrap text-xs font-medium ${messageTextColor}`}>
                  {displayContent}
                </div>
              </div>
            </div>
          </div>
      </div>
      <StatusDots />
    </div>
  );
  }
}
