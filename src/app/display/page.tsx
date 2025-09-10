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

          <div className="grid grid-cols-3 gap-12 items-start">
            {/* Current Song */}
            <div className="col-span-2">
              <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-8 mb-8">
                <h2 className="text-3xl font-semibold mb-6 text-center">🎵 Now Playing</h2>
                {currentTrack ? (
                  <div className="text-center">
                    {currentTrack.image_url && (
                      <img 
                        src={currentTrack.image_url} 
                        alt="Album Art" 
                        className="w-48 h-48 mx-auto rounded-lg shadow-lg mb-6"
                      />
                    )}
                    <h3 className="text-4xl font-bold mb-2">{currentTrack.name}</h3>
                    <p className="text-2xl text-gray-300 mb-4">{currentTrack.artists.join(', ')}</p>
                    <p className="text-xl text-gray-400">{currentTrack.album}</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 text-xl">
                    No song currently playing
                  </div>
                )}
              </div>

              {/* Up Next */}
              {upcomingSongs.length > 0 && (
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-8">
                  <h2 className="text-3xl font-semibold mb-6 text-center">🎶 Up Next</h2>
                  <div className="space-y-4">
                    {upcomingSongs.slice(0, 3).map((song, index) => (
                      <div key={song.uri} className="flex items-center space-x-4 p-4 bg-white/10 rounded-lg">
                        <div className="text-2xl font-bold text-purple-300">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-xl font-semibold">{song.name}</h4>
                          <p className="text-gray-300">{song.artists.join(', ')}</p>
                          {song.requester_nickname && (
                            <p className="text-sm text-purple-200">Requested by {song.requester_nickname}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* QR Code and Messages */}
            <div className="space-y-8">
              {eventSettings.show_qr_code && qrCodeUrl && (
                <div className="bg-white rounded-2xl p-8 text-center">
                  <img src={qrCodeUrl} alt="QR Code" className="mx-auto mb-4" />
                  <p className="text-black text-xl font-semibold">Request a Song</p>
                  <p className="text-gray-600 text-sm mt-2">Scan to add your requests!</p>
                </div>
              )}

              <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 text-center">
                <p className="text-xl leading-relaxed">{currentMessage}</p>
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
                  <div className="space-y-2">
                    {upcomingSongs.slice(0, 3).map((song, index) => (
                      <div key={song.uri} className="text-sm">
                        <span className="font-semibold">{index + 1}. {song.name}</span>
                        <span className="text-gray-300"> - {song.artists.join(', ')}</span>
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
              {upcomingSongs.slice(0, 2).map((song, index) => (
                <div key={song.uri} className="text-xs">
                  <span className="font-semibold">{index + 1}. {song.name}</span>
                  <div className="text-gray-300">{song.artists.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
