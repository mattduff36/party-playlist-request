/**
 * Database Service Layer with Connection Pooling
 * 
 * This module provides high-level database operations using the connection pool
 * manager. It includes optimized queries, transaction management, and error handling.
 */

import { PoolClient } from 'pg';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { 
  getConnectionPoolManager, 
  PoolType, 
  executeWithPool 
} from './connection-pool';
import { 
  events, 
  admins, 
  spotify_tokens, 
  requests, 
  type Event, 
  type EventStatus, 
  type EventConfig 
} from './schema';

// Service types
export interface DatabaseServiceConfig {
  defaultPoolType: PoolType;
  enableQueryLogging: boolean;
  enablePerformanceMetrics: boolean;
  maxRetries: number;
  retryDelay: number;
}

// Query result types
export interface QueryResult<T> {
  data: T[];
  count: number;
  executionTime: number;
  poolType: PoolType;
}

export interface DatabaseStats {
  totalQueries: number;
  averageQueryTime: number;
  errorRate: number;
  poolHealth: Record<PoolType, boolean>;
}

// Database service class
export class DatabaseService {
  private config: DatabaseServiceConfig;
  private queryCount = 0;
  private totalQueryTime = 0;
  private errorCount = 0;

  constructor(config: Partial<DatabaseServiceConfig> = {}) {
    this.config = {
      defaultPoolType: PoolType.READ_WRITE,
      enableQueryLogging: process.env.NODE_ENV === 'development',
      enablePerformanceMetrics: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  // Event operations
  async getEvent(userId: string, eventId?: string): Promise<Event | null> {
    return await this.executeQuery(
      PoolType.READ_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.READ_ONLY);
        
        if (eventId) {
          // Get specific event for this user
          const result = await drizzle
            .select()
            .from(events)
            .where(and(eq(events.id, eventId), eq(events.user_id, userId)))
            .limit(1);
          return result[0] || null;
        } else {
          // Get the most recent active event for this user
          const result = await drizzle
            .select()
            .from(events)
            .where(eq(events.user_id, userId))
            .orderBy(desc(events.updated_at))
            .limit(1);
          return result[0] || null;
        }
      }
    );
  }

