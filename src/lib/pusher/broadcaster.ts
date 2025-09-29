/**
 * Event Broadcasting Utilities
 * 
 * This module provides utilities for broadcasting events to the centralized
 * Pusher system with proper error handling and retry logic.
 */

import Pusher from 'pusher';
import { 
  PusherEvent, 
  generateEventId, 
  generateEventVersion,
  getEventChannel 
} from './events';

// Server-side Pusher instance
const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || 'fallback-app-id',
  key: process.env.PUSHER_KEY || 'fallback-key',
  secret: process.env.PUSHER_SECRET || 'fallback-secret',
  cluster: process.env.PUSHER_CLUSTER || 'us2',
  useTLS: true,
});

// Broadcasting configuration
interface BroadcastConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  batchSize: number;
  compressionThreshold: number;
}

const DEFAULT_BROADCAST_CONFIG: BroadcastConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 5000,
  batchSize: 10,
  compressionThreshold: 1024 // 1KB
};

// Event queue for batching
interface QueuedEvent {
  event: PusherEvent;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
}

class EventBroadcaster {
  private config: BroadcastConfig;
  private eventQueue: QueuedEvent[] = [];
  private processingQueue = false;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<BroadcastConfig> = {}) {
    this.config = { ...DEFAULT_BROADCAST_CONFIG, ...config };
  }

  // Broadcast a single event
  async broadcastEvent(event: Omit<PusherEvent, 'id' | 'timestamp' | 'version'>, eventId: string): Promise<void> {
    const fullEvent: PusherEvent = {
      ...event,
      id: generateEventId(),
      timestamp: Date.now(),
      version: generateEventVersion()
    } as PusherEvent;

    return this.broadcastEventInternal(fullEvent, eventId);
  }

  // Broadcast multiple events in batch
  async broadcastEvents(events: Array<Omit<PusherEvent, 'id' | 'timestamp' | 'version'>>, eventId: string): Promise<void> {
    const fullEvents: PusherEvent[] = events.map(event => ({
      ...event,
      id: generateEventId(),
      timestamp: Date.now(),
      version: generateEventVersion()
    } as PusherEvent));

    return this.broadcastEventsInternal(fullEvents, eventId);
  }

  // Internal method to broadcast single event
  private async broadcastEventInternal(event: PusherEvent, eventId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventQueue.push({
        event,
        resolve,
        reject,
        retries: 0
      });

      this.processQueue(eventId);
    });
  }

  // Internal method to broadcast multiple events
  private async broadcastEventsInternal(events: PusherEvent[], eventId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const queuedEvents = events.map(event => ({
        event,
        resolve: () => {},
        reject: () => {},
        retries: 0
      }));

      // Only the last event gets the resolve/reject
      if (queuedEvents.length > 0) {
        queuedEvents[queuedEvents.length - 1].resolve = resolve;
        queuedEvents[queuedEvents.length - 1].reject = reject;
      }

      this.eventQueue.push(...queuedEvents);
      this.processQueue(eventId);
    });
  }

  // Process the event queue
  private processQueue(eventId: string): void {
    if (this.processingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    // Process in batches
    const batch = this.eventQueue.splice(0, this.config.batchSize);
    this.processBatch(batch, eventId);
  }

  // Process a batch of events
  private async processBatch(batch: QueuedEvent[], eventId: string): Promise<void> {
    try {
      const channelName = getEventChannel(eventId);
      
      // Send events individually for better error handling
      const promises = batch.map(queuedEvent => 
        this.sendEvent(queuedEvent.event, channelName, queuedEvent)
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      // Reject all events in the batch
      batch.forEach(queuedEvent => {
        queuedEvent.reject(error);
      });
    } finally {
      this.processingQueue = false;
      
      // Process next batch if there are more events
      if (this.eventQueue.length > 0) {
        setTimeout(() => this.processQueue(eventId), 0);
      }
    }
  }

  // Send individual event
  private async sendEvent(event: PusherEvent, channelName: string, queuedEvent: QueuedEvent): Promise<void> {
    try {
      // Compress large events
      const payload = this.compressEvent(event);
      
      await pusherServer.trigger(channelName, 'event', payload);
      
      console.log(`📡 Event broadcasted: ${event.action}`, event.id);
      queuedEvent.resolve(event);
    } catch (error) {
      console.error(`❌ Failed to broadcast event ${event.action}:`, error);
      
      // Retry logic
      if (queuedEvent.retries < this.config.maxRetries) {
        queuedEvent.retries++;
        console.log(`🔄 Retrying event ${event.action} (attempt ${queuedEvent.retries})`);
        
        setTimeout(() => {
          this.sendEvent(event, channelName, queuedEvent);
        }, this.config.retryDelay * queuedEvent.retries);
      } else {
        console.error(`💥 Max retries reached for event ${event.action}`);
        queuedEvent.reject(error);
      }
    }
  }

  // Compress large events
  private compressEvent(event: PusherEvent): PusherEvent {
    const eventSize = JSON.stringify(event).length;
    
    if (eventSize <= this.config.compressionThreshold) {
      return event;
    }

    // Compress large data fields
    const compressedEvent = { ...event };
    
    if (event.action === 'playback_update' && event.data.currentTrack) {
      const track = event.data.currentTrack;
      compressedEvent.data.currentTrack = {
        ...track,
        name: track.name?.substring(0, 100) || '',
        artists: track.artists?.slice(0, 2).map(a => ({ name: a.name?.substring(0, 50) || '' })) || [],
        album: track.album ? {
          ...track.album,
          name: track.album.name?.substring(0, 100) || '',
          images: track.album.images?.slice(0, 1) || []
        } : undefined
      };
    }

    if (event.action === 'playback_update' && event.data.queue) {
      compressedEvent.data.queue = event.data.queue.slice(0, 10).map(track => ({
        ...track,
        name: track.name?.substring(0, 100) || '',
        artists: track.artists?.slice(0, 2).map(a => ({ name: a.name?.substring(0, 50) || '' })) || [],
        requesterNickname: track.requesterNickname?.substring(0, 30) || undefined
      }));
    }

    return compressedEvent;
  }

  // Get queue statistics
  getQueueStats(): {
    queueLength: number;
    processing: boolean;
  } {
    return {
      queueLength: this.eventQueue.length,
      processing: this.processingQueue
    };
  }

  // Clear the queue
  clearQueue(): void {
    this.eventQueue.forEach(queuedEvent => {
      queuedEvent.reject(new Error('Queue cleared'));
    });
    this.eventQueue = [];
  }
}

// Singleton broadcaster instance
const eventBroadcaster = new EventBroadcaster();

// Export convenience functions
export const broadcastEvent = async (
  event: Omit<PusherEvent, 'id' | 'timestamp' | 'version'>, 
  eventId: string
): Promise<void> => {
  return eventBroadcaster.broadcastEvent(event, eventId);
};

export const broadcastEvents = async (
  events: Array<Omit<PusherEvent, 'id' | 'timestamp' | 'version'>>, 
  eventId: string
): Promise<void> => {
  return eventBroadcaster.broadcastEvents(events, eventId);
};

export const getBroadcasterStats = () => eventBroadcaster.getQueueStats();
export const clearBroadcastQueue = () => eventBroadcaster.clearQueue();

// Specific event broadcasting functions
export const broadcastStateUpdate = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'state_update',
    eventId,
    data
  }, eventId);
};

