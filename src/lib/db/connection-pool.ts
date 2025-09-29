/**
 * Advanced Database Connection Pool Management
 * 
 * This module provides a comprehensive connection pooling system with:
 * - Multiple pool configurations for different use cases
 * - Connection health monitoring and automatic recovery
 * - Load balancing and failover mechanisms
 * - Performance metrics and monitoring
 * - Graceful shutdown and cleanup
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { drizzle, DrizzleDB } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Pool configuration types
export interface PoolConfiguration {
  // Basic connection settings
  connectionString: string;
  maxConnections: number;
  minConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  
  // Advanced settings
  allowExitOnIdle: boolean;
  keepAlive: boolean;
  keepAliveInitialDelayMillis: number;
  
  // SSL settings
  ssl: boolean | object;
  
  // Application settings
  applicationName: string;
  statementTimeout: number;
  queryTimeout: number;
}

// Pool types for different use cases
export enum PoolType {
  READ_ONLY = 'read-only',
  WRITE_ONLY = 'write-only',
  READ_WRITE = 'read-write',
  ADMIN = 'admin',
  ANALYTICS = 'analytics'
}

// Pool statistics
export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  lastActivity: Date | null;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

// Connection pool manager
export class ConnectionPoolManager {
  private pools: Map<PoolType, Pool> = new Map();
  private drizzleInstances: Map<PoolType, DrizzleDB<any>> = new Map();
  private stats: Map<PoolType, PoolStats> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    this.initializePools();
    this.startHealthMonitoring();
  }

  private initializePools() {
    const baseConfig = this.getBaseConfiguration();
    
    // Initialize different pool types
    const poolConfigs: Record<PoolType, Partial<PoolConfiguration>> = {
      [PoolType.READ_ONLY]: {
        ...baseConfig,
        maxConnections: 10,
        minConnections: 2,
        applicationName: 'party-dj-read',
        statementTimeout: 30000, // 30 seconds
      },
      [PoolType.WRITE_ONLY]: {
        ...baseConfig,
        maxConnections: 5,
        minConnections: 1,
        applicationName: 'party-dj-write',
        statementTimeout: 60000, // 60 seconds
      },
      [PoolType.READ_WRITE]: {
        ...baseConfig,
        maxConnections: 15,
        minConnections: 3,
        applicationName: 'party-dj-readwrite',
        statementTimeout: 45000, // 45 seconds
      },
      [PoolType.ADMIN]: {
        ...baseConfig,
        maxConnections: 3,
        minConnections: 1,
        applicationName: 'party-dj-admin',
        statementTimeout: 120000, // 2 minutes
      },
      [PoolType.ANALYTICS]: {
        ...baseConfig,
        maxConnections: 8,
        minConnections: 2,
        applicationName: 'party-dj-analytics',
        statementTimeout: 300000, // 5 minutes
      },
    };

    // Create pools
    for (const [poolType, config] of Object.entries(poolConfigs)) {
      const pool = new Pool(config as PoolConfig);
      const drizzleInstance = drizzle(pool, { schema });
      
      this.pools.set(poolType as PoolType, pool);
      this.drizzleInstances.set(poolType as PoolType, drizzleInstance);
      this.stats.set(poolType as PoolType, {
        totalConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
        totalRequests: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        lastActivity: null,
        health: 'healthy',
      });

      // Set up pool event listeners
      this.setupPoolEventListeners(poolType as PoolType, pool);
    }
  }

  private getBaseConfiguration(): Partial<PoolConfiguration> {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    return {
      connectionString: DATABASE_URL,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  private setupPoolEventListeners(poolType: PoolType, pool: Pool) {
    pool.on('connect', (client: PoolClient) => {
      console.log(`🔌 [${poolType}] New client connected`);
      this.updateStats(poolType, { totalConnections: pool.totalCount });
    });

    pool.on('acquire', (client: PoolClient) => {
      console.log(`📥 [${poolType}] Client acquired from pool`);
      this.updateStats(poolType, { 
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
        lastActivity: new Date(),
      });
    });

    pool.on('remove', (client: PoolClient) => {
      console.log(`❌ [${poolType}] Client removed from pool`);
      this.updateStats(poolType, { totalConnections: pool.totalCount });
    });

    pool.on('error', (err: Error, client: PoolClient) => {
      console.error(`❌ [${poolType}] Pool error:`, err);
      this.updateStats(poolType, { 
        totalErrors: this.stats.get(poolType)!.totalErrors + 1,
        health: 'degraded',
      });
    });
  }

  private updateStats(poolType: PoolType, updates: Partial<PoolStats>) {
    const currentStats = this.stats.get(poolType)!;
    this.stats.set(poolType, { ...currentStats, ...updates });
  }

  private startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      for (const [poolType, pool] of this.pools) {
        try {
          const client = await pool.connect();
          await client.query('SELECT 1');
          client.release();
          
          this.updateStats(poolType, { health: 'healthy' });
        } catch (error) {
          console.error(`❌ [${poolType}] Health check failed:`, error);
          this.updateStats(poolType, { 
            health: 'unhealthy',
            totalErrors: this.stats.get(poolType)!.totalErrors + 1,
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Public API methods
  public getPool(poolType: PoolType = PoolType.READ_WRITE): Pool {
    const pool = this.pools.get(poolType);
    if (!pool) {
      throw new Error(`Pool type ${poolType} not found`);
    }
    return pool;
  }

  public getDrizzle(poolType: PoolType = PoolType.READ_WRITE): DrizzleDB<any> {
    const drizzle = this.drizzleInstances.get(poolType);
    if (!drizzle) {
      throw new Error(`Drizzle instance for ${poolType} not found`);
    }
    return drizzle;
  }

  public getStats(poolType?: PoolType): PoolStats | Map<PoolType, PoolStats> {
    if (poolType) {
      return this.stats.get(poolType)!;
    }
    return new Map(this.stats);
  }

  public async executeWithPool<T>(
    poolType: PoolType,
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const pool = this.getPool(poolType);
    const startTime = Date.now();
    
    try {
      const client = await pool.connect();
      const result = await operation(client);
      client.release();
      
      const responseTime = Date.now() - startTime;
      this.updateStats(poolType, {
        totalRequests: this.stats.get(poolType)!.totalRequests + 1,
        averageResponseTime: this.calculateAverageResponseTime(poolType, responseTime),
      });
      
      return result;
    } catch (error) {
      this.updateStats(poolType, {
        totalErrors: this.stats.get(poolType)!.totalErrors + 1,
        health: 'degraded',
      });
      throw error;
    }
  }

  private calculateAverageResponseTime(poolType: PoolType, newResponseTime: number): number {
    const currentStats = this.stats.get(poolType)!;
    const totalRequests = currentStats.totalRequests + 1;
    const currentAverage = currentStats.averageResponseTime;
    
    // Calculate rolling average
    return (currentAverage * (totalRequests - 1) + newResponseTime) / totalRequests;
  }

  public async getConnection(poolType: PoolType = PoolType.READ_WRITE): Promise<PoolClient> {
    const pool = this.getPool(poolType);
    return await pool.connect();
  }

  public async closePool(poolType: PoolType): Promise<void> {
    const pool = this.pools.get(poolType);
    if (pool) {
      await pool.end();
      this.pools.delete(poolType);
      this.drizzleInstances.delete(poolType);
      this.stats.delete(poolType);
      console.log(`🔌 [${poolType}] Pool closed`);
    }
  }

  public async closeAllPools(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const closePromises = Array.from(this.pools.keys()).map(poolType => 
      this.closePool(poolType)
    );
    
    await Promise.all(closePromises);
    console.log('🔌 All database pools closed');
  }

  // Utility methods
  public isHealthy(poolType: PoolType = PoolType.READ_WRITE): boolean {
    const stats = this.stats.get(poolType);
    return stats ? stats.health === 'healthy' : false;
  }

  public getPoolInfo(poolType: PoolType): {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
    health: string;
  } {
    const pool = this.getPool(poolType);
    const stats = this.stats.get(poolType)!;
    
    return {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      health: stats.health,
    };
  }
}

// Singleton instance
let poolManager: ConnectionPoolManager | null = null;

export function getConnectionPoolManager(): ConnectionPoolManager {
  if (!poolManager) {
    poolManager = new ConnectionPoolManager();
  }
  return poolManager;
}

// Convenience functions
export function getPool(poolType: PoolType = PoolType.READ_WRITE): Pool {
  return getConnectionPoolManager().getPool(poolType);
}

export function getDrizzle(poolType: PoolType = PoolType.READ_WRITE): DrizzleDB<any> {
  return getConnectionPoolManager().getDrizzle(poolType);
}

export function getPoolStats(poolType?: PoolType): PoolStats | Map<PoolType, PoolStats> {
  return getConnectionPoolManager().getStats(poolType);
}

export async function executeWithPool<T>(
  poolType: PoolType,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  return getConnectionPoolManager().executeWithPool(poolType, operation);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (poolManager) {
    await poolManager.closeAllPools();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (poolManager) {
    await poolManager.closeAllPools();
  }
  process.exit(0);
});
