'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

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
  // Polling intervals (in seconds)
  admin_polling_interval?: number;
  display_polling_interval?: number;
  now_playing_polling_interval?: number;
  sse_update_interval?: number;
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

export default function DisplayPage() {
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [upcomingSongs, setUpcomingSongs] = useState<QueueItem[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [deviceType, setDeviceType] = useState<'tv' | 'tablet' | 'mobile'>('tv');
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [showingNotification, setShowingNotification] = useState(false);
  
  // WebSocket for real-time updates
  const realtimeUpdates = useRealtimeUpdates();

  // Sync real-time Spotify data with display state
  useEffect(() => {
    if (realtimeUpdates.spotifyState && realtimeUpdates.spotifyState.current_track) {
      const spotifyTrack = realtimeUpdates.spotifyState.current_track;
      setCurrentTrack({
        name: spotifyTrack.name || '',
        artists: spotifyTrack.artists?.map((a: any) => a.name) || [],
        album: spotifyTrack.album?.name || '',
        duration_ms: spotifyTrack.duration_ms || 0,
        progress_ms: realtimeUpdates.currentProgress || spotifyTrack.progress_ms || 0,
        uri: spotifyTrack.uri || '',
        image_url: spotifyTrack.album?.images?.[0]?.url
      });
      
      // Update upcoming songs from queue
      if (realtimeUpdates.spotifyState.queue) {
        const queueItems = realtimeUpdates.spotifyState.queue.map((track: any) => ({
          name: track.name || '',
          artists: track.artists?.map((a: any) => a.name) || [],
          album: track.album?.name || '',
          uri: track.uri || '',
          requester_nickname: track.requester_nickname
        }));
        setUpcomingSongs(queueItems);
      }
    }
  }, [realtimeUpdates.spotifyState, realtimeUpdates.currentProgress]);

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
          if (data.notifications && data.notifications.length > 0 && !showingNotification) {
            const notification = data.notifications[0];
            setCurrentNotification(notification);
            setShowingNotification(true);
            
            // Show notification for 5 seconds, then mark as shown
            setTimeout(async () => {
              try {
                await fetch('/api/notifications', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ notificationId: notification.id })
                });
              } catch (error) {
                console.error('Error marking notification as shown:', error);
              }
              setShowingNotification(false);
              setCurrentNotification(null);
            }, 5000);
          }
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchDisplayData();
    fetchNotifications();
    
    // Set up polling based on display polling interval
    const pollingInterval = (eventSettings?.display_polling_interval || eventSettings?.display_refresh_interval || 20) * 1000;
    console.log(`🔄 Display page polling interval: ${pollingInterval/1000}s`);
    
    const interval = setInterval(() => {
      fetchDisplayData();
      fetchNotifications();
    }, pollingInterval);
    return () => clearInterval(interval);
  }, [eventSettings?.display_polling_interval, eventSettings?.display_refresh_interval, showingNotification]);

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

  // Determine what to show in the scrolling message area
  const displayContent = showingNotification && currentNotification 
    ? messages.join(' • ') + ' • ' + currentNotification.message + ' • ' + messages.join(' • ')
    : messages.join(' • ') + ' • ' + messages.join(' • ');
  
  const messageTextColor = showingNotification && currentNotification?.type === 'approval' 
    ? 'text-green-400' 
    : 'text-white';

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
                      <p className="text-sm text-gray-400">{currentTrack.album}</p>
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
                      {upcomingSongs.slice(0, 12).map((song, index) => (
                        <div key={song.uri} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
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
                      ))}
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

              {/* Top Requesters */}
              <div className="col-span-1">
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 h-full">
                  <h2 className="text-3xl font-semibold mb-6 text-center">🏆 Top Requesters!</h2>
                  <div className="space-y-4">
                    {/* Placeholder top requesters */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">🥇</div>
                        <div>
                          <div className="text-lg font-bold text-yellow-300">Sarah M.</div>
                          <div className="text-sm text-gray-300">12 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-lg border border-gray-400/30">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">🥈</div>
                        <div>
                          <div className="text-lg font-bold text-gray-300">Mike R.</div>
                          <div className="text-sm text-gray-300">8 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-600/20 to-amber-700/20 rounded-lg border border-amber-600/30">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">🥉</div>
                        <div>
                          <div className="text-lg font-bold text-amber-300">Alex K.</div>
                          <div className="text-sm text-gray-300">6 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-lg font-bold text-purple-300 w-8">4.</div>
                        <div>
                          <div className="text-base font-semibold">Emma L.</div>
                          <div className="text-sm text-gray-300">4 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-lg font-bold text-purple-300 w-8">5.</div>
                        <div>
                          <div className="text-base font-semibold">Chris P.</div>
                          <div className="text-sm text-gray-300">3 requests</div>
                        </div>
                      </div>
                    </div>
                  </div>
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
                      <p className="text-xs text-gray-400">{currentTrack.album}</p>
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
                        <div key={song.uri} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
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

              {/* Top Requesters */}
              <div className="col-span-1">
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 h-full">
                  <h2 className="text-lg font-semibold mb-4 text-center">🏆 Top Requesters!</h2>
                  <div className="space-y-2">
                    {/* Placeholder top requesters */}
                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
                      <div className="flex items-center space-x-2">
                        <div className="text-base">🥇</div>
                        <div>
                          <div className="text-sm font-bold text-yellow-300">Sarah M.</div>
                          <div className="text-xs text-gray-300">12 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-lg border border-gray-400/30">
                      <div className="flex items-center space-x-2">
                        <div className="text-base">🥈</div>
                        <div>
                          <div className="text-sm font-bold text-gray-300">Mike R.</div>
                          <div className="text-xs text-gray-300">8 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-amber-600/20 to-amber-700/20 rounded-lg border border-amber-600/30">
                      <div className="flex items-center space-x-2">
                        <div className="text-base">🥉</div>
                        <div>
                          <div className="text-sm font-bold text-amber-300">Alex K.</div>
                          <div className="text-xs text-gray-300">6 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-bold text-purple-300 w-6">4.</div>
                        <div>
                          <div className="text-xs font-semibold">Emma L.</div>
                          <div className="text-xs text-gray-300">4 requests</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-bold text-purple-300 w-6">5.</div>
                        <div>
                          <div className="text-xs font-semibold">Chris P.</div>
                          <div className="text-xs text-gray-300">3 requests</div>
                        </div>
                      </div>
                    </div>
                  </div>
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
                  <p className="text-base text-gray-300">{currentTrack.artists.join(', ')}</p>
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
                    <div key={song.uri} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
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
                      <div key={song.uri} className="flex items-center justify-between p-1 bg-white/5 rounded">
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

            {/* Top Requesters */}
            <div className="col-span-1">
              <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 h-full">
                <h2 className="text-xs font-semibold mb-2 text-center">🏆 Top Requesters!</h2>
                <div className="space-y-1">
                  {/* Placeholder top requesters */}
                  <div className="flex items-center justify-between p-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded border border-yellow-500/30">
                    <div className="flex items-center space-x-1">
                      <div className="text-xs">🥇</div>
                      <div>
                        <div className="text-xs font-bold text-yellow-300">Sarah M.</div>
                        <div className="text-xs text-gray-300">12 requests</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-1 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded border border-gray-400/30">
                    <div className="flex items-center space-x-1">
                      <div className="text-xs">🥈</div>
                      <div>
                        <div className="text-xs font-bold text-gray-300">Mike R.</div>
                        <div className="text-xs text-gray-300">8 requests</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-1 bg-gradient-to-r from-amber-600/20 to-amber-700/20 rounded border border-amber-600/30">
                    <div className="flex items-center space-x-1">
                      <div className="text-xs">🥉</div>
                      <div>
                        <div className="text-xs font-bold text-amber-300">Alex K.</div>
                        <div className="text-xs text-gray-300">6 requests</div>
                      </div>
                    </div>
                  </div>
                </div>
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
              <p className="text-sm text-gray-300">{currentTrack.artists.join(', ')}</p>
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
                  <div key={song.uri} className="flex items-center justify-between p-2 bg-white/5 rounded text-xs">
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
    </div>
  );
  }
}