export const broadcastRequestApproved = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'request_approved',
    eventId,
    data
  }, eventId);
};

export const broadcastRequestRejected = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'request_rejected',
    eventId,
    data
  }, eventId);
};

export const broadcastRequestSubmitted = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'request_submitted',
    eventId,
    data
  }, eventId);
};

export const broadcastRequestDeleted = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'request_deleted',
    eventId,
    data
  }, eventId);
};

export const broadcastPlaybackUpdate = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'playback_update',
    eventId,
    data
  }, eventId);
};

export const broadcastPageControlToggle = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'page_control_toggle',
    eventId,
    data
  }, eventId);
};

export const broadcastAdminLogin = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'admin_login',
    eventId,
    data
  }, eventId);
};

export const broadcastAdminLogout = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'admin_logout',
    eventId,
    data
  }, eventId);
};

export const broadcastTokenExpired = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'token_expired',
    eventId,
    data
  }, eventId);
};

export const broadcastStatsUpdate = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'stats_update',
    eventId,
    data
  }, eventId);
};

export const broadcastErrorOccurred = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'error_occurred',
    eventId,
    data
  }, eventId);
};

export const broadcastHeartbeat = async (eventId: string, data: any) => {
  return broadcastEvent({
    action: 'heartbeat',
    eventId,
    data
  }, eventId);
};
