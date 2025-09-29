/**
 * Rate Limiting System for Pusher Events
 * 
 * This module provides comprehensive rate limiting for Pusher events
 * including per-user, per-event, and global rate limiting.
 */

import { EventAction, PusherEvent } from './events';

// Rate limiting configuration
export interface RateLimitConfig {
  // Global limits
  globalMaxEventsPerSecond: number;
  globalMaxEventsPerMinute: number;
  globalMaxEventsPerHour: number;
  
  // Per-user limits
  userMaxEventsPerSecond: number;
  userMaxEventsPerMinute: number;
  userMaxEventsPerHour: number;
  
  // Per-event limits
  eventMaxEventsPerSecond: number;
  eventMaxEventsPerMinute: number;
  eventMaxEventsPerHour: number;
  
  // Per-action limits
  actionMaxEventsPerSecond: number;
  actionMaxEventsPerMinute: number;
  actionMaxEventsPerHour: number;
  
  // Burst limits
  burstLimit: number;
  burstWindow: number; // in milliseconds
  
  // Penalty system
  enablePenalties: boolean;
  penaltyDuration: number; // in milliseconds
  maxPenaltyLevel: number;
  
  // Cleanup
  cleanupInterval: number; // in milliseconds
  maxHistorySize: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  // Global limits
  globalMaxEventsPerSecond: 100,
  globalMaxEventsPerMinute: 1000,
  globalMaxEventsPerHour: 10000,
  
  // Per-user limits
  userMaxEventsPerSecond: 10,
  userMaxEventsPerMinute: 100,
  userMaxEventsPerHour: 1000,
  
  // Per-event limits
  eventMaxEventsPerSecond: 50,
  eventMaxEventsPerMinute: 500,
  eventMaxEventsPerHour: 5000,
  
  // Per-action limits
  actionMaxEventsPerSecond: 20,
  actionMaxEventsPerMinute: 200,
  actionMaxEventsPerHour: 2000,
  
  // Burst limits
  burstLimit: 5,
  burstWindow: 1000, // 1 second
  
  // Penalty system
  enablePenalties: true,
  penaltyDuration: 60000, // 1 minute
  maxPenaltyLevel: 5,
  
  // Cleanup
  cleanupInterval: 300000, // 5 minutes
  maxHistorySize: 10000
};

// Rate limit entry
interface RateLimitEntry {
  count: number;
  windowStart: number;
  lastEvent: number;
  penaltyLevel: number;
  penaltyUntil: number;
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  penaltyLevel?: number;
  remaining?: number;
  resetTime?: number;
}

// Rate limit statistics
export interface RateLimitStatistics {
  global: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
  users: Map<string, RateLimitEntry>;
  events: Map<string, RateLimitEntry>;
  actions: Map<string, RateLimitEntry>;
  penalties: Map<string, number>;
  totalRequests: number;
  blockedRequests: number;
  penaltyRequests: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private globalCounters: {
    perSecond: number;
    perMinute: number;
    perHour: number;
    lastSecond: number;
    lastMinute: number;
    lastHour: number;
  };
  private userCounters: Map<string, RateLimitEntry> = new Map();
  private eventCounters: Map<string, RateLimitEntry> = new Map();
  private actionCounters: Map<string, RateLimitEntry> = new Map();
  private penalties: Map<string, number> = new Map();
  private statistics: RateLimitStatistics;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.globalCounters = {
      perSecond: 0,
      perMinute: 0,
      perHour: 0,
      lastSecond: 0,
      lastMinute: 0,
      lastHour: 0
    };
    this.statistics = {
      global: {
        perSecond: 0,
        perMinute: 0,
        perHour: 0
      },
      users: new Map(),
      events: new Map(),
      actions: new Map(),
      penalties: new Map(),
      totalRequests: 0,
      blockedRequests: 0,
      penaltyRequests: 0
    };
    
