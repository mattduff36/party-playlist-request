'use client';

import { useEffect, useState, useRef } from 'react';
import {
  createPusherClient,
  EVENTS,
  RequestApprovedEvent,
  RequestRejectedEvent,
  RequestSubmittedEvent,
  RequestDeletedEvent,
  getUserChannel,
  getAdminChannel,
} from '@/lib/pusher/client-shared';
import { getGuestEventChannel } from '@/lib/pusher/channel-contract';
import type { Channel } from 'pusher-js';

interface UsePusherOptions {
  username?: string; // Optional username for public pages (display/request pages)
  eventId?: string; // Preferred for guest realtime (private-event-{id}-guest)
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

type PusherScope =
  | { mode: 'admin'; userId: string }
  | { mode: 'guest'; eventId: string };

export const usePusher = (options: UsePusherOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [scope, setScope] = useState<PusherScope | null>(null);
  const pusherRef = useRef<any>(null);
  const userChannelRef = useRef<Channel | null>(null);
  const adminChannelRef = useRef<Channel | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [
    options.onRequestApproved,
    options.onRequestRejected,
    options.onRequestSubmitted,
    options.onRequestDeleted,
    options.onPlaybackUpdate,
    options.onStatsUpdate,
    options.onPageControlToggle,
    options.onMessageUpdate,
    options.onMessageCleared,
    options.onTokenExpired,
    options.onAdminLogin,
    options.onAdminLogout,
    options.onSettingsUpdate,
    options.onForceLogout,
    options.onRequestsCleanup,
    options.username,
    options.eventId,
  ]);

  useEffect(() => {
    const resolveScope = async () => {
      try {
        // Public pages: event-scoped guest channel (no UUID lookup)
        if (options.username || options.eventId) {
          if (options.eventId) {
            setScope({ mode: 'guest', eventId: options.eventId });
            return;
          }
          const guestResponse = await fetch('/api/events/guest-session', {
            credentials: 'include',
          });
          if (guestResponse.ok) {
            const data = await guestResponse.json();
            if (data.eventId) {
              setScope({ mode: 'guest', eventId: data.eventId });
              return;
            }
          }
          console.warn('⚠️ usePusher: Guest session unavailable for public page');
          setScope(null);
          return;
        }

        const authResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (authResponse.ok) {
          const data = await authResponse.json();
          setScope({ mode: 'admin', userId: data.user.id });
          return;
        }

        console.warn('⚠️ usePusher: Could not resolve Pusher scope');
        setScope(null);
      } catch (error) {
        console.error('❌ usePusher: Failed to resolve scope:', error);
        setScope(null);
      }
    };
    void resolveScope();
  }, [options.username, options.eventId]);

  useEffect(() => {
    if (!scope) {
      console.log('⏳ usePusher: Waiting for scope before setting up Pusher...');
      return;
    }

    const pusher = createPusherClient();
    pusherRef.current = pusher;

    pusher.connection.bind('connecting', () => {
      setConnectionState('connecting');
      setIsConnected(false);
    });

    pusher.connection.bind('connected', () => {
      setConnectionState('connected');
      setIsConnected(true);
    });

    pusher.connection.bind('disconnected', () => {
      setConnectionState('disconnected');
      setIsConnected(false);
    });

    pusher.connection.bind('failed', () => {
      setConnectionState('failed');
      setIsConnected(false);
    });

    const primaryChannelName =
      scope.mode === 'guest'
        ? getGuestEventChannel(scope.eventId)
        : getUserChannel(scope.userId);

    console.log(`📡 usePusher: Subscribing to ${primaryChannelName}`);
    const channel = pusher.subscribe(primaryChannelName);
    userChannelRef.current = channel;

    const bindGuestSafe = () => {
      channel.bind(EVENTS.REQUEST_APPROVED, (data: RequestApprovedEvent) => {
        optionsRef.current.onRequestApproved?.(data);
      });
      channel.bind(EVENTS.REQUEST_REJECTED, (data: RequestRejectedEvent) => {
        optionsRef.current.onRequestRejected?.(data);
      });
      channel.bind(EVENTS.REQUEST_SUBMITTED, (data: RequestSubmittedEvent) => {
        optionsRef.current.onRequestSubmitted?.(data);
      });
      channel.bind(EVENTS.REQUEST_DELETED, (data: RequestDeletedEvent) => {
        optionsRef.current.onRequestDeleted?.(data);
      });
      channel.bind(EVENTS.PLAYBACK_UPDATE, (data: any) => {
        optionsRef.current.onPlaybackUpdate?.(data);
      });
      channel.bind(EVENTS.PAGE_CONTROL_TOGGLE, (data: any) => {
        optionsRef.current.onPageControlToggle?.(data);
      });
      channel.bind('message-update', (data: any) => {
        optionsRef.current.onMessageUpdate?.(data);
      });
      channel.bind('message-cleared', (data: any) => {
        optionsRef.current.onMessageCleared?.(data);
      });
      channel.bind('settings-update', (data: any) => {
        optionsRef.current.onSettingsUpdate?.(data);
      });
      channel.bind(EVENTS.STATE_UPDATE, (data: any) => {
        optionsRef.current.onPageControlToggle?.(data);
      });
      channel.bind(EVENTS.REQUESTS_CLEANUP, (data: any) => {
        optionsRef.current.onRequestsCleanup?.(data);
      });
    };

    bindGuestSafe();

    let adminChannelName: string | null = null;
    if (scope.mode === 'admin') {
      adminChannelName = getAdminChannel(scope.userId);
      const adminChan = pusher.subscribe(adminChannelName);
      adminChannelRef.current = adminChan;

      adminChan.bind(EVENTS.STATS_UPDATE, (data: any) => {
        optionsRef.current.onStatsUpdate?.(data);
      });
      adminChan.bind(EVENTS.TOKEN_EXPIRED, (data: any) => {
        optionsRef.current.onTokenExpired?.(data);
      });
      adminChan.bind(EVENTS.ADMIN_LOGIN, (data: any) => {
        optionsRef.current.onAdminLogin?.(data);
      });
      adminChan.bind(EVENTS.ADMIN_LOGOUT, (data: any) => {
        optionsRef.current.onAdminLogout?.(data);
      });
      adminChan.bind(EVENTS.FORCE_LOGOUT, (data: any) => {
        optionsRef.current.onForceLogout?.(data);
      });
      adminChan.bind(EVENTS.REQUESTS_CLEANUP, (data: any) => {
        optionsRef.current.onRequestsCleanup?.(data);
      });
    }

    return () => {
      if (userChannelRef.current) {
        pusher.unsubscribe(primaryChannelName);
      }
      if (adminChannelRef.current && adminChannelName) {
        pusher.unsubscribe(adminChannelName);
      }
      pusher.disconnect();
    };
  }, [scope]);

  return {
    isConnected,
    connectionState,
    pusher: pusherRef.current,
    userChannel: userChannelRef.current,
    adminChannel: adminChannelRef.current,
  };
};
