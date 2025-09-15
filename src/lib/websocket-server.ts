import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { SpotifyService } from './spotify';

export type SocketServer = SocketIOServer;

interface SpotifyState {
  current_track: any;
  queue: any[];
  playback_state: any;
  is_playing: boolean;
  progress_ms: number;
  timestamp: number;
}

interface AdminData {
  requests: any[];
  spotify_state: SpotifyState | null;
  event_settings: any;
  stats: any;
}

class WebSocketManager {
  private io: SocketIOServer | null = null;
  private spotifyPollingInterval: NodeJS.Timeout | null = null;
  private lastSpotifyState: SpotifyState | null = null;
  private lastAdminData: AdminData | null = null;
  private connectedClients = new Set<string>();

  initialize(server: NetServer) {
    if (this.io) return this.io;

    this.io = new SocketIOServer(server, {
      path: '/api/websocket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://partyplaylist.co.uk', 'https://www.partyplaylist.co.uk']
          : ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupEventHandlers();
    this.startSpotifyPolling();

    console.log('🔌 WebSocket server initialized');
    return this.io;
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`👤 Admin connected: ${socket.id}`);
      this.connectedClients.add(socket.id);

      // Send current state to newly connected client
      if (this.lastAdminData) {
        socket.emit('admin:full-update', this.lastAdminData);
      }

      // Handle authentication
      socket.on('admin:authenticate', async (token: string) => {
        try {
          // Verify admin token (reuse existing auth logic)
          const isValid = await this.verifyAdminToken(token);
          if (isValid) {
            socket.join('authenticated-admins');
            socket.emit('admin:auth-success');
            console.log(`✅ Admin authenticated: ${socket.id}`);
          } else {
            socket.emit('admin:auth-failed');
            socket.disconnect();
          }
        } catch (error) {
          console.error('Auth error:', error);
          socket.emit('admin:auth-failed');
          socket.disconnect();
        }
      });

      // Handle admin actions
      socket.on('admin:action', async (action: any) => {
        try {
          await this.handleAdminAction(action, socket.id);
        } catch (error) {
          console.error('Admin action error:', error);
          socket.emit('admin:action-error', { action, error: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log(`👋 Admin disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  private async verifyAdminToken(token: string): Promise<boolean> {
    try {
      // Use the same JWT verification as the REST API
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      return decoded && decoded.username === 'admin';
    } catch (error) {
      console.error('JWT verification failed:', error);
      return false;
    }
  }

  private async handleAdminAction(action: any, socketId: string) {
    console.log(`🎬 Admin action from ${socketId}:`, action.type);

    // Handle different admin actions
    switch (action.type) {
      case 'approve-request':
        await this.handleApproveRequest(action.payload);
        break;
      case 'reject-request':
        await this.handleRejectRequest(action.payload);
        break;
      case 'delete-request':
        await this.handleDeleteRequest(action.payload);
        break;
      case 'playback-control':
        await this.handlePlaybackControl(action.payload);
        break;
      case 'update-settings':
        await this.handleUpdateSettings(action.payload);
        break;
      default:
        console.warn('Unknown admin action:', action.type);
    }

    // Broadcast updated data to all connected admins
    await this.broadcastAdminUpdate();
  }

  private async handleApproveRequest(payload: { requestId: string; playNext?: boolean }) {
    // Use internal database calls instead of HTTP to avoid auth issues
    const { updateRequest } = require('./db');
    const SpotifyService = require('./spotify').SpotifyService;
    
    try {
      // Update request status
      await updateRequest(payload.requestId, { status: 'approved' });
      
      // Add to Spotify if connected
      const spotifyService = new SpotifyService();
      const request = await require('./db').getRequest(payload.requestId);
      
      if (request && request.track_uri) {
        if (payload.playNext) {
          await spotifyService.addToQueue(request.track_uri);
          // Note: Spotify doesn't have a direct "play next" API, so we add to queue
        } else {
          await spotifyService.addToQueue(request.track_uri);
        }
      }
    } catch (error) {
      console.error('Error approving request:', error);
      throw new Error('Failed to approve request');
    }
  }

  private async handleRejectRequest(payload: { requestId: string; reason?: string }) {
    // Use internal database calls instead of HTTP to avoid auth issues
    const { updateRequest } = require('./db');
    
    try {
      await updateRequest(payload.requestId, { status: 'rejected' });
    } catch (error) {
      console.error('Error rejecting request:', error);
      throw new Error('Failed to reject request');
    }
  }

  private async handleDeleteRequest(payload: { requestId: string }) {
    // Use internal database calls instead of HTTP to avoid auth issues
    const { updateRequest } = require('./db');
    
    try {
      // Mark as deleted instead of actually deleting (safer)
      await updateRequest(payload.requestId, { status: 'deleted' });
    } catch (error) {
      console.error('Error deleting request:', error);
      throw new Error('Failed to delete request');
    }
  }

  private async handlePlaybackControl(payload: { action: 'play' | 'pause' | 'skip' }) {
    // Use internal Spotify service calls instead of HTTP to avoid auth issues
    const SpotifyService = require('./spotify').SpotifyService;
    const spotifyService = new SpotifyService();
    
    try {
      switch (payload.action) {
        case 'play':
          await spotifyService.resumePlayback();
          break;
        case 'pause':
          await spotifyService.pausePlayback();
          break;
        case 'skip':
          await spotifyService.skipToNext();
          break;
      }
    } catch (error) {
      console.error(`Error ${payload.action}ing playback:`, error);
      throw new Error(`Failed to ${payload.action} playback`);
    }
  }

  private async handleUpdateSettings(payload: any) {
    // Use internal database calls instead of HTTP to avoid auth issues
    const { updateEventSettings } = require('./db');
    
    try {
      await updateEventSettings(payload);
    } catch (error) {
      console.error('Error updating settings:', error);
      throw new Error('Failed to update settings');
    }
  }

  private startSpotifyPolling() {
    // Poll Spotify API every 2 seconds for real-time updates
    this.spotifyPollingInterval = setInterval(async () => {
      try {
        await this.pollSpotifyState();
      } catch (error) {
        console.error('Spotify polling error:', error);
      }
    }, 2000);

    console.log('🎵 Started Spotify polling service');
  }

  private async pollSpotifyState() {
    try {
      // Get current Spotify state - use internal API call to avoid auth issues
      const SpotifyService = require('./spotify').SpotifyService;
      const spotifyService = new SpotifyService();
      
      const [currentPlayback, queue] = await Promise.all([
        spotifyService.getCurrentPlayback(),
        spotifyService.getQueue()
      ]);
      
      if (!currentPlayback || !currentPlayback.item) return;
      
      const currentState: SpotifyState = {
        current_track: currentPlayback.item,
        queue: queue?.queue || [],
        playback_state: currentPlayback,
        is_playing: currentPlayback.is_playing,
        progress_ms: currentPlayback.progress_ms,
        timestamp: Date.now()
      };

      // Check if state has changed significantly
      if (this.hasSpotifyStateChanged(currentState)) {
        this.lastSpotifyState = currentState;
        
        // Broadcast to all authenticated admins
        if (this.io) {
          this.io.to('authenticated-admins').emit('spotify:update', currentState);
        }
      }
    } catch (error) {
      console.error('Error polling Spotify:', error);
    }
  }

  private hasSpotifyStateChanged(newState: SpotifyState): boolean {
    if (!this.lastSpotifyState) return true;

    const last = this.lastSpotifyState;
    
    // Check for significant changes
    return (
      last.current_track?.uri !== newState.current_track?.uri ||
      last.is_playing !== newState.is_playing ||
      last.queue.length !== newState.queue.length ||
      Math.abs(last.progress_ms - newState.progress_ms) > 5000 // 5 second threshold
    );
  }

  private async broadcastAdminUpdate() {
    try {
      // Use internal database calls instead of HTTP to avoid auth issues
      const { getAllRequests, getEventSettings } = require('./db');
      
      const [requests, eventSettings] = await Promise.all([
        getAllRequests(50, 0).catch(() => []),
        getEventSettings().catch(() => null)
      ]);

      // Calculate basic stats
      const stats = {
        total_requests: requests.length,
        pending_requests: requests.filter((r: any) => r.status === 'pending').length,
        approved_requests: requests.filter((r: any) => r.status === 'approved').length,
        rejected_requests: requests.filter((r: any) => r.status === 'rejected').length,
        played_requests: requests.filter((r: any) => r.status === 'played').length,
        unique_requesters: new Set(requests.map((r: any) => r.requester_nickname || 'Anonymous')).size,
        spotify_connected: !!this.lastSpotifyState
      };

      const adminData: AdminData = {
        requests,
        spotify_state: this.lastSpotifyState,
        event_settings: eventSettings,
        stats
      };

      this.lastAdminData = adminData;

      // Broadcast to all authenticated admins
      if (this.io) {
        this.io.to('authenticated-admins').emit('admin:update', adminData);
      }
    } catch (error) {
      console.error('Error broadcasting admin update:', error);
    }
  }

  broadcast(event: string, data: any) {
    if (this.io) {
      this.io.to('authenticated-admins').emit(event, data);
    }
  }

  getConnectedCount(): number {
    return this.connectedClients.size;
  }

  cleanup() {
    if (this.spotifyPollingInterval) {
      clearInterval(this.spotifyPollingInterval);
      this.spotifyPollingInterval = null;
    }
    
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    
    this.connectedClients.clear();
    console.log('🧹 WebSocket manager cleaned up');
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
