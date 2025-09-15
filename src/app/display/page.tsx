'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

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
}

export default function DisplayPage() {
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [upcomingSongs, setUpcomingSongs] = useState<QueueItem[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [deviceType, setDeviceType] = useState<'tv' | 'tablet' | 'mobile'>('tv');

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

    fetchDisplayData();
    
    // Set up polling based on refresh interval
    const interval = setInterval(fetchDisplayData, (eventSettings?.display_refresh_interval || 20) * 1000);
    return () => clearInterval(interval);
  }, [eventSettings?.display_refresh_interval]);

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

  // TV Layout (Large screens)
  if (deviceType === 'tv') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
              <p className="text-2xl text-purple-200">DJ {eventSettings.dj_name}</p>
            )}
            {eventSettings.venue_info && (
              <p className="text-xl text-blue-200 mt-2">{eventSettings.venue_info}</p>
            )}
          </div>

          <div className="flex flex-col h-[calc(100vh-12rem)]">
            {/* Main Content Area */}
            <div className="flex-1 grid grid-cols-4 gap-8 mb-8">
              {/* Now Playing + QR Code Column */}
              <div className="col-span-1 space-y-4">
                {/* Now Playing - Reduced Height */}
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-4 flex-1">
                  <h2 className="text-xl font-semibold mb-3 text-center">🎵 Now Playing</h2>
                  {currentTrack ? (
                    <div className="text-center">
                      {currentTrack.image_url && (
                        <img 
                          src={currentTrack.image_url} 
                          alt="Album Art" 
                          className="w-24 h-24 mx-auto rounded-lg shadow-lg mb-3"
                        />
                      )}
                      <h3 className="text-lg font-bold mb-1 leading-tight">{currentTrack.name}</h3>
                      <p className="text-sm text-gray-300 mb-1">{currentTrack.artists.join(', ')}</p>
                      <p className="text-xs text-gray-400">{currentTrack.album}</p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-sm">
                      No song currently playing
                    </div>
                  )}
                </div>

                {/* QR Code - Under Now Playing */}
                {eventSettings.show_qr_code && qrCodeUrl && (
                  <div className="bg-white rounded-2xl p-4 text-center">
                    <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-2 w-24 h-24" />
                    <p className="text-black text-sm font-semibold">Request your song now!</p>
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

            {/* Scrolling Messages Bar at Bottom */}
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-4 overflow-hidden">
              <div className="flex items-center">
                <div className="text-2xl mr-4">📢</div>
                <div className="flex-1 overflow-hidden">
                  <div className="animate-marquee whitespace-nowrap text-xl font-medium">
                    {messages.join(' • ')} • {messages.join(' • ')} • {messages.join(' • ')}
                  </div>
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
              <p className="text-lg text-purple-200">DJ {eventSettings.dj_name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Current Song */}
              <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6">
                <h2 className="text-2xl font-semibold mb-4 text-center">🎵 Now Playing</h2>
                {currentTrack ? (
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-1">{currentTrack.name}</h3>
                    <p className="text-lg text-gray-300">{currentTrack.artists.join(', ')}</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400">No song playing</div>
                )}
              </div>

              {/* Up Next */}
              {upcomingSongs.length > 0 && (
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6">
                  <h2 className="text-xl font-semibold mb-4">🎶 Up Next</h2>
                  <div className="space-y-3">
                    {upcomingSongs.slice(0, 4).map((song, index) => (
                      <div key={song.uri} className="flex items-center justify-between p-2 bg-white/5 rounded">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">{index + 1}. {song.name}</div>
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
              )}
            </div>

            <div className="space-y-6">
              {eventSettings.show_qr_code && qrCodeUrl && (
                <div className="bg-white rounded-xl p-6 text-center">
                  <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-3 w-32 h-32" />
                  <p className="text-black font-semibold">Request a Song</p>
                </div>
              )}

              <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 text-center">
                <p className="text-lg">{currentMessage}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-sm mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">{eventSettings.event_title}</h1>
          {eventSettings.dj_name && (
            <p className="text-sm text-purple-200">DJ {eventSettings.dj_name}</p>
          )}
        </div>

        {/* Current Song */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 text-center">🎵 Now Playing</h2>
          {currentTrack ? (
            <div className="text-center">
              <h3 className="text-lg font-bold mb-1">{currentTrack.name}</h3>
              <p className="text-sm text-gray-300">{currentTrack.artists.join(', ')}</p>
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm">No song playing</div>
          )}
        </div>

        {eventSettings.show_qr_code && qrCodeUrl && (
          <div className="bg-white rounded-lg p-4 text-center">
            <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-2 w-24 h-24" />
            <p className="text-black text-sm font-semibold">Request a Song</p>
          </div>
        )}

        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 text-center">
          <p className="text-sm">{currentMessage}</p>
        </div>

        {upcomingSongs.length > 0 && (
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">🎶 Up Next</h2>
            <div className="space-y-2">
              {upcomingSongs.slice(0, 3).map((song, index) => (
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
          </div>
        )}
      </div>
    </div>
  );
}
