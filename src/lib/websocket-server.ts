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
    // Implementation will call existing API endpoints
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/approve/${payload.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ play_next: payload.playNext })
    });
    
    if (!response.ok) {
      throw new Error('Failed to approve request');
    }
  }

  private async handleRejectRequest(payload: { requestId: string; reason?: string }) {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/reject/${payload.requestId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: payload.reason })
    });
    
    if (!response.ok) {
      throw new Error('Failed to reject request');
    }
  }

  private async handleDeleteRequest(payload: { requestId: string }) {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/delete/${payload.requestId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete request');
    }
  }

  private async handlePlaybackControl(payload: { action: 'play' | 'pause' | 'skip' }) {
    const endpoint = payload.action === 'skip' 
      ? '/api/admin/playback/skip'
      : `/api/admin/playback/${payload.action === 'play' ? 'resume' : 'pause'}`;
    
    const response = await fetch(`${process.env.NEXTAUTH_URL}${endpoint}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to ${payload.action} playback`);
    }
  }

  private async handleUpdateSettings(payload: any) {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/event-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
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
      // Get current Spotify state
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/queue/details`);
      if (!response.ok) return;

      const spotifyData = await response.json();
      
      if (spotifyData.spotify_connected && spotifyData.current_track) {
        const currentState: SpotifyState = {
          current_track: spotifyData.current_track,
          queue: spotifyData.queue || [],
          playback_state: spotifyData.playback_state,
          is_playing: spotifyData.current_track.is_playing,
          progress_ms: spotifyData.current_track.progress_ms,
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
      // Fetch latest admin data
      const [requestsRes, settingsRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXTAUTH_URL}/api/admin/requests?status=pending&limit=50`),
        fetch(`${process.env.NEXTAUTH_URL}/api/admin/event-settings`),
        fetch(`${process.env.NEXTAUTH_URL}/api/admin/stats`)
      ]);

      const adminData: AdminData = {
        requests: requestsRes.ok ? await requestsRes.json() : [],
        spotify_state: this.lastSpotifyState,
        event_settings: settingsRes.ok ? await settingsRes.json() : null,
        stats: statsRes.ok ? await statsRes.json() : null
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