    this.startCleanupTimer();
  }

  // Check if event is allowed
  checkRateLimit(
    event: PusherEvent,
    userId?: string,
    eventId?: string
  ): RateLimitResult {
    if (this.isDestroyed) {
      return { allowed: false, reason: 'Rate limiter destroyed' };
    }

    this.statistics.totalRequests++;

    // Check if user is under penalty
    if (userId && this.isUnderPenalty(userId)) {
      this.statistics.penaltyRequests++;
      return {
        allowed: false,
        reason: 'User under penalty',
        penaltyLevel: this.penalties.get(userId) || 0
      };
    }

    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);
    const currentMinute = Math.floor(now / 60000);
    const currentHour = Math.floor(now / 3600000);

    // Update global counters
    this.updateGlobalCounters(currentSecond, currentMinute, currentHour);

    // Check global limits
    const globalResult = this.checkGlobalLimits();
    if (!globalResult.allowed) {
      this.statistics.blockedRequests++;
      return globalResult;
    }

    // Check user limits
    if (userId) {
      const userResult = this.checkUserLimits(userId, currentSecond, currentMinute, currentHour);
      if (!userResult.allowed) {
        this.statistics.blockedRequests++;
        this.applyPenalty(userId);
        return userResult;
      }
    }

    // Check event limits
    if (eventId) {
      const eventResult = this.checkEventLimits(eventId, currentSecond, currentMinute, currentHour);
      if (!eventResult.allowed) {
        this.statistics.blockedRequests++;
        return eventResult;
      }
    }

    // Check action limits
    const actionResult = this.checkActionLimits(event.action, currentSecond, currentMinute, currentHour);
    if (!actionResult.allowed) {
      this.statistics.blockedRequests++;
      return actionResult;
    }

    // Check burst limits
    const burstResult = this.checkBurstLimits(event, userId, eventId);
    if (!burstResult.allowed) {
      this.statistics.blockedRequests++;
      return burstResult;
    }

    // Update counters
    this.updateCounters(event, userId, eventId, currentSecond, currentMinute, currentHour);

    return { allowed: true };
  }

  // Update global counters
  private updateGlobalCounters(currentSecond: number, currentMinute: number, currentHour: number): void {
    const now = Date.now();

    // Reset counters if window has passed
    if (currentSecond !== this.globalCounters.lastSecond) {
      this.globalCounters.perSecond = 0;
      this.globalCounters.lastSecond = currentSecond;
    }
    if (currentMinute !== this.globalCounters.lastMinute) {
      this.globalCounters.perMinute = 0;
      this.globalCounters.lastMinute = currentMinute;
    }
    if (currentHour !== this.globalCounters.lastHour) {
      this.globalCounters.perHour = 0;
      this.globalCounters.lastHour = currentHour;
    }

    // Update statistics
    this.statistics.global = {
      perSecond: this.globalCounters.perSecond,
      perMinute: this.globalCounters.perMinute,
      perHour: this.globalCounters.perHour
    };
  }

  // Check global limits
  private checkGlobalLimits(): RateLimitResult {
    if (this.globalCounters.perSecond >= this.config.globalMaxEventsPerSecond) {
      return {
        allowed: false,
        reason: 'Global rate limit exceeded (per second)',
        retryAfter: 1000,
        remaining: 0
      };
    }
    if (this.globalCounters.perMinute >= this.config.globalMaxEventsPerMinute) {
      return {
        allowed: false,
        reason: 'Global rate limit exceeded (per minute)',
        retryAfter: 60000,
        remaining: 0
      };
    }
    if (this.globalCounters.perHour >= this.config.globalMaxEventsPerHour) {
      return {
        allowed: false,
        reason: 'Global rate limit exceeded (per hour)',
        retryAfter: 3600000,
        remaining: 0
      };
    }
    return { allowed: true };
  }

  // Check user limits
  private checkUserLimits(userId: string, currentSecond: number, currentMinute: number, currentHour: number): RateLimitResult {
    const entry = this.getOrCreateEntry(this.userCounters, userId, currentSecond, currentMinute, currentHour);
    
    if (entry.count >= this.config.userMaxEventsPerSecond) {
      return {
        allowed: false,
        reason: 'User rate limit exceeded (per second)',
        retryAfter: 1000,
        remaining: 0
      };
    }
    if (entry.count >= this.config.userMaxEventsPerMinute) {
      return {
        allowed: false,
        reason: 'User rate limit exceeded (per minute)',
        retryAfter: 60000,
        remaining: 0
      };
    }
    if (entry.count >= this.config.userMaxEventsPerHour) {
      return {
        allowed: false,
        reason: 'User rate limit exceeded (per hour)',
        retryAfter: 3600000,
        remaining: 0
      };
    }
    return { allowed: true };
  }

  // Check event limits
  private checkEventLimits(eventId: string, currentSecond: number, currentMinute: number, currentHour: number): RateLimitResult {
    const entry = this.getOrCreateEntry(this.eventCounters, eventId, currentSecond, currentMinute, currentHour);
    
    if (entry.count >= this.config.eventMaxEventsPerSecond) {
      return {
        allowed: false,
        reason: 'Event rate limit exceeded (per second)',
        retryAfter: 1000,
        remaining: 0
      };
    }
    if (entry.count >= this.config.eventMaxEventsPerMinute) {
      return {
        allowed: false,
        reason: 'Event rate limit exceeded (per minute)',
        retryAfter: 60000,
        remaining: 0
      };
    }
    if (entry.count >= this.config.eventMaxEventsPerHour) {
      return {
        allowed: false,
        reason: 'Event rate limit exceeded (per hour)',
        retryAfter: 3600000,
        remaining: 0
      };
    }
    return { allowed: true };
  }

  // Check action limits
  private checkActionLimits(action: EventAction, currentSecond: number, currentMinute: number, currentHour: number): RateLimitResult {
    const entry = this.getOrCreateEntry(this.actionCounters, action, currentSecond, currentMinute, currentHour);
    
    if (entry.count >= this.config.actionMaxEventsPerSecond) {
      return {
        allowed: false,
        reason: 'Action rate limit exceeded (per second)',
        retryAfter: 1000,
        remaining: 0
      };
    }
    if (entry.count >= this.config.actionMaxEventsPerMinute) {
      return {
        allowed: false,
        reason: 'Action rate limit exceeded (per minute)',
        retryAfter: 60000,
        remaining: 0
      };
    }
    if (entry.count >= this.config.actionMaxEventsPerHour) {
      return {
        allowed: false,
        reason: 'Action rate limit exceeded (per hour)',
        retryAfter: 3600000,
        remaining: 0
      };
    }
    return { allowed: true };
  }

  // Check burst limits
  private checkBurstLimits(event: PusherEvent, userId?: string, eventId?: string): RateLimitResult {
    const now = Date.now();
    const key = `${userId || 'anonymous'}-${eventId || 'global'}-${event.action}`;
    
    const entry = this.getOrCreateEntry(this.actionCounters, key, now, now, now);
    
    // Check if within burst window
    if (now - entry.windowStart < this.config.burstWindow) {
      if (entry.count >= this.config.burstLimit) {
        return {
          allowed: false,
          reason: 'Burst rate limit exceeded',
          retryAfter: this.config.burstWindow - (now - entry.windowStart),
          remaining: 0
        };
      }
    } else {
      // Reset burst window
      entry.count = 0;
      entry.windowStart = now;
    }
    
    return { allowed: true };
  }

  // Get or create rate limit entry
  private getOrCreateEntry(
    map: Map<string, RateLimitEntry>,
    key: string,
    currentSecond: number,
    currentMinute: number,
    currentHour: number
  ): RateLimitEntry {
    let entry = map.get(key);
    
    if (!entry) {
      entry = {
        count: 0,
        windowStart: currentSecond * 1000,
        lastEvent: 0,
        penaltyLevel: 0,
        penaltyUntil: 0
      };
      map.set(key, entry);
    }
    
    // Reset counters if window has passed
    if (currentSecond * 1000 !== entry.windowStart) {
      entry.count = 0;
      entry.windowStart = currentSecond * 1000;
    }
    
    return entry;
  }

  // Update counters
  private updateCounters(
    event: PusherEvent,
    userId?: string,
    eventId?: string,
    currentSecond?: number,
    currentMinute?: number,
    currentHour?: number
  ): void {
    const now = Date.now();
    const second = currentSecond || Math.floor(now / 1000);
    const minute = currentMinute || Math.floor(now / 60000);
    const hour = currentHour || Math.floor(now / 3600000);

    // Update global counters
    this.globalCounters.perSecond++;
    this.globalCounters.perMinute++;
    this.globalCounters.perHour++;

    // Update user counters
    if (userId) {
      const userEntry = this.getOrCreateEntry(this.userCounters, userId, second, minute, hour);
      userEntry.count++;
      userEntry.lastEvent = now;
    }

    // Update event counters
    if (eventId) {
      const eventEntry = this.getOrCreateEntry(this.eventCounters, eventId, second, minute, hour);
      eventEntry.count++;
      eventEntry.lastEvent = now;
    }

    // Update action counters
    const actionEntry = this.getOrCreateEntry(this.actionCounters, event.action, second, minute, hour);
    actionEntry.count++;
    actionEntry.lastEvent = now;
  }

  // Apply penalty
  private applyPenalty(userId: string): void {
    if (!this.config.enablePenalties) return;

    const currentPenalty = this.penalties.get(userId) || 0;
    const newPenalty = Math.min(currentPenalty + 1, this.config.maxPenaltyLevel);
    
    this.penalties.set(userId, newPenalty);
    
    // Set penalty expiration
    const penaltyUntil = Date.now() + (this.config.penaltyDuration * newPenalty);
    const userEntry = this.userCounters.get(userId);
    if (userEntry) {
      userEntry.penaltyLevel = newPenalty;
      userEntry.penaltyUntil = penaltyUntil;
    }
    
    console.log(`⚠️ Penalty applied to user ${userId}: level ${newPenalty}`);
  }

  // Check if user is under penalty
  private isUnderPenalty(userId: string): boolean {
    const penaltyUntil = this.penalties.get(userId);
    if (!penaltyUntil) return false;
    
    if (Date.now() > penaltyUntil) {
      this.penalties.delete(userId);
      return false;
    }
    
    return true;
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // Cleanup old entries
  private cleanup(): void {
    if (this.isDestroyed) return;

    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours ago

    // Cleanup user counters
    for (const [key, entry] of this.userCounters.entries()) {
      if (entry.lastEvent < cutoff) {
        this.userCounters.delete(key);
      }
    }

    // Cleanup event counters
    for (const [key, entry] of this.eventCounters.entries()) {
      if (entry.lastEvent < cutoff) {
        this.eventCounters.delete(key);
      }
    }

    // Cleanup action counters
    for (const [key, entry] of this.actionCounters.entries()) {
      if (entry.lastEvent < cutoff) {
        this.actionCounters.delete(key);
      }
    }

    // Cleanup expired penalties
    for (const [userId, penaltyUntil] of this.penalties.entries()) {
      if (now > penaltyUntil) {
        this.penalties.delete(userId);
      }
    }

    // Limit history size
    if (this.userCounters.size > this.config.maxHistorySize) {
      const entries = Array.from(this.userCounters.entries());
      entries.sort((a, b) => a[1].lastEvent - b[1].lastEvent);
      const toDelete = entries.slice(0, entries.length - this.config.maxHistorySize);
      toDelete.forEach(([key]) => this.userCounters.delete(key));
    }

    console.log('🧹 Rate limiter cleanup completed');
  }

  // Get statistics
  getStatistics(): RateLimitStatistics {
    return {
      global: { ...this.statistics.global },
      users: new Map(this.userCounters),
      events: new Map(this.eventCounters),
      actions: new Map(this.actionCounters),
      penalties: new Map(this.penalties),
      totalRequests: this.statistics.totalRequests,
      blockedRequests: this.statistics.blockedRequests,
      penaltyRequests: this.statistics.penaltyRequests
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Rate limiter configuration updated');
  }

  // Reset user penalty
  resetUserPenalty(userId: string): void {
    this.penalties.delete(userId);
    const userEntry = this.userCounters.get(userId);
    if (userEntry) {
      userEntry.penaltyLevel = 0;
      userEntry.penaltyUntil = 0;
    }
    console.log(`✅ Penalty reset for user ${userId}`);
  }

  // Reset all penalties
  resetAllPenalties(): void {
    this.penalties.clear();
    for (const entry of this.userCounters.values()) {
      entry.penaltyLevel = 0;
      entry.penaltyUntil = 0;
    }
    console.log('✅ All penalties reset');
  }

  // Cleanup
  destroy(): void {
    this.isDestroyed = true;
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.userCounters.clear();
    this.eventCounters.clear();
    this.actionCounters.clear();
    this.penalties.clear();
    
    console.log('🧹 Rate limiter destroyed');
  }
}

// Singleton instance
let rateLimiter: RateLimiter | null = null;

// Get or create singleton instance
export const getRateLimiter = (config?: Partial<RateLimitConfig>): RateLimiter => {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter(config);
  }
  return rateLimiter;
};

// Cleanup function
export const cleanupRateLimiter = (): void => {
  if (rateLimiter) {
    rateLimiter.destroy();
    rateLimiter = null;
  }
};