  async createEvent(eventData: Partial<Event>): Promise<Event> {
    return await this.executeQuery(
      PoolType.WRITE_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.WRITE_ONLY);
        
        // events.pin is a unique row key (not the guest URL code — that lives on user_events).
        // Still mint 6 digits so new rows never introduce legacy 4-digit pins.
        const { generateAccessCode } = await import('@/lib/access-code');
        const pin = eventData.pin || generateAccessCode(false);
        
        const result = await drizzle
          .insert(events)
          .values({
            user_id: eventData.user_id!,
            pin: pin,
            status: eventData.status || 'offline',
            version: eventData.version || 0,
            config: eventData.config || {},
            active_admin_id: eventData.active_admin_id,
            device_id: eventData.device_id,
          })
          .returning();
        
        return result[0];
      }
    );
  }

  async updateEvent(eventId: string, updates: Partial<Event>, userId: string): Promise<Event> {
    return await this.executeQuery(
      PoolType.WRITE_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.WRITE_ONLY);
        
        const result = await drizzle
          .update(events)
          .set({
            ...updates,
            updated_at: new Date(),
          })
          .where(and(eq(events.id, eventId), eq(events.user_id, userId)))  // ✅ Verify ownership
          .returning();
        
        return result[0];
      }
    );
  }

  async updateEventStatus(eventId: string, status: EventStatus, version: number, userId: string): Promise<Event> {
    return await this.executeQuery(
      PoolType.WRITE_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.WRITE_ONLY);
        
        const result = await drizzle
          .update(events)
          .set({
            status,
            version,
            updated_at: new Date(),
          })
          .where(and(eq(events.id, eventId), eq(events.user_id, userId)))  // ✅ Verify ownership
          .returning();
        
        return result[0];
      }
    );
  }

  // Request operations
  async getRequests(eventId: string, limit = 50, offset = 0): Promise<QueryResult<any>> {
    return await this.executeQuery(
      PoolType.READ_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.READ_ONLY);
        
        const data = await drizzle
          .select()
          .from(requests)
          .where(eq(requests.event_id, eventId))
          .orderBy(desc(requests.created_at))
          .limit(limit)
          .offset(offset);
        
        const countResult = await drizzle
          .select({ count: sql<number>`count(*)` })
          .from(requests)
          .where(eq(requests.event_id, eventId));
        
        return {
          data,
          count: countResult[0]?.count || 0,
          executionTime: 0, // Will be set by executeQuery
          poolType: PoolType.READ_ONLY,
        };
      }
    );
  }

  async createRequest(requestData: {
    event_id: string;
    track_id: string;
    track_data: any;
    submitted_by?: string;
    idempotency_key?: string;
  }): Promise<any> {
    return await this.executeQuery(
      PoolType.WRITE_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.WRITE_ONLY);
        
        const result = await drizzle
          .insert(requests)
          .values({
            status: 'pending',
            ...requestData,
          })
          .returning();
        
        return result[0];
      }
    );
  }

  async updateRequestStatus(
    requestId: string,
    status: string,
    userId: string,
    adminId?: string
  ): Promise<any> {
    if (!userId) {
      throw new Error('user_id is required for multi-tenant data isolation');
    }
    // adminId reserved for future audit columns; tenant scope is userId
    void adminId;

    return await this.executeQuery(
      PoolType.WRITE_ONLY,
      async (client) => {
        // Raw SQL: production `requests.user_id` (drizzle schema is incomplete)
        const timestampColumn =
          status === 'approved'
            ? 'approved_at'
            : status === 'rejected'
              ? 'rejected_at'
              : status === 'played'
                ? 'played_at'
                : null;

        const result = timestampColumn
          ? await client.query(
              `UPDATE requests
               SET status = $2,
                   updated_at = NOW(),
                   ${timestampColumn} = NOW()
               WHERE id = $1 AND user_id = $3
               RETURNING *`,
              [requestId, status, userId]
            )
          : await client.query(
              `UPDATE requests
               SET status = $2, updated_at = NOW()
               WHERE id = $1 AND user_id = $3
               RETURNING *`,
              [requestId, status, userId]
            );

        return result.rows[0];
      }
    );
  }

  // Admin operations
  async getAdmin(username: string): Promise<any> {
    return await this.executeQuery(
      PoolType.READ_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.READ_ONLY);
        
        const result = await drizzle
          .select()
          .from(admins)
          .where(eq(admins.email, username))
          .limit(1);
        
        return result[0] || null;
      }
    );
  }

  async createAdmin(adminData: {
    email: string;
    password_hash: string;
    name?: string;
  }): Promise<any> {
    return await this.executeQuery(
      PoolType.WRITE_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.WRITE_ONLY);
        
        const result = await drizzle
          .insert(admins)
          .values(adminData)
          .returning();
        
        return result[0];
      }
    );
  }

  // Spotify operations
  async getSpotifyToken(adminId: string): Promise<any> {
    return await this.executeQuery(
      PoolType.READ_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.READ_ONLY);
        
        const result = await drizzle
          .select()
          .from(spotify_tokens)
          .where(eq(spotify_tokens.admin_id, adminId))
          .limit(1);
        
        return result[0] || null;
      }
    );
  }

  async upsertSpotifyToken(adminId: string, tokenData: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: Date;
    scope?: string;
  }): Promise<any> {
    return await this.executeQuery(
      PoolType.WRITE_ONLY,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.WRITE_ONLY);
        
        const result = await drizzle
          .insert(spotify_tokens)
          .values({
            admin_id: adminId,
            ...tokenData,
            updated_at: new Date(),
          })
          .onConflictDoUpdate({
            target: spotify_tokens.admin_id,
            set: {
              ...tokenData,
              updated_at: new Date(),
            },
          })
          .returning();
        
        return result[0];
      }
    );
  }

  // Analytics operations
  async getEventStats(eventId: string): Promise<any> {
    return await this.executeQuery(
      PoolType.ANALYTICS,
      async (client) => {
        const drizzle = getConnectionPoolManager().getDrizzle(PoolType.ANALYTICS);
        
        const stats = await drizzle
          .select({
            totalRequests: sql<number>`count(*)`,
            pendingRequests: sql<number>`count(*) filter (where status = 'pending')`,
            approvedRequests: sql<number>`count(*) filter (where status = 'approved')`,
            playedRequests: sql<number>`count(*) filter (where status = 'played')`,
          })
          .from(requests)
          .where(eq(requests.event_id, eventId));
        
        return stats[0];
      }
    );
  }

  // Transaction support
  async executeTransaction<T>(
    poolType: PoolType,
    operations: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return await executeWithPool(poolType, async (client) => {
      await client.query('BEGIN');
      try {
        const result = await operations(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  }

  // Generic query execution with retry logic
  private async executeQuery<T>(
    poolType: PoolType,
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await executeWithPool(poolType, operation);
        
        if (this.config.enablePerformanceMetrics) {
          const executionTime = Date.now() - startTime;
          this.queryCount++;
          this.totalQueryTime += executionTime;
        }
        
        if (this.config.enableQueryLogging) {
          console.log(`📊 [DB] Query executed in ${Date.now() - startTime}ms (attempt ${attempt})`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (this.config.enableQueryLogging) {
          console.error(`❌ [DB] Query failed (attempt ${attempt}/${this.config.maxRetries}):`, error);
        }
        
        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }
    
    this.errorCount++;
    throw lastError || new Error('Query failed after all retries');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Statistics and monitoring
  getStats(): DatabaseStats {
    const poolManager = getConnectionPoolManager();
    const poolHealth: Record<PoolType, boolean> = {};
    
    for (const poolType of Object.values(PoolType)) {
      poolHealth[poolType] = poolManager.isHealthy(poolType);
    }
    
    return {
      totalQueries: this.queryCount,
      averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      errorRate: this.queryCount > 0 ? this.errorCount / this.queryCount : 0,
      poolHealth,
    };
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const poolManager = getConnectionPoolManager();
      const stats = poolManager.getStats();
      
      const healthy = Array.from(stats.values()).every(stat => stat.health === 'healthy');
      
      return {
        healthy,
        details: {
          pools: Object.fromEntries(stats),
          serviceStats: this.getStats(),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
}

// Convenience functions
export const db = {
  // Event operations
  getEvent: (userId: string, eventId?: string) => getDatabaseService().getEvent(userId, eventId),
  createEvent: (eventData: Partial<Event>) => getDatabaseService().createEvent(eventData),
  updateEvent: (eventId: string, updates: Partial<Event>, userId: string) => getDatabaseService().updateEvent(eventId, updates, userId),
  updateEventStatus: (eventId: string, status: EventStatus, version: number, userId: string) => 
    getDatabaseService().updateEventStatus(eventId, status, version, userId),
  
  // Request operations
  getRequests: (eventId: string, limit?: number, offset?: number) => 
    getDatabaseService().getRequests(eventId, limit, offset),
  createRequest: (requestData: any) => getDatabaseService().createRequest(requestData),
  updateRequestStatus: (
    requestId: string,
    status: string,
    userId: string,
    adminId?: string
  ) => getDatabaseService().updateRequestStatus(requestId, status, userId, adminId),
  
  // Admin operations
  getAdmin: (username: string) => getDatabaseService().getAdmin(username),
  createAdmin: (adminData: any) => getDatabaseService().createAdmin(adminData),
  
  // Spotify operations
  getSpotifyToken: (adminId: string) => getDatabaseService().getSpotifyToken(adminId),
  upsertSpotifyToken: (adminId: string, tokenData: any) => 
    getDatabaseService().upsertSpotifyToken(adminId, tokenData),
  
  // Analytics
  getEventStats: (eventId: string) => getDatabaseService().getEventStats(eventId),
  
  // Service methods
  getStats: () => getDatabaseService().getStats(),
  healthCheck: () => getDatabaseService().healthCheck(),
};
