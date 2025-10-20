'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import QRCode from 'qrcode';
import { usePusher } from '@/hooks/usePusher';
import { useLiveProgress } from '@/hooks/useLiveProgress';
import { RequestApprovedEvent } from '@/lib/pusher';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import PartyNotStarted from '@/components/PartyNotStarted';
import { EventConfig } from '@/lib/db/schema';
import { sanitizeRequesterNameForDisplay } from '@/lib/profanity-filter';

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

// Authentication wrapper for multi-tenant display
export default function UserDisplayPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, [username]);

  async function checkAuth() {
    setLoading(true);
    setError(null);

    try {
      // First, check session storage for PIN-based auth
      const stored = sessionStorage.getItem(`display_auth_${username}`);
      if (stored) {
        try {
          const auth = JSON.parse(stored);
          // Check if auth is still valid (24 hours)
          if (Date.now() - auth.timestamp < 24 * 60 * 60 * 1000) {
            console.log('✅ Display authenticated via sessionStorage (PIN-based)');
            setAuthenticated(true);
            setLoading(false);
            return;
          } else {
            console.log('⏰ Session expired, clearing...');
            sessionStorage.removeItem(`display_auth_${username}`);
          }
        } catch (e) {
          console.error('Invalid session data:', e);
          sessionStorage.removeItem(`display_auth_${username}`);
        }
      }
      
      // Check if user is logged in as the owner
      const meResponse = await fetch('/api/auth/me');
      
      if (meResponse.ok) {
        const { user } = await meResponse.json();
        
        if (user.username === username) {
          console.log(`✅ User ${user.username} accessing display page (owner)`);
          setAuthenticated(true);
          setLoading(false);
          return;
        } else {
          setError(`You're logged in as ${user.username} but trying to access ${username}'s display.`);
          setLoading(false);
          return;
        }
      }

      // Not authenticated - need PIN
      console.log('🔐 No valid authentication found, need PIN');
      setError(`To access the display screen, use the URL: /${username}/display/[PIN] (where [PIN] is your 4-digit event PIN from the admin panel)`);
      setLoading(false);
    } catch (err) {
      console.error('Display auth error:', err);
      setError('Failed to authenticate. Please try again.');
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#1DB954] mx-auto mb-4" />
          <p className="text-lg">Loading display page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <div className="flex flex-col items-center mb-6">
            <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
            <h1 className="text-2xl font-bold text-center mb-2">Access Denied</h1>
          </div>

          <div className="bg-red-900 bg-opacity-30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            <p>{error}</p>
          </div>

          {error.includes('logged in as') && (
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 mb-3"
            >
              <Lock className="inline h-5 w-5 mr-2" />
              Switch Account
            </button>
          )}

          <button
            onClick={() => router.push('/login')}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-300"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  // Authenticated - show full display page with all animations
  return <DisplayPage username={username} />;
}

// Main display page component with ALL original animations preserved
function DisplayPage({ username }: { username: string }) {
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [upcomingSongs, setUpcomingSongs] = useState<QueueItem[]>([]);
  const [eventSettings, setEventSettings] = useState<EventConfig | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [deviceType, setDeviceType] = useState<'tv' | 'tablet' | 'mobile'>('tv');
  
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [showingNotification, setShowingNotification] = useState(false);
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  
  // Track if Now Playing section should use horizontal layout
  const [useHorizontalLayout, setUseHorizontalLayout] = useState(false);
  const nowPlayingResizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Debouncing and stability for layout changes
  const layoutChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLayoutStateRef = useRef<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);
  const [approvedRequests, setApprovedRequests] = useState<RequestItem[]>([]);
  const [recentlyPlayedRequests, setRecentlyPlayedRequests] = useState<RequestItem[]>([]);
  
  // 🖼️ Force portrait/vertical layout when notice board message is visible
  // This ensures Now Playing and QR Code switch to portrait mode when a message appears
  const finalUseHorizontalLayout = isMessageVisible ? false : useHorizontalLayout;
  
  // Use global event state
  const { state: globalState } = useGlobalEvent();
  
  // Log state changes for monitoring
  useEffect(() => {
    console.log('📺 [DisplayPage] Global state updated:', {
      status: globalState.status,
      pagesEnabled: globalState.pagesEnabled,
    });
  }, [globalState.status, globalState.pagesEnabled]);

  // Cleanup ResizeObserver on component unmount
  useEffect(() => {
    return () => {
      // Clean up ResizeObserver on unmount
      if (nowPlayingResizeObserverRef.current) {
        console.log('🧹 Cleaning up ResizeObserver on component unmount');
        nowPlayingResizeObserverRef.current.disconnect();
        nowPlayingResizeObserverRef.current = null;
      }
      
      // Clean up any pending layout change timeouts
      if (layoutChangeTimeoutRef.current) {
        clearTimeout(layoutChangeTimeoutRef.current);
        layoutChangeTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Helper function to sanitize requester names for display
  const sanitizeName = (name?: string): string => {
    if (!name) return '';
    const filteringEnabled = eventSettings?.decline_explicit || false;
    return sanitizeRequesterNameForDisplay(name, filteringEnabled);
  };
  
  // Message system state
  const [currentMessage, setCurrentMessage] = useState<{
    text: string;
    duration: number | null;
    created_at: string;
  } | null>(null);
  
  // Animation state for notice board
  const [isMessageVisible, setIsMessageVisible] = useState(false); // Controls horizontal (columns)
  const [isVerticalExpanded, setIsVerticalExpanded] = useState(false); // Controls vertical (rows)
  const [showMessageText, setShowMessageText] = useState(false);
  
  // Handle notice board animation when message changes - two-phase approach
  useEffect(() => {
    if (currentMessage) {
      console.log('🎬 Starting notice board animation for message:', currentMessage.text.substring(0, 50) + '...');
      
      // Set animation flag to prevent layout changes during animation
      isAnimatingRef.current = true;
      
      // Message is appearing
      // Phase 1: Horizontal expansion (columns: 0fr→1fr, 2fr→1fr)
      console.log('🎬 Phase 1: Horizontal expansion');
      setIsMessageVisible(true);
      
      // Phase 2: After 1s, do vertical animation + fade in text
      const phase2Timer = setTimeout(() => {
        console.log('🎬 Phase 2: Vertical expansion + text fade-in');
        setIsVerticalExpanded(true);
        setShowMessageText(true);
        
        // Clear animation flag after animation completes
        setTimeout(() => {
          isAnimatingRef.current = false;
          console.log('🎬 Animation complete, layout changes re-enabled');
        }, 1000); // Additional 1s for vertical animation
      }, 1000);
      
      return () => {
        clearTimeout(phase2Timer);
        isAnimatingRef.current = false;
      };
    } else {
      console.log('🎬 Starting notice board collapse animation');
      
      // Set animation flag during collapse
      isAnimatingRef.current = true;
      
      // Message is disappearing - reverse order
      // Phase 1: Fade out text + vertical animation
      console.log('🎬 Phase 1: Text fade-out + vertical collapse');
      setShowMessageText(false);
      setIsVerticalExpanded(false);
      
      // Phase 2: After 1s, collapse horizontally
      const collapseTimer = setTimeout(() => {
        console.log('🎬 Phase 2: Horizontal collapse');
        setIsMessageVisible(false);
        
        // Clear animation flag after collapse completes
        setTimeout(() => {
          isAnimatingRef.current = false;
          console.log('🎬 Collapse animation complete, layout changes re-enabled');
        }, 1000); // Additional 1s for horizontal collapse
      }, 1000);
      
      return () => {
        clearTimeout(collapseTimer);
        isAnimatingRef.current = false;
      };
    }
  }, [currentMessage]);
  
  // 🚀 PUSHER: Real-time updates with animation triggers
  const { isConnected, connectionState } = usePusher({
    username: username, // Pass username for userId lookup on public pages
    onPageControlToggle: (data: any) => {
      console.log('🔄 Display page control changed via Pusher:', data);
      // State is now managed by GlobalEventProvider via Pusher listeners
    },
    onAdminLogin: (data: any) => {
      console.log('🔐 Admin login via Pusher:', data);
      // State is now managed by GlobalEventProvider
    },
    onAdminLogout: (data: any) => {
      console.log('🔐 Admin logout via Pusher:', data);
      // State is now managed by GlobalEventProvider
    },
    onSettingsUpdate: (data: any) => {
      console.log('⚙️ Display settings updated via Pusher:', data);
      // Check if we're already on the authenticated PIN URL
      const currentPath = window.location.pathname;
      const isAuthenticatedUrl = currentPath.includes('/display/') && currentPath.split('/').length > 3;
      
      if (isAuthenticatedUrl) {
        // We're already on the authenticated URL, just refresh the display data
        console.log('🔄 Settings updated - refreshing display data without redirect');
        fetchDisplayData();
      } else {
        // We're not on the authenticated URL, redirect to it
        const stored = sessionStorage.getItem(`display_auth_${username}`);
        if (stored) {
          try {
            const auth = JSON.parse(stored);
            if (Date.now() - auth.timestamp < 24 * 60 * 60 * 1000) {
              // Authentication is still valid, redirect to authenticated URL
              console.log('🔄 Settings updated - redirecting to authenticated display URL');
              window.location.href = `/${username}/display/${auth.pin}`;
            } else {
              console.log('⏰ Authentication expired during settings update');
              setAuthenticated(false);
              setError('Authentication expired. Please refresh the page.');
            }
          } catch (e) {
            console.error('Invalid authentication data during settings update:', e);
            setAuthenticated(false);
            setError('Authentication invalid. Please refresh the page.');
          }
        } else {
          console.log('🔐 No authentication found during settings update');
          setAuthenticated(false);
          setError('Authentication lost. Please refresh the page.');
        }
      }
    },
    onRequestApproved: (data: RequestApprovedEvent) => {
      console.log('🎉 PUSHER: Request approved!', data);
      
      // Add to approved requests list immediately for the "Requests on the way" section
      const newRequest: RequestItem = {
        id: data.id,
        track_name: data.track_name,
        artist_name: data.artist_name,
        requester_nickname: data.requester_nickname,
        created_at: new Date().toISOString()
      };
      setApprovedRequests(prev => [newRequest, ...prev].slice(0, 10)); // Keep only latest 10
      
      // Trigger animation immediately
      setAnimatingCards(prev => new Set([...prev, data.track_uri]));
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
      
      // Note: Queue updates are handled by onPlaybackUpdate callback
      // This callback only handles the "Requests on the way" animation
      console.log('✅ Request approved animation completed, queue updates handled by onPlaybackUpdate');
    },
    onPlaybackUpdate: (data: any) => {
      console.log('🎵 PUSHER: Playback update received!', data);
      
      // Update current track
      if (data.current_track) {
        const newTrack = {
          name: data.current_track.name || '',
          artists: Array.isArray(data.current_track.artists) 
            ? data.current_track.artists.map((a: any) => typeof a === 'string' ? a : a.name)
            : [],
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
        
        // Force state update by creating new object reference
        setCurrentTrack({...newTrack});
        console.log('✅ Current track state updated:', newTrack.name);
      }
      
      // Update queue - show all songs with hidden scrollbar and fade-out gradient
      if (data.queue) {
        console.log('🎵 PUSHER: Updating queue with', data.queue.length, 'tracks');
        
        const processedQueue = data.queue.map((track: any) => ({
          name: track.name || '',
          artists: Array.isArray(track.artists) 
            ? track.artists.map((a: any) => typeof a === 'string' ? a : a.name)
            : [],
          album: track.album?.name || track.album || '',
          uri: track.uri || '',
          requester_nickname: track.requester_nickname
        }));
        
        // Force state update by creating new array reference
        setUpcomingSongs([...processedQueue]);
        console.log('✅ Queue state updated with', processedQueue.length, 'tracks');
      }
    },
    onMessageUpdate: (data: any) => {
      console.log('💬 PUSHER: Message updated!', data);
      
      // Validate message data
      if (!data.message_text || !data.message_duration || !data.message_created_at) {
        console.error('❌ Invalid message data received:', data);
        return;
      }
      
      const messageData = {
        text: data.message_text,
        duration: data.message_duration,
        created_at: data.message_created_at
      };
      
      console.log('✅ Setting current message:', {
        text: messageData.text.substring(0, 50) + '...',
        duration: messageData.duration,
        created_at: messageData.created_at
      });
      
      setCurrentMessage(messageData);
    },
    onMessageCleared: (data: any) => {
      console.log('💬 PUSHER: Message cleared!', data);
      setCurrentMessage(null);
    },
    onSettingsUpdate: (data: any) => {
      console.log('⚙️ PUSHER: Settings updated!', data);
      if (data.settings) {
        setEventSettings(data.settings);
        console.log('✅ Event settings refreshed from Pusher');
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

  // Callback ref for Now Playing section - sets up ResizeObserver to detect layout changes
  // This is now reactive to isMessageVisible changes (notice board appearing/disappearing)
  const nowPlayingRef = useCallback((element: HTMLDivElement | null) => {
    // Clean up existing observer
    if (nowPlayingResizeObserverRef.current) {
      console.log('🧹 Cleaning up existing ResizeObserver');
      nowPlayingResizeObserverRef.current.disconnect();
      nowPlayingResizeObserverRef.current = null;
    }

    // Clear any pending layout change timeouts
    if (layoutChangeTimeoutRef.current) {
      clearTimeout(layoutChangeTimeoutRef.current);
      layoutChangeTimeoutRef.current = null;
    }

    if (!element || deviceType !== 'tv') {
      console.log('📱 Skipping ResizeObserver setup - not TV device or no element');
      return;
    }

    try {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          
          // Add hysteresis to prevent rapid switching
          // Different thresholds for switching to horizontal vs vertical
          const currentIsHorizontal = lastLayoutStateRef.current;
          const horizontalThreshold = currentIsHorizontal ? 1.8 : 2.2; // Hysteresis: 1.8 to switch to vertical, 2.2 to switch to horizontal
          const shouldBeHorizontal = width >= height * horizontalThreshold;
          
          // Only proceed if layout actually needs to change and we're not animating
          if (shouldBeHorizontal !== currentIsHorizontal && !isAnimatingRef.current) {
            console.log(`📐 Now Playing dimensions: ${Math.round(width)}x${Math.round(height)}, ratio: ${(width/height).toFixed(2)}, threshold: ${horizontalThreshold}, horizontal: ${shouldBeHorizontal}`);
            
            // Clear any existing timeout
            if (layoutChangeTimeoutRef.current) {
              clearTimeout(layoutChangeTimeoutRef.current);
            }
            
            // Debounce layout changes to prevent rapid switching
            layoutChangeTimeoutRef.current = setTimeout(() => {
              // Double-check we're still not animating and dimensions haven't changed significantly
              if (!isAnimatingRef.current) {
                console.log(`📐 Applying layout change: ${shouldBeHorizontal ? 'horizontal' : 'vertical'}`);
                setUseHorizontalLayout(shouldBeHorizontal);
                lastLayoutStateRef.current = shouldBeHorizontal;
              }
              layoutChangeTimeoutRef.current = null;
            }, 150); // 150ms debounce
          }
        }
      });

      observer.observe(element);
      nowPlayingResizeObserverRef.current = observer;
      console.log('👀 ResizeObserver setup complete');
    } catch (error) {
      console.error('❌ Error setting up ResizeObserver:', error);
    }
  }, [deviceType, isMessageVisible]); // Re-observe when notice board state changes

  // Calculate dynamic font size based on message length and device type
  // Ensures ALL text fits in container without resizing, minimum 0.1rem
  // Maximizes use of available vertical and horizontal space
  const getMessageFontSize = (messageText: string, deviceType: 'tv' | 'tablet' | 'mobile') => {
    const containerDimensions = {
      tv: { width: 400, height: 300 },      // Approximate container dimensions for TV layout
      tablet: { width: 300, height: 200 }, // Approximate container dimensions for tablet layout  
      mobile: { width: 250, height: 150 }  // Approximate container dimensions for mobile layout
    };
    
    const maxSizes = {
      tv: 4.0,      // Maximum font size in rem for TV (increased)
      tablet: 3.0,  // Maximum font size in rem for tablet (increased)
      mobile: 2.0   // Maximum font size in rem for mobile (increased)
    };
    
    const { width: containerWidth, height: containerHeight } = containerDimensions[deviceType];
    const maxSize = maxSizes[deviceType];
    const minSize = 0.1; // Minimum font size in rem as requested
    
    // Account for padding and safety margin (30% margin on each side)
    const availableWidth = containerWidth * 0.7;
    const availableHeight = containerHeight * 0.7;
    
    // Average character width is roughly 0.7em (conservative), line height is 1.2em
    const avgCharWidth = 0.7;
    const lineHeightMultiplier = 1.2;
    
    // Find the longest word to ensure it can fit on a single line
    const words = messageText.split(/\s+/);
    const longestWordLength = Math.max(...words.map(w => w.length));
    const messageLength = messageText.length;
    
    // Binary search for optimal font size that uses maximum space
    let minFontSize = minSize;
    let maxFontSize = maxSize;
    let optimalFontSize = minSize;
    
    for (let i = 0; i < 20; i++) { // 20 iterations for precision
      const testFontSize = (minFontSize + maxFontSize) / 2;
      const testFontSizePx = testFontSize * 16; // Convert rem to px
      
      // Calculate how many characters fit per line at this font size
      const charsPerLine = Math.floor(availableWidth / (testFontSizePx * avgCharWidth));
      
      // Check if the longest word can fit on a single line
      const longestWordWidth = longestWordLength * testFontSizePx * avgCharWidth;
      const wordFits = longestWordWidth <= availableWidth;
      
      // Calculate how many lines we need
      const requiredLines = Math.ceil(messageLength / charsPerLine);
      
      // Calculate total height needed
      const totalHeight = requiredLines * testFontSizePx * lineHeightMultiplier;
      
      // Check if it fits within available height AND the longest word fits on one line
      if (totalHeight <= availableHeight && charsPerLine > 0 && wordFits) {
        optimalFontSize = testFontSize;
        minFontSize = testFontSize; // Try larger
      } else {
        maxFontSize = testFontSize; // Too big, try smaller
      }
    }
    
    // Ensure we don't exceed bounds
    optimalFontSize = Math.max(minSize, Math.min(maxSize, optimalFontSize));
    
    return `${optimalFontSize}rem`;
  };

  // 🔄 Initial data load only (Pusher handles real-time updates)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const displayResponse = await fetch(`/api/public/display-data?username=${username}`);
        
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
            console.log('📱 Initial load: Loading', data.upcoming_songs.length, 'upcoming songs');
            setUpcomingSongs(data.upcoming_songs);
          }
        }
        
        // Fetch requests for "Requests on the way" section
        const requestsResponse = await fetch(`/api/public/requests?username=${username}`);
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          // Use the requests directly - they're already approved/pending
          setApprovedRequests((requestsData.requests || []).filter((r: any) => r.status === 'approved'));
        }

        // Fetch current message (username-scoped)
        const messageResponse = await fetch(`/api/public/event-config?username=${username}`);
        if (messageResponse.ok) {
          const messageData = await messageResponse.json();
          if (messageData.message_text && !messageData.expired) {
            setCurrentMessage({
              text: messageData.message_text,
              duration: messageData.message_duration,
              created_at: messageData.message_created_at
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial display data:', error);
      }
    };

    // One-time initial fetch only - Pusher handles all updates after this!
    fetchInitialData();
  }, []); // Empty dependency array - run once only

  // Detect device type and re-limit songs when device changes
  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      const newDeviceType = width >= 1200 ? 'tv' : width >= 768 ? 'tablet' : 'mobile';
      
      if (newDeviceType !== deviceType) {
        setDeviceType(newDeviceType);
        console.log('📱 Device type changed to', newDeviceType);
      }
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, [deviceType]);

  // Auto-expire messages based on duration
  // Fixed: Account for animation time and network delays
  useEffect(() => {
    if (!currentMessage || !currentMessage.duration || !currentMessage.created_at) {
      return;
    }

    const createdAt = new Date(currentMessage.created_at);
    const now = new Date();
    
    // Add grace period for network delays (2 seconds)
    const gracePeriod = 2000;
    const adjustedCreatedAt = new Date(createdAt.getTime() - gracePeriod);
    const expiresAt = new Date(adjustedCreatedAt.getTime() + (currentMessage.duration * 1000));
    
    // Animation takes 2 seconds to complete (1s horizontal + 1s vertical)
    const animationDuration = 2000;
    
    // Calculate when to start the expiration timer (after animation completes)
    const animationEndTime = now.getTime() + animationDuration;
    const messageEndTime = expiresAt.getTime();
    
    // If message would expire before animation completes, extend it
    const effectiveExpiryTime = Math.max(animationEndTime, messageEndTime);
    const timeUntilExpiry = effectiveExpiryTime - now.getTime();
    
    // Ensure minimum display time of 10 seconds from when animation completes
    const minDisplayTime = 10000; // 10 seconds
    const finalExpiryTime = Math.max(effectiveExpiryTime, animationEndTime + minDisplayTime);
    const finalTimeUntilExpiry = finalExpiryTime - now.getTime();
    
    console.log(`💬 Message timing: animation ends in ${Math.round(animationDuration / 1000)}s, expires in ${Math.round(finalTimeUntilExpiry / 1000)}s`);
    
    const timeoutId = setTimeout(() => {
      console.log('💬 Message expired after full display time, clearing...');
      setCurrentMessage(null);
    }, finalTimeUntilExpiry);

    return () => clearTimeout(timeoutId);
  }, [currentMessage]);

  // Generate QR code with username-specific URL (with bypass token)
  useEffect(() => {
    const generateQR = async () => {
      try {
        // Base request URL
        let requestUrl = `${window.location.origin}/${username}/request`;
        
        // Add bypass token if available (for no-PIN QR code access)
        if (globalState.bypassToken) {
          requestUrl += `?bt=${globalState.bypassToken}`;
          console.log('📱 QR Code generated with bypass token for no-PIN access');
        } else {
          console.log('⚠️ QR Code generated without bypass token - PIN will be required');
        }
        
        const url = await QRCode.toDataURL(requestUrl, {
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
  }, [username, globalState.bypassToken]);

  // ===== REMOVED OLD STATE MANAGEMENT =====
  // All state is now managed by GlobalEventProvider
  // checkDisplayStatus, checkAdminLoginStatus, and fetchPageControls are no longer needed

  // Fetch all display data - moved outside useEffect to be accessible from Pusher handlers
  const fetchDisplayData = useCallback(async () => {
    try {
      const response = await fetch(`/api/public/display-data?username=${username}`);
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
  }, [username, eventSettings]);

  // Fetch all display data
  useEffect(() => {
    fetchDisplayData();

    const fetchNotifications = async () => {
      // Note: Notifications endpoint currently disabled (pending multi-tenant refactor)
      // Notifications are currently disabled pending proper multi-tenant implementation
      console.log('📝 Notifications fetching skipped (multi-tenant refactor needed)');
      try {
        // Keeping error handling for future implementation
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    console.log('🚀 DisplayPage: useEffect running - client-side JS is working!');
    setMounted(true);
    setIsClient(true);
    fetchDisplayData();
    fetchNotifications();
    
    // State is now managed by GlobalEventProvider
    // No manual status checks needed - Pusher handles real-time updates automatically
    
    // No more polling - Pusher handles real-time updates!
  }, [username]); // Re-fetch when username changes

  // Message rotation is now handled by the individual scrolling system below

  // Dynamic theme colors (defined early for use in all return statements)
  const themeColors = {
    primary: (eventSettings as any)?.theme_primary_color || '#1DB954',
    secondary: (eventSettings as any)?.theme_secondary_color || '#191414',
    tertiary: (eventSettings as any)?.theme_tertiary_color || '#1ed760',
  };
  
  const gradientStyle = {
    background: `linear-gradient(to bottom right, ${themeColors.primary}, ${themeColors.secondary}, ${themeColors.tertiary})`
  };

  // Show loading state while mounting or waiting for global state
  const isLoadingEssentialData = !mounted || globalState.isLoading;
    
  if (isLoadingEssentialData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  // Check event status and page controls using global state (with safety checks)
  const isOffline = globalState?.status === 'offline';
  const isStandby = globalState?.status === 'standby';
  const isLive = globalState?.status === 'live';
  const displayEnabled = globalState?.pagesEnabled?.display ?? true;
  
  // Show "Party Not Started" when offline
  if (isOffline) {
    console.log('🎉 DisplayPage: Party Not Started (offline)');
    return <PartyNotStarted variant="display" />;
  }
  
  // Show "Display Disabled" when in standby or live but display is disabled
  if ((isStandby || isLive) && !displayEnabled) {
    console.log('🚫 DisplayPage: Display Disabled');
    return (
      <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
        <div className="text-center px-4">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 text-yellow-400 text-8xl animate-pulse">📺</div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            🎉 Display Disabled
          </h1>
          <p className="text-2xl text-gray-300 mb-4">
            The DJ has temporarily disabled the display screen
          </p>
          <p className="text-lg text-gray-400">
            Check back in a few minutes!
          </p>
        </div>
      </div>
    );
  }
  
  // Party is active and display is enabled - show display content (continue to main UI)
  // At this point, either admin is logged in with display enabled, or global party is active with display enabled
  // Continue to show the main display content UI

  if (!eventSettings) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Admin status and page controls are handled above - this is the main display content

  // Simple message concatenation for scrolling (no individual message system)
  const messages = eventSettings ? [
    eventSettings.welcome_message,
    eventSettings.secondary_message,
    eventSettings.tertiary_message
  ].filter(msg => msg && msg.trim() !== '') : [];
  
  const messagesText = messages.length > 0 ? messages.join('                               ') : '';
  const displayContent = messagesText;
  
  // Calculate animation duration based on total character count
  const baseDuration = 30; // Base duration in seconds (doubled from 15)
  const characterMultiplier = 0.1; // 0.1 seconds per character (doubled from 0.05)
  const totalCharacters = messagesText.length;
  const dynamicDuration = Math.max(baseDuration, totalCharacters * characterMultiplier) + 4; // Add 4 second buffer

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
      <div className="h-screen text-white p-6 overflow-hidden" style={gradientStyle}>
        <div className="w-full h-full flex flex-col">
          {/* Header - Fixed Height */}
          <div className="text-center py-4 flex-shrink-0">
            <h1 className="text-5xl font-bold mb-2">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
              <p className="text-xl text-[#1ed760]">DJ {eventSettings.dj_name}</p>
            )}
            {eventSettings.venue_info && (
              <p className="text-lg text-gray-300 mt-1">{eventSettings.venue_info}</p>
            )}
          </div>

          {/* Main Content Area - Dynamic Height */}
          <div 
            className="flex-1 min-h-0"
            style={{
              display: 'grid',
              gridTemplateColumns: isMessageVisible ? '0.5fr 0.5fr 1fr 1fr 0.5fr 0.5fr' : '1fr 1fr 1fr 1fr 0fr 0fr',
              gridTemplateRows: isVerticalExpanded ? '4fr 2fr' : '3fr 3fr',
              gap: '1.5rem',
              marginRight: isMessageVisible ? '0' : '-3rem',
              transition: 'grid-template-columns 1s ease-in-out, grid-template-rows 1s ease-in-out, margin-right 1s ease-in-out'
            }}
          >
              {/* Now Playing Section */}
              <div 
                ref={nowPlayingRef}
                className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 flex flex-col justify-center min-w-0"
                style={{
                  gridColumn: '1 / span 2',
                  gridRow: '1'
                }}
              >
                <h2 className="text-2xl font-semibold mb-6 text-center">🎵 Now Playing</h2>
                {currentTrack ? (
                  finalUseHorizontalLayout ? (
                    // Horizontal layout: Album art left, details right (centered)
                    <div className="flex items-center gap-8 justify-center max-w-4xl mx-auto">
                      {currentTrack.image_url && (
                        <img 
                          src={currentTrack.image_url} 
                          alt="Album Art" 
                          className="rounded-lg shadow-lg"
                          style={{ width: '300px', height: '300px', objectFit: 'cover' }}
                        />
                      )}
                      <div className="text-left" style={{ width: '300px' }}>
                        <h3 className="text-4xl font-bold mb-4 leading-tight">{currentTrack.name}</h3>
                        <p className="text-2xl text-gray-300 mb-3">
                          {currentTrack.artists && currentTrack.artists.length > 0 
                            ? currentTrack.artists.filter(a => a).join(', ') 
                            : 'Unknown Artist'}
                        </p>
                        <p className="text-xl text-gray-400">{currentTrack.album || 'Unknown Album'}</p>
                      </div>
                    </div>
                  ) : (
                    // Vertical layout: Centered
                    <div className="text-center">
                      {currentTrack.image_url && (
                        <img 
                          src={currentTrack.image_url} 
                          alt="Album Art" 
                          className="w-40 h-40 mx-auto rounded-lg shadow-lg mb-6"
                        />
                      )}
                      <h3 className="text-2xl font-bold mb-3 leading-tight">{currentTrack.name}</h3>
                      <p className="text-lg text-gray-300 mb-2">
                        {currentTrack.artists && currentTrack.artists.length > 0 
                          ? currentTrack.artists.filter(a => a).join(', ') 
                          : 'Unknown Artist'}
                      </p>
                      <p className="text-sm text-gray-400 mb-3">{currentTrack.album || 'Unknown Album'}</p>
                    </div>
                  )
                ) : (
                  <div className="text-center text-gray-400 text-lg">
                    No song currently playing
                  </div>
                )}
              </div>

              {/* QR Code Section */}
              {eventSettings.show_qr_code && qrCodeUrl && (
                <div 
                  className="bg-white rounded-2xl p-6 flex items-center justify-center min-w-0"
                  style={{
                    gridColumn: '1 / span 2',
                    gridRow: '2'
                  }}
                >
                  {finalUseHorizontalLayout ? (
                    // Horizontal layout: QR code left, text right (centered)
                    <div className="flex items-center gap-8 justify-center max-w-4xl mx-auto">
                      <img 
                        src={qrCodeUrl} 
                        alt="QR Code" 
                        style={{ width: '300px', height: '300px', aspectRatio: '1/1' }}
                      />
                      <div className="text-left" style={{ width: '300px' }}>
                        <p className="text-black text-xl font-semibold mb-4 leading-relaxed">
                          Scan the QR code to make a request, or visit:
                        </p>
                        <p className="text-black text-lg font-bold mb-1">
                          partyplaylist.co.uk/
                        </p>
                        <p className="text-black text-lg font-bold mb-4">
                          {username}/request
                        </p>
                        {globalState.pin && (
                          <p className="text-black text-xl font-semibold">
                            and enter PIN <span className="font-mono font-bold text-2xl">{globalState.pin}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Vertical layout: Centered
                    <div className="text-center flex flex-col items-center">
                      <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto max-w-xs mb-3" style={{ aspectRatio: '1/1' }} />
                      <p className="text-black text-lg font-semibold">Request your song now!</p>
                    </div>
                  )}
                </div>
              )}

              {/* Up Next */}
              <div 
                className="flex flex-col min-h-0 min-w-0"
                style={{
                  gridColumn: '3 / span 2',
                  gridRow: '1 / span 2'
                }}
              >
                {upcomingSongs.length > 0 ? (
                  <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 flex flex-col h-full min-h-0 relative">
                  <h2 className="text-3xl font-semibold mb-6 text-center flex-shrink-0">🎶 Up Next</h2>
                    <div className="space-y-3 overflow-y-auto flex-1 min-h-0 scrollbar-hide relative" data-up-next-container>
                      {upcomingSongs.map((song, index) => {
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
                            <div className="text-xl font-bold text-[#1DB954] flex-shrink-0 w-8">
                          🎵
                        </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-lg font-semibold truncate">{song.name}</h4>
                              <p className="text-gray-300 text-sm truncate">
                                {song.artists && song.artists.length > 0 ? song.artists.filter(a => a).join(', ') : 'Unknown Artist'}
                              </p>
                        </div>
                      </div>
                          {song.requester_nickname && (
                            <div className="flex-shrink-0 ml-3">
                              <div className="bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                {sanitizeName(song.requester_nickname)}
                              </div>
                            </div>
                          )}
            </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 flex flex-col h-full min-h-0 items-center justify-center">
                    <div className="text-center text-gray-400 text-xl">
                      No upcoming songs in queue
                    </div>
                  </div>
                )}
              </div>

              {/* Messages Section (Notice Board) */}
              <div 
                className="min-w-0"
                style={{
                  gridColumn: '5 / span 2',
                  gridRow: '1 / span 2',
                  width: isMessageVisible ? 'auto' : '0',
                  minWidth: isMessageVisible ? 'auto' : '0',
                  overflow: 'hidden',
                  padding: isMessageVisible ? '0' : '0',
                  margin: isMessageVisible ? '0' : '0',
                  opacity: isMessageVisible ? 1 : 0,
                  transition: 'width 1s ease-in-out, min-width 1s ease-in-out, opacity 1s ease-in-out'
                }}
              >
                <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 h-full flex flex-col" style={{ minWidth: '200px' }}>
                  <div className="flex-1 flex items-center justify-center">
                    {currentMessage && (
                      <div className={`text-center px-4 overflow-hidden transition-opacity duration-300 ${
                        showMessageText ? 'opacity-100' : 'opacity-0'
                      }`}>
                        <div 
                          className="text-white font-medium leading-tight"
                          style={{ 
                            fontSize: getMessageFontSize(currentMessage.text, 'tv'),
                            lineHeight: '1.3',
                            wordBreak: 'normal',
                            overflowWrap: 'normal',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {currentMessage.text.split('\n').map((line, index) => (
                            <div key={index} style={{ fontSize: index === 0 ? '1.5em' : '1em' }}>
                              {line || '\u00A0'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          {/* Scrolling Messages Bar at Bottom - Fixed Height */}
          {(eventSettings as any).show_scrolling_bar !== false && (
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-3 overflow-hidden flex-shrink-0 h-16 mt-4">
              <div className="flex items-center h-full">
                <div className="text-xl mr-3">📢</div>
                <div className="flex-1 overflow-hidden">
                    {displayContent && (
                      <div 
                        className={`whitespace-nowrap text-lg font-medium ${messageTextColor}`}
                        style={{
                          animation: `marquee ${dynamicDuration}s linear infinite`
                        }}
                      >
                        {displayContent}
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
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
        <div className="h-screen text-white p-3 overflow-hidden" style={gradientStyle}>
          <div className="w-full h-full flex flex-col">
            {/* Header - Fixed Height */}
            <div className="text-center py-2 flex-shrink-0">
              <h1 className="text-3xl font-bold mb-1">{eventSettings.event_title}</h1>
              {eventSettings.dj_name && (
                <p className="text-base text-[#1ed760]">DJ {eventSettings.dj_name}</p>
              )}
              {eventSettings.venue_info && (
                <p className="text-sm text-gray-300">{eventSettings.venue_info}</p>
              )}
            </div>

            {/* Main Content Area - Dynamic Height */}
            <div 
              className="flex-1 min-h-0"
              style={{
                display: 'grid',
                gridTemplateColumns: isMessageVisible ? '0.5fr 0.5fr 1fr 1fr 0.5fr 0.5fr' : '1fr 1fr 1fr 1fr 0fr 0fr',
                gridTemplateRows: isVerticalExpanded ? '4fr 2fr' : '3fr 3fr',
                gap: '1rem',
                marginRight: isMessageVisible ? '0' : '-2rem',
                transition: 'grid-template-columns 1s ease-in-out, grid-template-rows 1s ease-in-out, margin-right 1s ease-in-out'
              }}
            >
              {/* Now Playing */}
              <div 
                className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex flex-col justify-center min-w-0"
                style={{
                  gridColumn: '1 / span 2',
                  gridRow: '1'
                }}
              >
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
                      <p className="text-sm text-gray-300 mb-1">
                        {currentTrack.artists && currentTrack.artists.length > 0 
                          ? currentTrack.artists.filter(a => a).join(', ') 
                          : 'Unknown Artist'}
                      </p>
                      <p className="text-xs text-gray-400 mb-2">{currentTrack.album || 'Unknown Album'}</p>
                      
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-sm">
                      No song currently playing
                    </div>
                  )}
                </div>

              {/* QR Code */}
              {eventSettings.show_qr_code && qrCodeUrl && (
                <div 
                  className="bg-white rounded-xl p-3 text-center flex flex-col justify-center items-center min-w-0"
                  style={{
                    gridColumn: '1 / span 2',
                    gridRow: '2'
                  }}
                >
                  <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto max-w-[200px] mb-2" style={{ aspectRatio: '1/1' }} />
                  <p className="text-black text-sm font-semibold">Request your song now!</p>
                </div>
              )}

              {/* Up Next */}
              <div 
                className="flex flex-col min-h-0 min-w-0"
                style={{
                  gridColumn: '3 / span 2',
                  gridRow: '1 / span 2'
                }}
              >
                {upcomingSongs.length > 0 ? (
                  <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex flex-col h-full min-h-0 relative">
                    <h2 className="text-xl font-semibold mb-4 text-center flex-shrink-0">🎶 Up Next</h2>
                    <div className="space-y-2 overflow-y-auto flex-1 min-h-0 scrollbar-hide" data-up-next-container>
                      {upcomingSongs.map((song, index) => (
                        <div 
                          key={`${song.uri || 'unknown'}-${index}`} 
                          className={`flex items-center justify-between p-2 bg-white/5 rounded-lg transition-all duration-1000 ${
                            animatingCards.has(song.uri) 
                              ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                              : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate text-sm">{song.name}</div>
                            <div className="text-xs text-gray-300 truncate">
                              {song.artists && song.artists.length > 0 ? song.artists.filter(a => a).join(', ') : 'Unknown Artist'}
                            </div>
                          </div>
                          {song.requester_nickname && (
                            <div className="flex-shrink-0 ml-2">
                              <div className="bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-white px-2 py-1 rounded-full text-xs font-bold">
                                {sanitizeName(song.requester_nickname)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex flex-col h-full min-h-0 items-center justify-center">
                    <p className="text-gray-400 text-center text-base">No upcoming songs in queue</p>
                  </div>
                )}
              </div>

              {/* Messages Section (Notice Board) */}
              <div 
                className="min-w-0"
                style={{
                  gridColumn: '5 / span 2',
                  gridRow: '1 / span 2',
                  width: isMessageVisible ? 'auto' : '0',
                  minWidth: isMessageVisible ? 'auto' : '0',
                  overflow: 'hidden',
                  padding: isMessageVisible ? '0' : '0',
                  margin: isMessageVisible ? '0' : '0',
                  opacity: isMessageVisible ? 1 : 0,
                  transition: 'width 1s ease-in-out, min-width 1s ease-in-out, opacity 1s ease-in-out'
                }}
              >
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 h-full flex flex-col" style={{ minWidth: '150px' }}>
                  <div className="flex-1 flex items-center justify-center">
                    {currentMessage && (
                      <div className={`text-center px-3 overflow-hidden transition-opacity duration-300 ${
                        showMessageText ? 'opacity-100' : 'opacity-0'
                      }`}>
                        <div 
                          className="text-white font-medium leading-tight"
                          style={{ 
                            fontSize: getMessageFontSize(currentMessage.text, 'tablet'),
                            lineHeight: '1.3',
                            wordBreak: 'normal',
                            overflowWrap: 'normal',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {currentMessage.text.split('\n').map((line, index) => (
                            <div key={index} style={{ fontSize: index === 0 ? '1.5em' : '1em' }}>
                              {line || '\u00A0'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrolling Messages Bar at Bottom - Fixed Height */}
            {(eventSettings as any).show_scrolling_bar !== false && (
              <div className="bg-black/50 backdrop-blur-sm rounded-xl p-2 overflow-hidden flex-shrink-0 h-12 mt-3">
                <div className="flex items-center h-full">
                  <div className="text-base mr-2">📢</div>
                  <div className="flex-1 overflow-hidden">
                      {displayContent && (
                        <div 
                          className={`whitespace-nowrap text-sm font-medium ${messageTextColor}`}
                          style={{
                            animation: `marquee ${dynamicDuration}s linear infinite`
                          }}
                        >
                          {displayContent}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <StatusDots />
        </div>
      );
    } else {
      // Tablet Portrait - Simplified layout
    return (
        <div className="h-screen text-white p-4 overflow-hidden" style={gradientStyle}>
          <div className="max-w-2xl mx-auto h-full flex flex-col">
            <div className="text-center py-3 flex-shrink-0">
              <h1 className="text-2xl font-bold mb-1">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
                <p className="text-sm text-[#1ed760]">DJ {eventSettings.dj_name}</p>
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
                  <p className="text-base text-gray-300 mb-3">
                    {currentTrack.artists && currentTrack.artists.length > 0 
                      ? currentTrack.artists.filter(a => a).join(', ') 
                      : 'Unknown Artist'}
                  </p>
                  
                  </div>
                ) : (
                  <div className="text-center text-gray-400">No song playing</div>
                )}
              </div>

              {/* Up Next */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex-1 min-h-0 overflow-hidden mb-4 relative">
              <h2 className="text-xl font-semibold mb-3">🎶 Up Next</h2>
              {upcomingSongs.length > 0 ? (
                <>
                <div className="space-y-2 overflow-y-auto h-full scrollbar-hide">
                  {upcomingSongs.map((song, index) => (
                    <div 
                      key={`${song.uri || 'unknown'}-${index}`} 
                      className={`flex items-center justify-between p-3 bg-white/5 rounded-lg transition-all duration-1000 ${
                        animatingCards.has(song.uri) 
                          ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                          : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{song.name}</div>
                        <div className="text-sm text-gray-300 truncate">
                          {song.artists && song.artists.length > 0 ? song.artists.filter(a => a).join(', ') : 'Unknown Artist'}
                        </div>
                      </div>
                      {song.requester_nickname && (
                        <div className="flex-shrink-0 ml-3">
                          <div className="bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-white px-3 py-1 rounded-full text-sm font-bold">
                            {sanitizeName(song.requester_nickname)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-center">No upcoming songs in queue</p>
                </div>
              )}
            </div>

            {/* Scrolling Messages Bar at Bottom */}
            {(eventSettings as any).show_scrolling_bar !== false && (
              <div className="bg-black/50 backdrop-blur-sm rounded-xl p-3 overflow-hidden flex-shrink-0 h-14 mt-4">
                <div className="flex items-center h-full">
                  <div className="text-lg mr-3">📢</div>
                  <div className="flex-1 overflow-hidden">
                    {displayContent && (
                      <div 
                        className={`whitespace-nowrap text-base font-medium ${messageTextColor}`}
                        style={{
                          animation: `marquee ${dynamicDuration}s linear infinite`
                        }}
                      >
                        {displayContent}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
      <div className="h-screen text-white p-2 overflow-hidden" style={gradientStyle}>
        <div className="max-w-5xl mx-auto h-full flex flex-col">
          {/* Header - Fixed Height */}
          <div className="text-center py-1 flex-shrink-0">
            <h1 className="text-lg font-bold mb-1">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
              <p className="text-xs text-[#1ed760]">DJ {eventSettings.dj_name}</p>
            )}
            {eventSettings.venue_info && (
              <p className="text-xs text-gray-300">{eventSettings.venue_info}</p>
            )}
          </div>

          {/* Main Content Area - Dynamic Height */}
          <div 
            className="flex-1 min-h-0 mb-2"
            style={{
              display: 'grid',
              gridTemplateColumns: isMessageVisible ? '0.5fr 0.5fr 1fr 1fr 0.5fr 0.5fr' : '1fr 1fr 1fr 1fr 0fr 0fr',
              gridTemplateRows: isVerticalExpanded ? '4fr 2fr' : '3fr 3fr',
              gap: '0.5rem',
              marginRight: isMessageVisible ? '0' : '-1rem',
              transition: 'grid-template-columns 1s ease-in-out, grid-template-rows 1s ease-in-out, margin-right 1s ease-in-out'
            }}
          >
            {/* Now Playing */}
            <div 
              className="bg-black/30 backdrop-blur-sm rounded-lg p-2 flex flex-col justify-center min-w-0"
              style={{
                gridColumn: '1 / span 2',
                gridRow: '1'
              }}
            >
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
                    <p className="text-xs text-gray-300 mb-1">
                      {currentTrack.artists && currentTrack.artists.length > 0 
                        ? currentTrack.artists.filter(a => a).join(', ') 
                        : 'Unknown Artist'}
                    </p>
                    <p className="text-xs text-gray-400">{currentTrack.album || 'Unknown Album'}</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 text-xs">
                    No song currently playing
                  </div>
                  )}
                </div>

            {/* QR Code */}
            {eventSettings.show_qr_code && qrCodeUrl && (
              <div 
                className="bg-white rounded-lg p-2 text-center flex flex-col justify-center items-center min-w-0"
                style={{
                  gridColumn: '1 / span 2',
                  gridRow: '2'
                }}
              >
                <img src={qrCodeUrl} alt="QR Code" className="w-full h-auto max-w-[120px] mb-1" style={{ aspectRatio: '1/1' }} />
                <p className="text-black text-xs font-semibold">Request now!</p>
              </div>
            )}

            {/* Up Next */}
            <div 
              className="flex flex-col min-h-0 min-w-0"
              style={{
                gridColumn: '3 / span 2',
                gridRow: '1 / span 2'
              }}
            >
              {upcomingSongs.length > 0 ? (
                <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 h-full relative">
                  <h2 className="text-sm font-semibold mb-2 text-center">🎶 Up Next</h2>
                  <div className="space-y-1 overflow-y-auto h-full scrollbar-hide">
                    {upcomingSongs.map((song, index) => (
                      <div 
                        key={`${song.uri || 'unknown'}-${index}`} 
                        className={`flex items-center justify-between p-1 bg-white/5 rounded transition-all duration-1000 ${
                          animatingCards.has(song.uri) 
                            ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                            : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-xs">{song.name}</div>
                          <div className="text-xs text-gray-300 truncate">
                            {song.artists && song.artists.length > 0 ? song.artists.filter(a => a).join(', ') : 'Unknown Artist'}
                          </div>
                        </div>
                        {song.requester_nickname && (
                          <div className="flex-shrink-0 ml-1">
                            <div className="bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-white px-1 py-0.5 rounded-full text-xs font-bold">
                              {sanitizeName(song.requester_nickname)}
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

            {/* Messages Section (Notice Board) */}
            <div 
              className="min-w-0"
              style={{
                gridColumn: '5 / span 2',
                gridRow: '1 / span 2',
                width: isMessageVisible ? 'auto' : '0',
                minWidth: isMessageVisible ? 'auto' : '0',
                overflow: 'hidden',
                padding: isMessageVisible ? '0' : '0',
                margin: isMessageVisible ? '0' : '0',
                opacity: isMessageVisible ? 1 : 0,
                transition: 'width 1s ease-in-out, min-width 1s ease-in-out, opacity 1s ease-in-out'
              }}
            >
              <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 h-full flex flex-col" style={{ minWidth: '100px' }}>
                <div className="flex-1 flex items-center justify-center">
                  {currentMessage && (
                    <div className={`text-center px-2 overflow-hidden transition-opacity duration-300 ${
                      showMessageText ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <div 
                        className="text-white font-medium leading-tight"
                        style={{ 
                          fontSize: getMessageFontSize(currentMessage.text, 'mobile'),
                          lineHeight: '1.3',
                          wordBreak: 'normal',
                          overflowWrap: 'normal',
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {currentMessage.text.split('\n').map((line, index) => (
                          <div key={index} style={{ fontSize: index === 0 ? '2em' : '1em' }}>
                            {line || '\u00A0'}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scrolling Messages Bar at Bottom - Fixed Height */}
          {(eventSettings as any).show_scrolling_bar !== false && (
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1 overflow-hidden flex-shrink-0 h-8 mt-2">
              <div className="flex items-center h-full">
                <div className="text-xs mr-1">📢</div>
                <div className="flex-1 overflow-hidden">
                  {displayContent && (
                    <div className={`animate-marquee whitespace-nowrap text-xs font-medium ${messageTextColor}`}>
                      {displayContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <StatusDots />
      </div>
    );
  } else {
    // Mobile Portrait - Simplified layout
    return (
      <div className="h-screen text-white p-3 overflow-hidden" style={gradientStyle}>
        <div className="max-w-sm mx-auto h-full flex flex-col">
          <div className="text-center flex-shrink-0 mb-3">
            <h1 className="text-xl font-bold mb-1">{eventSettings.event_title}</h1>
          {eventSettings.dj_name && (
              <p className="text-xs text-[#1ed760]">DJ {eventSettings.dj_name}</p>
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
              <p className="text-sm text-gray-300 mb-3">
                {currentTrack.artists && currentTrack.artists.length > 0 
                  ? currentTrack.artists.filter(a => a).join(', ') 
                  : 'Unknown Artist'}
              </p>
              
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm">No song playing</div>
          )}
        </div>

          {/* Up Next */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-3 flex-1 min-h-0 overflow-hidden mb-3 relative">
            <h2 className="text-base font-semibold mb-2">🎶 Up Next</h2>
            {upcomingSongs.length > 0 ? (
              <>
              <div className="space-y-2 overflow-y-auto h-full scrollbar-hide">
                {upcomingSongs.map((song, index) => (
                  <div 
                    key={`${song.uri || 'unknown'}-${index}`} 
                    className={`flex items-center justify-between p-2 bg-white/5 rounded text-xs transition-all duration-1000 ${
                      animatingCards.has(song.uri) 
                        ? 'bg-green-500/20 border border-green-400/50 shadow-lg shadow-green-400/25' 
                        : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{song.name}</div>
                      <div className="text-gray-300 truncate">
                        {song.artists && song.artists.length > 0 ? song.artists.filter(a => a).join(', ') : 'Unknown Artist'}
                      </div>
                    </div>
                    {song.requester_nickname && (
                      <div className="flex-shrink-0 ml-2">
                        <div className="bg-gradient-to-r from-[#1DB954] to-[#1ed760] text-white px-2 py-1 rounded-full text-xs font-bold">
                          {sanitizeName(song.requester_nickname)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
            </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-center text-sm">No upcoming songs in queue</p>
          </div>
        )}
          </div>

          {/* Scrolling Messages Bar at Bottom */}
          {(eventSettings as any).show_scrolling_bar !== false && (
            <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 overflow-hidden flex-shrink-0 h-12 mt-3">
              <div className="flex items-center h-full">
                <div className="text-sm mr-2">📢</div>
                <div className="flex-1 overflow-hidden">
                  {displayContent && (
                    <div className={`animate-marquee whitespace-nowrap text-xs font-medium ${messageTextColor}`}>
                      {displayContent}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
      <StatusDots />
    </div>
  );
  }
}
