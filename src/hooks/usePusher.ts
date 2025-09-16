'use client';

import { useEffect, useState, useRef } from 'react';
import { createPusherClient, CHANNELS, EVENTS, RequestApprovedEvent, RequestRejectedEvent } from '@/lib/pusher';
import type { Channel } from 'pusher-js';

interface UsePusherOptions {
  onRequestApproved?: (data: RequestApprovedEvent) => void;
  onRequestRejected?: (data: RequestRejectedEvent) => void;
  onPlaybackUpdate?: (data: any) => void;
  onStatsUpdate?: (data: any) => void;
}

export const usePusher = (options: UsePusherOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const pusherRef = useRef<any>(null);
  const channelRef = useRef<Channel | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options.onRequestApproved, options.onRequestRejected, options.onPlaybackUpdate, options.onStatsUpdate]);

  useEffect(() => {
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

    // Subscribe to party playlist channel
    const channel = pusher.subscribe(CHANNELS.PARTY_PLAYLIST);
    channelRef.current = channel;

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

    channel.bind(EVENTS.PLAYBACK_UPDATE, (data: any) => {
      console.log('🎵 Pusher: Playback update', data);
      if (optionsRef.current.onPlaybackUpdate) {
        optionsRef.current.onPlaybackUpdate(data);
      }
    });

    // Subscribe to admin updates for stats
    const adminChannel = pusher.subscribe(CHANNELS.ADMIN_UPDATES);
    adminChannel.bind(EVENTS.STATS_UPDATE, (data: any) => {
      console.log('📊 Pusher: Stats update', data);
      if (optionsRef.current.onStatsUpdate) {
        optionsRef.current.onStatsUpdate(data);
      }
    });

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up Pusher connection');
      if (channelRef.current) {
        pusher.unsubscribe(CHANNELS.PARTY_PLAYLIST);
      }
      pusher.unsubscribe(CHANNELS.ADMIN_UPDATES);
      pusher.disconnect();
    };
  }, []); // Empty dependency array - only run once!

  return {
    isConnected,
    connectionState,
    pusher: pusherRef.current,
    channel: channelRef.current,
  };
};
