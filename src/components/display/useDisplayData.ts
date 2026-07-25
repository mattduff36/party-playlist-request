'use client';

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import { usePusher } from '@/hooks/usePusher';
import { useLiveProgress } from '@/hooks/useLiveProgress';
import { RequestApprovedEvent } from '@/lib/pusher';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { EventConfig } from '@/lib/db/schema';
import { sanitizeRequesterNameForDisplay } from '@/lib/profanity-filter';
import {
  DISPLAY_MOODS,
  fallbackDisplayMoodSettings,
  hasConfirmedDisplayMood,
  moodCssVariables,
  qrModuleColors,
  resolveDisplayMood,
} from '@/styles/theme';

/** Max wait for display-data / event-config before applying default mood. */
const MOOD_CONFIRM_TIMEOUT_MS = 8000;
import type {
  CurrentTrack,
  DisplayDeviceType,
  DisplayMessage,
  Notification,
  QueueItem,
  RequestItem,
} from './types';

interface UseDisplayDataOptions {
  username: string;
  /** Guest access code from URL — required for gated public APIs */
  accessCode?: string;
}

function withAccessCode(url: string, accessCode?: string): string {
  if (!accessCode) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}accessCode=${encodeURIComponent(accessCode)}`;
}

export function useDisplayData({ username, accessCode }: UseDisplayDataOptions) {
  const [guestAccessCode, setGuestAccessCode] = useState<string | undefined>(accessCode);
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [upcomingSongs, setUpcomingSongs] = useState<QueueItem[]>([]);
  const [eventSettings, setEventSettings] = useState<EventConfig | null>(null);
  /** Gates themed UI until server mood is applied (avoids default `dj` flash). */
  const [moodConfirmed, setMoodConfirmed] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [deviceType, setDeviceType] = useState<DisplayDeviceType>('tv');

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
  const [currentMessage, setCurrentMessage] = useState<DisplayMessage | null>(null);

  // Animation state for notice board
  const [isMessageVisible, setIsMessageVisible] = useState(false); // Controls horizontal (columns)
  const [isVerticalExpanded, setIsVerticalExpanded] = useState(false); // Controls vertical (rows)
  const [showMessageText, setShowMessageText] = useState(false);

  // 🖼️ Delayed state for layout switching - waits for grid animation to complete
  // This ensures Now Playing and QR Code stay in portrait mode until the grid finishes animating back
  const [shouldUsePortraitLayout, setShouldUsePortraitLayout] = useState(false);

  // Force portrait/vertical layout when notice board message is visible OR during collapse animation
  const finalUseHorizontalLayout = shouldUsePortraitLayout ? false : useHorizontalLayout;

  // Handle notice board animation when message changes - two-phase approach
  useEffect(() => {
    if (currentMessage) {
      console.log(
        '🎬 Starting notice board animation for message:',
        currentMessage.text.substring(0, 50) + '...'
      );

      // Set animation flag to prevent layout changes during animation
      isAnimatingRef.current = true;

      // 🖼️ Immediately switch to portrait layout when message starts appearing
      setShouldUsePortraitLayout(true);

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

        // 🖼️ Phase 3: After grid animation completes (1s), switch back to landscape
        setTimeout(() => {
          console.log('🖼️ Grid animation complete, switching back to landscape layout');
          setShouldUsePortraitLayout(false);

          // Clear animation flag
          isAnimatingRef.current = false;
          console.log('🎬 Collapse animation complete, layout changes re-enabled');
        }, 1000); // Wait for 1s grid animation to complete
      }, 1000);

      return () => {
        clearTimeout(collapseTimer);
        isAnimatingRef.current = false;
      };
    }
  }, [currentMessage]);

  const applyEventSettings = useCallback((settings: EventConfig | null | undefined) => {
    if (!settings) return;
    setEventSettings(settings);
    if (hasConfirmedDisplayMood(settings)) {
      setMoodConfirmed(true);
    }
  }, []);

  /** After confirmation failure/timeout — DJ Tool default, never leave the loader stuck. */
  const applyMoodFallback = useCallback(() => {
    setEventSettings((prev) => {
      if (prev && hasConfirmedDisplayMood(prev)) return prev;
      return {
        ...(prev || {}),
        ...fallbackDisplayMoodSettings(),
      } as EventConfig;
    });
    setMoodConfirmed(true);
  }, []);

  // Fetch all display data - moved outside useEffect to be accessible from Pusher handlers
  const fetchDisplayData = useCallback(async () => {
    try {
      const response = await fetch(
        withAccessCode(`/api/public/display-data?username=${username}`, accessCode || guestAccessCode),
        {
          signal: AbortSignal.timeout(MOOD_CONFIRM_TIMEOUT_MS),
          credentials: 'include',
        }
      );
      if (response.ok) {
        const data = await response.json();
        applyEventSettings(data.event_settings);
        if (data.event_settings?.access_code) {
          setGuestAccessCode(data.event_settings.access_code);
        }
        setCurrentTrack(data.current_track);
        setUpcomingSongs(data.upcoming_songs || []);
        return;
      }

      // Fallback: event-config carries the same display_mood as admin settings
      const configResponse = await fetch(`/api/public/event-config?username=${username}`, {
        signal: AbortSignal.timeout(MOOD_CONFIRM_TIMEOUT_MS),
      });
      if (configResponse.ok) {
        const configData = await configResponse.json();
        if (configData.config && hasConfirmedDisplayMood(configData.config)) {
          applyEventSettings(configData.config);
        }
      }
    } catch (error) {
      console.error('Error fetching display data:', error);
      // Mood gate fallback is handled by the initial-load path / timeout
    }
  }, [username, accessCode, guestAccessCode, applyEventSettings]);

  // 🚀 PUSHER: Real-time updates with animation triggers
  // Note: original page had a duplicate onSettingsUpdate key; the settings-refresh
  // handler below is the one that actually applies (object-literal last-write-wins).
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
    onRequestApproved: (data: RequestApprovedEvent) => {
      console.log('🎉 PUSHER: Request approved!', data);

      // Add to approved requests list immediately for the "Requests on the way" section
      const newRequest: RequestItem = {
        id: data.id,
        track_name: data.track_name,
        artist_name: data.artist_name,
        requester_nickname: data.requester_nickname,
        created_at: new Date().toISOString(),
      };
      setApprovedRequests((prev) => [newRequest, ...prev].slice(0, 10)); // Keep only latest 10

      // Trigger animation immediately
      setAnimatingCards((prev) => new Set([...prev, data.track_uri]));
      console.log(`🎉 ANIMATION TRIGGERED! New song: ${data.track_name} by ${data.requester_nickname}`);

      // Remove animation after 1 second
      setTimeout(() => {
        setAnimatingCards((prev) => {
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
            ? data.current_track.artists.map((a: any) => (typeof a === 'string' ? a : a.name))
            : [],
          album: data.current_track.album?.name || '',
          duration_ms: data.current_track.duration_ms || 0,
          progress_ms: data.progress_ms || 0,
          uri: data.current_track.uri || '',
          image_url: data.current_track.album?.images?.[0]?.url,
        };

        // Check if this track was in approved requests and move it to recently played
        setApprovedRequests((prev) => {
          const matchingRequest = prev.find(
            (req) =>
              req.track_name === newTrack.name && req.artist_name === newTrack.artists.join(', ')
          );

          if (matchingRequest) {
            // Move to recently played
            setRecentlyPlayedRequests((prevPlayed) =>
              [matchingRequest, ...prevPlayed].slice(0, 10)
            );
            // Remove from approved
            return prev.filter((req) => req.id !== matchingRequest.id);
          }

          return prev;
        });

        // Force state update by creating new object reference
        setCurrentTrack({ ...newTrack });
        console.log('✅ Current track state updated:', newTrack.name);
      }

      // Update queue - show all songs with hidden scrollbar and fade-out gradient
      if (data.queue) {
        console.log('🎵 PUSHER: Updating queue with', data.queue.length, 'tracks');

        const processedQueue = data.queue.map((track: any) => ({
          name: track.name || '',
          artists: Array.isArray(track.artists)
            ? track.artists.map((a: any) => (typeof a === 'string' ? a : a.name))
            : [],
          album: track.album?.name || track.album || '',
          uri: track.uri || '',
          image_url: track.image_url || undefined,
          requester_nickname: track.requester_nickname,
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
        created_at: data.message_created_at,
      };

      console.log('✅ Setting current message:', {
        text: messageData.text.substring(0, 50) + '...',
        duration: messageData.duration,
        created_at: messageData.created_at,
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
        applyEventSettings(data.settings);
        console.log('✅ Event settings refreshed from Pusher');
      }
    },
  });

  // Live progress for smooth animation
  const playbackState = currentTrack
    ? {
        progress_ms: currentTrack.progress_ms,
        duration_ms: currentTrack.duration_ms,
        is_playing: true, // Assume playing if we have a current track
        spotify_connected: true,
      }
    : null;

  const liveProgress = useLiveProgress(playbackState, 1000);

  // Callback ref for Now Playing section - sets up ResizeObserver to detect layout changes
  // This is now reactive to isMessageVisible changes (notice board appearing/disappearing)
  const nowPlayingRef = useCallback(
    (element: HTMLDivElement | null) => {
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
              console.log(
                `📐 Now Playing dimensions: ${Math.round(width)}x${Math.round(height)}, ratio: ${(width / height).toFixed(2)}, threshold: ${horizontalThreshold}, horizontal: ${shouldBeHorizontal}`
              );

              // Clear any existing timeout
              if (layoutChangeTimeoutRef.current) {
                clearTimeout(layoutChangeTimeoutRef.current);
              }

              // Debounce layout changes to prevent rapid switching
              layoutChangeTimeoutRef.current = setTimeout(() => {
                // Double-check we're still not animating and dimensions haven't changed significantly
                if (!isAnimatingRef.current) {
                  console.log(
                    `📐 Applying layout change: ${shouldBeHorizontal ? 'horizontal' : 'vertical'}`
                  );
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
    },
    [deviceType, isMessageVisible]
  ); // Re-observe when notice board state changes

  // 🔄 Initial data load only (Pusher handles real-time updates)
  useEffect(() => {
    setMoodConfirmed(false);
    setEventSettings(null);

    let cancelled = false;
    let moodConfirmedLocal = false;

    const markMoodConfirmed = () => {
      moodConfirmedLocal = true;
      clearTimeout(moodFallbackTimer);
    };

    // Safety net: if APIs hang or never confirm mood, render with default theme
    const moodFallbackTimer = setTimeout(() => {
      if (cancelled || moodConfirmedLocal) return;
      console.warn(
        `🎨 Mood confirmation timed out after ${MOOD_CONFIRM_TIMEOUT_MS}ms — using default theme`
      );
      applyMoodFallback();
      moodConfirmedLocal = true;
    }, MOOD_CONFIRM_TIMEOUT_MS);

    const fetchInitialData = async () => {
      try {
        const displayResponse = await fetch(
          withAccessCode(
            `/api/public/display-data?username=${username}`,
            accessCode || guestAccessCode
          ),
          {
            signal: AbortSignal.timeout(MOOD_CONFIRM_TIMEOUT_MS),
            credentials: 'include',
          }
        );

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
              image_url: data.current_track.image_url,
            });
          }

          // Initialize event settings (must include display_mood for cold-load theme)
          if (data.event_settings) {
            applyEventSettings(data.event_settings);
            if (data.event_settings.access_code) {
              setGuestAccessCode(data.event_settings.access_code);
            }
            if (hasConfirmedDisplayMood(data.event_settings)) {
              markMoodConfirmed();
            }
          }

          // Initialize upcoming songs
          if (data.upcoming_songs) {
            console.log('📱 Initial load: Loading', data.upcoming_songs.length, 'upcoming songs');
            setUpcomingSongs(data.upcoming_songs);
          }
        }

        // Fetch requests for "Requests on the way" section
        const requestsResponse = await fetch(
          withAccessCode(
            `/api/public/requests?username=${username}`,
            accessCode || guestAccessCode
          ),
          {
            credentials: 'include',
          }
        );
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          // Use the requests directly - they're already approved/pending
          setApprovedRequests(
            (requestsData.requests || []).filter((r: any) => r.status === 'approved')
          );
        }

        // Notice board + mood from event-config (same user_settings source as admin)
        const messageResponse = await fetch(`/api/public/event-config?username=${username}`, {
          signal: AbortSignal.timeout(MOOD_CONFIRM_TIMEOUT_MS),
        });
        if (messageResponse.ok) {
          const messageData = await messageResponse.json();
          if (messageData.message_text && !messageData.expired) {
            setCurrentMessage({
              text: messageData.message_text,
              duration: messageData.message_duration,
              created_at: messageData.message_created_at,
            });
          }
          // Mood from event-config if display-data omitted display_mood (or failed)
          if (messageData.config && hasConfirmedDisplayMood(messageData.config)) {
            setEventSettings((prev) => {
              if (prev && hasConfirmedDisplayMood(prev)) {
                // Keep display-data fields; only fill mood if somehow still missing
                return prev;
              }
              return {
                ...(prev || {}),
                ...messageData.config,
              } as EventConfig;
            });
            setMoodConfirmed(true);
            markMoodConfirmed();
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial display data:', error);
      }

      // Both APIs exhausted without a confirmed mood — proceed with DJ Tool default
      if (!cancelled && !moodConfirmedLocal) {
        console.warn('🎨 Mood confirmation failed — using default theme');
        applyMoodFallback();
        markMoodConfirmed();
      }
    };

    // One-time initial fetch only - Pusher handles all updates after this!
    fetchInitialData();

    return () => {
      cancelled = true;
      clearTimeout(moodFallbackTimer);
    };
  }, [username, applyEventSettings, applyMoodFallback]);

  // Detect device type and re-limit songs when device changes
  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      const newDeviceType: DisplayDeviceType =
        width >= 1200 ? 'tv' : width >= 768 ? 'tablet' : 'mobile';

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
    const expiresAt = new Date(adjustedCreatedAt.getTime() + currentMessage.duration * 1000);

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

    console.log(
      `💬 Message timing: animation ends in ${Math.round(animationDuration / 1000)}s, expires in ${Math.round(finalTimeUntilExpiry / 1000)}s`
    );

    const timeoutId = setTimeout(() => {
      console.log('💬 Message expired after full display time, clearing...');
      setCurrentMessage(null);
    }, finalTimeUntilExpiry);

    return () => clearTimeout(timeoutId);
  }, [currentMessage]);

  // Generate QR code with access-code URL (no manual code entry for scanners)
  useEffect(() => {
    const generateQR = async () => {
      try {
        const code =
          (eventSettings as { access_code?: string } | null)?.access_code ||
          guestAccessCode ||
          accessCode ||
          '';
        const requestUrl = code
          ? `${window.location.origin}/${username}/${code}/request`
          : `${window.location.origin}/${username}/request`;

        console.log(
          code
            ? '📱 QR Code generated with access-code URL'
            : '⚠️ QR Code generated without access code'
        );

        const mood = resolveDisplayMood(
          eventSettings?.display_mood,
          eventSettings?.theme_primary_color
        );
        const qrColors = qrModuleColors(mood);

        const url = await QRCode.toDataURL(requestUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: qrColors.dark,
            light: qrColors.light,
          },
        });
        setQrCodeUrl(url);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, [
    username,
    (eventSettings as { access_code?: string } | null)?.access_code,
    guestAccessCode,
    accessCode,
    eventSettings?.display_mood,
    eventSettings?.theme_primary_color,
  ]);

  // Fetch all display data
  useEffect(() => {
    if (accessCode) {
      setGuestAccessCode(accessCode);
    }
  }, [accessCode]);

  useEffect(() => {
    const fetchNotifications = async () => {
      console.log('📝 Notifications fetching skipped (multi-tenant refactor needed)');
    };

    console.log('🚀 DisplayPage: useEffect running - client-side JS is working!');
    setMounted(true);
    setIsClient(true);
    fetchDisplayData();
    fetchNotifications();
  }, [username, accessCode, fetchDisplayData]);

  // DJ-selected display mood (replaces free-form colour theme)
  const displayMood = resolveDisplayMood(
    eventSettings?.display_mood,
    eventSettings?.theme_primary_color
  );
  const moodTokens = DISPLAY_MOODS[displayMood];
  const gradientStyle = {
    background: `linear-gradient(160deg, ${moodTokens.background} 0%, ${moodTokens.surface} 55%, ${moodTokens.background} 100%)`,
    color: moodTokens.text,
    ...moodCssVariables(displayMood),
  } as CSSProperties;

  // Simple message concatenation for scrolling (no individual message system)
  const messages = eventSettings
    ? [
        eventSettings.welcome_message,
        eventSettings.secondary_message,
        eventSettings.tertiary_message,
      ].filter((msg) => msg && msg.trim() !== '')
    : [];

  const messagesText =
    messages.length > 0
      ? messages.join('                               ')
      : '';
  const displayContent = messagesText;

  // Calculate animation duration based on total character count
  const baseDuration = 30; // Base duration in seconds (doubled from 15)
  const characterMultiplier = 0.1; // 0.1 seconds per character (doubled from 0.05)
  const totalCharacters = messagesText.length;
  const dynamicDuration = Math.max(baseDuration, totalCharacters * characterMultiplier) + 4; // Add 4 second buffer

  const messageTextColor = 'text-[color:var(--mood-text)]';

  // Connection status for display dots
  const spotifyConnected = !!currentTrack;

  return {
    currentTrack,
    upcomingSongs,
    eventSettings,
    guestAccessCode,
    moodConfirmed,
    qrCodeUrl,
    deviceType,
    currentNotification,
    showingNotification,
    animatingCards,
    mounted,
    isClient,
    approvedRequests,
    recentlyPlayedRequests,
    globalState,
    sanitizeName,
    currentMessage,
    isMessageVisible,
    isVerticalExpanded,
    showMessageText,
    finalUseHorizontalLayout,
    isConnected,
    connectionState,
    liveProgress,
    nowPlayingRef,
    displayMood,
    gradientStyle,
    displayContent,
    dynamicDuration,
    messageTextColor,
    spotifyConnected,
    fetchDisplayData,
  };
}
