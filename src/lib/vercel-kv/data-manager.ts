/**
 * Vercel KV Data Manager
 * 
 * This module provides high-level data management functions
 * for frequently accessed data using Vercel KV.
 */

import { getVercelKVClient } from './client';
import { KV_KEYS, KV_PATTERNS } from './config';

export interface EventData {
  id: string;
  name: string;
  status: 'offline' | 'standby' | 'live';
  createdAt: Date;
  updatedAt: Date;
  settings: {
    allowRequests: boolean;
    maxRequestsPerUser: number;
    autoApprove: boolean;
  };
  stats: {
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    activeUsers: number;
  };
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  spotifyId?: string;
  preferences: {
    notifications: boolean;
    autoPlay: boolean;
  };
  stats: {
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
  };
}

export interface SpotifyData {
  userId: string;
  deviceId?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  devices: Array<{
    id: string;
    name: string;
    type: string;
    isActive: boolean;
  }>;
}

export interface SessionData {
  id: string;
  userId: string;
  eventId: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}

export interface RequestData {
  id: string;
  eventId: string;
  userId: string;
  songId: string;
  songName: string;
  artist: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  createdAt: Date;
  updatedAt: Date;
  playedAt?: Date;
}

export class VercelKVDataManager {
  private kv = getVercelKVClient();

  /**
   * Event Data Management
   */
  async getEvent(eventId: string): Promise<EventData | null> {
    return await this.kv.get<EventData>(KV_KEYS.EVENT(eventId));
  }

  async setEvent(eventData: EventData): Promise<boolean> {
    return await this.kv.set(KV_KEYS.EVENT(eventData.id), eventData, 300); // 5 minutes TTL
  }

  async updateEventStats(eventId: string, stats: Partial<EventData['stats']>): Promise<boolean> {
    const event = await this.getEvent(eventId);
    if (!event) return false;

    event.stats = { ...event.stats, ...stats };
    event.updatedAt = new Date();
    
    return await this.setEvent(event);
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    return await this.kv.del(KV_KEYS.EVENT(eventId));
  }

  /**
   * User Data Management
   */
  async getUser(userId: string): Promise<UserData | null> {
    return await this.kv.get<UserData>(KV_KEYS.USER(userId));
  }

  async setUser(userData: UserData): Promise<boolean> {
    return await this.kv.set(KV_KEYS.USER(userData.id), userData, 900); // 15 minutes TTL
  }

  async updateUserStats(userId: string, stats: Partial<UserData['stats']>): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    user.stats = { ...user.stats, ...stats };
    
