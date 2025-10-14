'use client';

import { useEffect, useState, useRef } from 'react';
import { createPusherClient, EVENTS, RequestApprovedEvent, RequestRejectedEvent, RequestSubmittedEvent, RequestDeletedEvent, getUserChannel, getAdminChannel } from '@/lib/pusher';
import type { Channel } from 'pusher-js';

interface UsePusherOptions {
  username?: string; // Optional username for public pages (display/request pages)
  onRequestApproved?: (data: RequestApprovedEvent) => void;
  onRequestRejected?: (data: RequestRejectedEvent) => void;
  onRequestSubmitted?: (data: RequestSubmittedEvent) => void;
  onRequestDeleted?: (data: RequestDeletedEvent) => void;
  onPlaybackUpdate?: (data: any) => void;
  onStatsUpdate?: (data: any) => void;
  onPageControlToggle?: (data: any) => void;
  onMessageUpdate?: (data: any) => void;
  onMessageCleared?: (data: any) => void;
  onTokenExpired?: (data: any) => void;
  onAdminLogin?: (data: any) => void;
  onAdminLogout?: (data: any) => void;
  onSettingsUpdate?: (data: any) => void;
  onForceLogout?: (data: any) => void;
  onRequestsCleanup?: (data: any) => void;
}

export const usePusher = (options: UsePusherOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [userId, setUserId] = useState<string | null>(null);
  const pusherRef = useRef<any>(null);
  const userChannelRef = useRef<Channel | null>(null);
  const adminChannelRef = useRef<Channel | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options.onRequestApproved, options.onRequestRejected, options.onRequestSubmitted, options.onRequestDeleted, options.onPlaybackUpdate, options.onStatsUpdate, options.onPageControlToggle, options.onMessageUpdate, options.onMessageCleared, options.onTokenExpired, options.onAdminLogin, options.onAdminLogout, options.onSettingsUpdate, options.onForceLogout, options.onRequestsCleanup, options.username]);

  // Fetch userId from session OR from username lookup for public pages
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        // If username is provided (public pages like display), ALWAYS use username lookup
        // This ensures multi-tenant isolation even when admin is logged in
        if (options.username) {
          console.log('🌐 usePusher: Public page detected, looking up userId for username:', options.username);
          const lookupResponse = await fetch(`/api/users/lookup?username=${options.username}`);
          if (lookupResponse.ok) {
            const data = await lookupResponse.json();
            console.log('🌐 usePusher: Got userId from username lookup:', data.userId);
            setUserId(data.userId);
            return;
          }
          console.warn('⚠️ usePusher: Username lookup failed for:', options.username);
        }

        // For admin pages (no username), use authenticated session
        const authResponse = await fetch('/api/auth/me');
        if (authResponse.ok) {
          const data = await authResponse.json();
          console.log('🔐 usePusher: Got userId from session:', data.user.id);
          setUserId(data.user.id);
          return;
        }

        console.warn('⚠️ usePusher: Could not get userId from session or username');
      } catch (error) {
        console.error('❌ usePusher: Failed to get userId:', error);
      }
    };
    fetchUserId();
  }, [options.username]);

  useEffect(() => {
    if (!userId) {
      console.log('⏳ usePusher: Waiting for userId before setting up Pusher...');
      return;
    }

    console.log('🚀 usePusher: Setting up Pusher for userId:', userId);

    // Create Pusher client
    const pusher = createPusherClient();
    pusherRef.current = pusher;

    // Connection state listeners
    pusher.connection.bind('connecting', () => {
      console.log('🔄 Pusher connecting...');
      setConnectionState('connecting');
      setIsConnected(false);
    });

    pusher.connection.bind('connected', () => {
      console.log('✅ Pusher connected!');
      setConnectionState('connected');
      setIsConnected(true);
    });

    pusher.connection.bind('disconnected', () => {
      console.log('❌ Pusher disconnected');
      setConnectionState('disconnected');
      setIsConnected(false);
    });

    pusher.connection.bind('failed', () => {
      console.log('💥 Pusher connection failed');
      setConnectionState('failed');
      setIsConnected(false);
    });

    // Subscribe to USER-SPECIFIC channel
    const userChannel = getUserChannel(userId);
    console.log(`📡 usePusher: Subscribing to user channel: ${userChannel}`);
    const channel = pusher.subscribe(userChannel);
    userChannelRef.current = channel;

    // Bind event listeners using stable references
    channel.bind(EVENTS.REQUEST_APPROVED, (data: RequestApprovedEvent) => {
      console.log('🎉 Pusher: Request approved!', data);
      if (optionsRef.current.onRequestApproved) {
        optionsRef.current.onRequestApproved(data);
      }
    });

    channel.bind(EVENTS.REQUEST_REJECTED, (data: RequestRejectedEvent) => {
      console.log('❌ Pusher: Request rejected', data);
      if (optionsRef.current.onRequestRejected) {
        optionsRef.current.onRequestRejected(data);
      }
    });

    channel.bind(EVENTS.REQUEST_SUBMITTED, (data: RequestSubmittedEvent) => {
      console.log('📝 Pusher: New request submitted!', data);
      if (optionsRef.current.onRequestSubmitted) {
        optionsRef.current.onRequestSubmitted(data);
      }
    });

    channel.bind(EVENTS.REQUEST_DELETED, (data: RequestDeletedEvent) => {
      console.log('🗑️ Pusher: Request deleted!', data);
      if (optionsRef.current.onRequestDeleted) {
        optionsRef.current.onRequestDeleted(data);
      }
    });

    channel.bind(EVENTS.PLAYBACK_UPDATE, (data: any) => {
      console.log('🎵 Pusher: Playback update', data);
      if (optionsRef.current.onPlaybackUpdate) {
        optionsRef.current.onPlaybackUpdate(data);
      }
    });

    channel.bind(EVENTS.PAGE_CONTROL_TOGGLE, (data: any) => {
      console.log('🎛️ Pusher: Page control toggle', data);
      if (optionsRef.current.onPageControlToggle) {
        optionsRef.current.onPageControlToggle(data);
      }
    });

    channel.bind('message-update', (data: any) => {
      console.log('💬 Pusher: Message update', data);
      if (optionsRef.current.onMessageUpdate) {
        optionsRef.current.onMessageUpdate(data);
      }
    });

    channel.bind('message-cleared', (data: any) => {
      console.log('💬 Pusher: Message cleared', data);
      if (optionsRef.current.onMessageCleared) {
        optionsRef.current.onMessageCleared(data);
      }
    });

    channel.bind('settings-update', (data: any) => {
      console.log('⚙️ Pusher: Settings update', data);
      if (optionsRef.current.onSettingsUpdate) {
        optionsRef.current.onSettingsUpdate(data);
      }
    });

    // Subscribe to ADMIN-SPECIFIC channel for stats
    const adminChannel = getAdminChannel(userId);
    console.log(`📡 usePusher: Subscribing to admin channel: ${adminChannel}`);
    const adminChan = pusher.subscribe(adminChannel);
    adminChannelRef.current = adminChan;

    adminChan.bind(EVENTS.STATS_UPDATE, (data: any) => {
      console.log('📊 Pusher: Stats update', data);
      if (optionsRef.current.onStatsUpdate) {
        optionsRef.current.onStatsUpdate(data);
      }
    });

    adminChan.bind(EVENTS.TOKEN_EXPIRED, (data: any) => {
      console.log('🔒 Pusher: Token expired', data);
      if (optionsRef.current.onTokenExpired) {
        optionsRef.current.onTokenExpired(data);
      }
    });

    adminChan.bind(EVENTS.ADMIN_LOGIN, (data: any) => {
      console.log('🔐 Pusher: Admin login', data);
      if (optionsRef.current.onAdminLogin) {
        optionsRef.current.onAdminLogin(data);
      }
    });

    adminChan.bind(EVENTS.ADMIN_LOGOUT, (data: any) => {
      console.log('🔐 Pusher: Admin logout', data);
      if (optionsRef.current.onAdminLogout) {
        optionsRef.current.onAdminLogout(data);
      }
    });

    adminChan.bind(EVENTS.FORCE_LOGOUT, (data: any) => {
      console.log('⚠️ Pusher: Force logout', data);
      if (optionsRef.current.onForceLogout) {
        optionsRef.current.onForceLogout(data);
      }
    });

    adminChan.bind(EVENTS.REQUESTS_CLEANUP, (data: any) => {
      console.log('🧹 Pusher: Requests cleanup', data);
      if (optionsRef.current.onRequestsCleanup) {
        optionsRef.current.onRequestsCleanup(data);
      }
    });

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up Pusher connection for userId:', userId);
      if (userChannelRef.current) {
        pusher.unsubscribe(userChannel);
      }
      if (adminChannelRef.current) {
        pusher.unsubscribe(adminChannel);
      }
      pusher.disconnect();
    };
  }, [userId]); // Re-run when userId changes

  return {
    isConnected,
    connectionState,
    pusher: pusherRef.current,
    userChannel: userChannelRef.current,
    adminChannel: adminChannelRef.current,
  };
};