    return await this.setUser(user);
  }

  async deleteUser(userId: string): Promise<boolean> {
    return await this.kv.del(KV_KEYS.USER(userId));
  }

  /**
   * Spotify Data Management
   */
  async getSpotifyData(userId: string): Promise<SpotifyData | null> {
    return await this.kv.get<SpotifyData>(KV_KEYS.SPOTIFY_TOKEN(userId));
  }

  async setSpotifyData(spotifyData: SpotifyData): Promise<boolean> {
    return await this.kv.set(KV_KEYS.SPOTIFY_TOKEN(spotifyData.userId), spotifyData, 600); // 10 minutes TTL
  }

  async getSpotifyDevices(userId: string): Promise<SpotifyData['devices'] | null> {
    const data = await this.getSpotifyData(userId);
    return data?.devices || null;
  }

  async setSpotifyDevices(userId: string, devices: SpotifyData['devices']): Promise<boolean> {
    const data = await this.getSpotifyData(userId);
    if (!data) return false;

    data.devices = devices;
    return await this.setSpotifyData(data);
  }

  async deleteSpotifyData(userId: string): Promise<boolean> {
    return await this.kv.del(KV_KEYS.SPOTIFY_TOKEN(userId));
  }

  /**
   * Session Data Management
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    return await this.kv.get<SessionData>(KV_KEYS.SESSION(sessionId));
  }

  async setSession(sessionData: SessionData): Promise<boolean> {
    return await this.kv.set(KV_KEYS.SESSION(sessionData.id), sessionData, 3600); // 1 hour TTL
  }

  async updateSessionActivity(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    session.lastActivity = new Date();
    return await this.setSession(session);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return await this.kv.del(KV_KEYS.SESSION(sessionId));
  }

  /**
   * Request Data Management
   */
  async getRequest(requestId: string): Promise<RequestData | null> {
    return await this.kv.get<RequestData>(KV_KEYS.REQUEST(requestId));
  }

  async setRequest(requestData: RequestData): Promise<boolean> {
    return await this.kv.set(KV_KEYS.REQUEST(requestData.id), requestData, 1800); // 30 minutes TTL
  }

  async getRequestsByEvent(eventId: string): Promise<RequestData[]> {
    const requestIds = await this.kv.get<string[]>(KV_KEYS.REQUESTS_BY_EVENT(eventId));
    if (!requestIds) return [];

    const requests = await this.kv.mget<RequestData>(requestIds);
    return requests.filter((req): req is RequestData => req !== null);
  }

  async addRequestToEvent(eventId: string, requestId: string): Promise<boolean> {
    const requestIds = await this.kv.get<string[]>(KV_KEYS.REQUESTS_BY_EVENT(eventId)) || [];
    requestIds.push(requestId);
    
    return await this.kv.set(KV_KEYS.REQUESTS_BY_EVENT(eventId), requestIds, 1800);
  }

  async removeRequestFromEvent(eventId: string, requestId: string): Promise<boolean> {
    const requestIds = await this.kv.get<string[]>(KV_KEYS.REQUESTS_BY_EVENT(eventId)) || [];
    const filteredIds = requestIds.filter(id => id !== requestId);
    
    return await this.kv.set(KV_KEYS.REQUESTS_BY_EVENT(eventId), filteredIds, 1800);
  }

  async getRequestsByUser(userId: string): Promise<RequestData[]> {
    const requestIds = await this.kv.get<string[]>(KV_KEYS.REQUESTS_BY_USER(userId));
    if (!requestIds) return [];

    const requests = await this.kv.mget<RequestData>(requestIds);
    return requests.filter((req): req is RequestData => req !== null);
  }

  async addRequestToUser(userId: string, requestId: string): Promise<boolean> {
    const requestIds = await this.kv.get<string[]>(KV_KEYS.REQUESTS_BY_USER(userId)) || [];
    requestIds.push(requestId);
    
    return await this.kv.set(KV_KEYS.REQUESTS_BY_USER(userId), requestIds, 1800);
  }

  async removeRequestFromUser(userId: string, requestId: string): Promise<boolean> {
    const requestIds = await this.kv.get<string[]>(KV_KEYS.REQUESTS_BY_USER(userId)) || [];
    const filteredIds = requestIds.filter(id => id !== requestId);
    
    return await this.kv.set(KV_KEYS.REQUESTS_BY_USER(userId), filteredIds, 1800);
  }

  async deleteRequest(requestId: string): Promise<boolean> {
    return await this.kv.del(KV_KEYS.REQUEST(requestId));
  }

  /**
   * Statistics Management
   */
  async getEventStats(eventId: string): Promise<EventData['stats'] | null> {
    const event = await this.getEvent(eventId);
    return event?.stats || null;
  }

  async getUserStats(userId: string): Promise<UserData['stats'] | null> {
    const user = await this.getUser(userId);
    return user?.stats || null;
  }

  async incrementEventStat(eventId: string, stat: keyof EventData['stats']): Promise<boolean> {
    const event = await this.getEvent(eventId);
    if (!event) return false;

    event.stats[stat] = (event.stats[stat] || 0) + 1;
    event.updatedAt = new Date();
    
    return await this.setEvent(event);
  }

  async incrementUserStat(userId: string, stat: keyof UserData['stats']): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    user.stats[stat] = (user.stats[stat] || 0) + 1;
    
    return await this.setUser(user);
  }

  /**
   * Batch Operations
   */
  async getMultipleEvents(eventIds: string[]): Promise<(EventData | null)[]> {
    const keys = eventIds.map(id => KV_KEYS.EVENT(id));
    return await this.kv.mget<EventData>(keys);
  }

  async getMultipleUsers(userIds: string[]): Promise<(UserData | null)[]> {
    const keys = userIds.map(id => KV_KEYS.USER(id));
    return await this.kv.mget<UserData>(keys);
  }

  async getMultipleRequests(requestIds: string[]): Promise<(RequestData | null)[]> {
    const keys = requestIds.map(id => KV_KEYS.REQUEST(id));
    return await this.kv.mget<RequestData>(keys);
  }

  /**
   * Cleanup Operations
   */
  async cleanupExpiredSessions(): Promise<number> {
    const sessions = await this.kv.keys(KV_PATTERNS.SESSIONS);
    let deleted = 0;

    for (const sessionKey of sessions) {
      const session = await this.kv.get<SessionData>(sessionKey);
      if (session && Date.now() - session.lastActivity.getTime() > 24 * 60 * 60 * 1000) { // 24 hours
        await this.kv.del(sessionKey);
        deleted++;
      }
    }

    return deleted;
  }

  async cleanupOldRequests(): Promise<number> {
    const requests = await this.kv.keys(KV_PATTERNS.REQUESTS);
    let deleted = 0;

    for (const requestKey of requests) {
      const request = await this.kv.get<RequestData>(requestKey);
      if (request && Date.now() - request.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000) { // 7 days
        await this.kv.del(requestKey);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Get data manager statistics
   */
  async getStatistics(): Promise<{
    events: number;
    users: number;
    sessions: number;
    requests: number;
    spotifyData: number;
  }> {
    const [events, users, sessions, requests, spotifyData] = await Promise.all([
      this.kv.keys(KV_PATTERNS.EVENTS),
      this.kv.keys(KV_PATTERNS.USERS),
      this.kv.keys(KV_PATTERNS.SESSIONS),
      this.kv.keys(KV_PATTERNS.REQUESTS),
      this.kv.keys(KV_PATTERNS.SPOTIFY_TOKENS),
    ]);

    return {
      events: events.length,
      users: users.length,
      sessions: sessions.length,
      requests: requests.length,
      spotifyData: spotifyData.length,
    };
  }
}

// Singleton instance
let dataManager: VercelKVDataManager | null = null;

export const getVercelKVDataManager = (): VercelKVDataManager => {
  if (!dataManager) {
    dataManager = new VercelKVDataManager();
  }
  return dataManager;
};
