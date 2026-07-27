import { sql } from 'drizzle-orm';
import { db } from './index';

/**
 * Database Indexing Strategy
 * 
 * This file contains all database indexes for optimal performance.
 * Indexes are designed for the specific query patterns in the application.
 */

export class DatabaseIndexer {
  /**
   * Create all performance indexes
   */
  static async createAllIndexes() {
    console.log('🔧 Creating database indexes...');
    
    const indexes = [
      // Events table indexes
      {
        name: 'idx_events_status',
        table: 'events',
        columns: ['status'],
        description: 'Fast lookup by event status (offline/standby/live)'
      },
      {
        name: 'idx_events_updated_at',
        table: 'events',
        columns: ['updated_at'],
        description: 'Fast ordering by update time for real-time sync'
      },
      {
        name: 'idx_events_active_admin',
        table: 'events',
        columns: ['active_admin_id'],
        description: 'Fast lookup of events by active admin'
      },
      {
        name: 'idx_events_status_updated',
        table: 'events',
        columns: ['status', 'updated_at'],
        description: 'Composite index for status-based queries with ordering'
      },

      // Admins table indexes
      {
        name: 'idx_admins_email',
        table: 'admins',
        columns: ['email'],
        description: 'Fast lookup by email (unique constraint)'
      },
      {
        name: 'idx_admins_created_at',
        table: 'admins',
        columns: ['created_at'],
        description: 'Fast ordering by creation time'
      },

      // Spotify tokens table indexes
      {
        name: 'idx_spotify_tokens_admin_id',
        table: 'spotify_tokens',
        columns: ['admin_id'],
        description: 'Fast lookup of tokens by admin (foreign key)'
      },
      {
        name: 'idx_spotify_tokens_expires_at',
        table: 'spotify_tokens',
        columns: ['expires_at'],
        description: 'Fast lookup of expiring tokens for refresh'
      },
      {
        name: 'idx_spotify_tokens_updated_at',
        table: 'spotify_tokens',
        columns: ['updated_at'],
        description: 'Fast ordering by update time'
      },

      // Requests table indexes (CRITICAL for performance)
      {
        name: 'idx_requests_event_id',
        table: 'requests',
        columns: ['event_id'],
        description: 'Fast lookup of requests by event (foreign key)'
      },
      {
        name: 'idx_requests_status',
        table: 'requests',
        columns: ['status'],
        description: 'CRITICAL: Fast lookup by request status (pending/approved/rejected/played)'
      },
      {
        name: 'idx_requests_created_at',
        table: 'requests',
        columns: ['created_at'],
        description: 'Fast ordering by creation time'
      },
      {
        name: 'idx_requests_event_status',
        table: 'requests',
        columns: ['event_id', 'status'],
        description: 'Composite index for event-specific status queries'
      },
      {
        name: 'idx_requests_event_created',
        table: 'requests',
        columns: ['event_id', 'created_at'],
        description: 'Composite index for event-specific time-based queries'
      },
      {
        name: 'idx_requests_status_created',
        table: 'requests',
        columns: ['status', 'created_at'],
        description: 'CRITICAL: Composite index for status-based time queries (Spotify watcher)'
      },
      {
        name: 'idx_requests_status_approved_at',
        table: 'requests',
        columns: ['status', 'approved_at'],
        description: 'CRITICAL: Optimize approved request queries ordered by approved_at'
      },
      {
        name: 'idx_requests_track_uri_status',
        table: 'requests',
        columns: ['track_uri', 'status'],
        description: 'CRITICAL: Fast lookup for duplicate checking and auto-mark as played'
      },
      {
        name: 'idx_requests_submitted_by',
        table: 'requests',
        columns: ['submitted_by'],
        description: 'Fast lookup by submitter name'
      },
      {
        name: 'idx_requests_idempotency_key',
        table: 'requests',
        columns: ['idempotency_key'],
        description: 'Fast lookup by idempotency key for duplicate prevention'
      },
      {
        name: 'idx_requests_approved_at',
        table: 'requests',
        columns: ['approved_at'],
        description: 'Fast ordering by approval time for queue management'
      },
      {
        name: 'idx_requests_played_at',
        table: 'requests',
        columns: ['played_at'],
        description: 'Fast ordering by play time for history'
      },

      // JSONB indexes for config and track_data
      {
        name: 'idx_events_config_pages_enabled',
        table: 'events',
        columns: ['config'],
        type: 'gin',
        expression: '(config->\'pages_enabled\')',
        description: 'GIN index for JSONB config queries on pages_enabled'
      },
      {
        name: 'idx_requests_track_data_name',
        table: 'requests',
        columns: ['track_data'],
        type: 'gin',
        expression: '(track_data->\'name\')',
        description: 'GIN index for track name searches in JSONB'
      },
      {
        name: 'idx_requests_track_data_artists',
        table: 'requests',
        columns: ['track_data'],
        type: 'gin',
        expression: '(track_data->\'artists\')',
        description: 'GIN index for artist searches in JSONB'
      },
      {
        name: 'idx_requests_track_data_album',
        table: 'requests',
        columns: ['track_data'],
        type: 'gin',
        expression: '(track_data->\'album\')',
        description: 'GIN index for album searches in JSONB'
      }
    ];

    const results = [];
    
    for (const index of indexes) {
      try {
        await this.createIndex(index);
        results.push({ ...index, status: 'created' });
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        results.push({ ...index, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Failed to create index: ${index.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`\n📊 Index creation summary: ${results.filter(r => r.status === 'created').length} created, ${results.filter(r => r.status === 'failed').length} failed`);
    
    return results;
  }

  /**
   * Create a single index
   */
  static async createIndex(indexDef: {
    name: string;
    table: string;
    columns: string[];
    type?: 'btree' | 'gin' | 'gist' | 'hash';
    expression?: string;
    description?: string;
  }) {
    const { name, table, columns, type = 'btree', expression } = indexDef;
    
    let indexSql: string;
    
    if (expression) {
      // GIN index for JSONB expressions
      indexSql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} USING ${type} ${expression}`;
    } else {
      // Regular B-tree index
      const columnsStr = columns.join(', ');
      indexSql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${table} (${columnsStr})`;
    }

    await db.execute(sql.raw(indexSql));
  }

  /**
   * Drop all indexes (for cleanup)
   */
  static async dropAllIndexes() {
    console.log('🗑️  Dropping all custom indexes...');
    
    const indexNames = [
      'idx_events_status',
      'idx_events_updated_at',
      'idx_events_active_admin',
      'idx_events_status_updated',
      'idx_admins_email',
      'idx_admins_created_at',
      'idx_spotify_tokens_admin_id',
      'idx_spotify_tokens_expires_at',
      'idx_spotify_tokens_updated_at',
      'idx_requests_event_id',
      'idx_requests_status',
      'idx_requests_created_at',
      'idx_requests_event_status',
      'idx_requests_event_created',
      'idx_requests_status_created',
      'idx_requests_status_approved_at', // NEW
      'idx_requests_track_uri_status', // NEW
      'idx_requests_submitted_by',
      'idx_requests_idempotency_key',
      'idx_requests_approved_at',
      'idx_requests_played_at',
      'idx_events_config_pages_enabled',
      'idx_requests_track_data_name',
      'idx_requests_track_data_artists',
      'idx_requests_track_data_album'
    ];

    const results = [];
    
    for (const indexName of indexNames) {
      try {
        await db.execute(sql.raw(`DROP INDEX IF EXISTS ${indexName}`));
        results.push({ name: indexName, status: 'dropped' });
        console.log(`✅ Dropped index: ${indexName}`);
      } catch (error) {
        results.push({ name: indexName, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
        console.log(`❌ Failed to drop index: ${indexName} - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`\n📊 Index drop summary: ${results.filter(r => r.status === 'dropped').length} dropped, ${results.filter(r => r.status === 'failed').length} failed`);
    
    return results;
  }

  /**
   * Analyze query performance
   */
  static async analyzePerformance() {
    console.log('📊 Analyzing database performance...');
    
    try {
      // Get index usage statistics
      const indexStats = await db.execute(sql.raw(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
      `));

      console.log('📈 Index Usage Statistics:');
      console.table(indexStats.rows);

      // Get table statistics
      const tableStats = await db.execute(sql.raw(`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
      `));

      console.log('\n📊 Table Statistics:');
      console.table(tableStats.rows);

      return {
        indexStats: indexStats.rows,
        tableStats: tableStats.rows
      };
    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get index recommendations based on query patterns
   */
  static getIndexRecommendations() {
    return {
      high_priority: [
        'idx_events_status - Critical for state management',
        'idx_requests_event_status - Most common query pattern',
        'idx_requests_created_at - Time-based ordering',
        'idx_spotify_tokens_admin_id - Foreign key performance'
      ],
      medium_priority: [
        'idx_requests_event_created - Event-specific time queries',
        'idx_requests_status_created - Status-based time queries',
        'idx_events_config_pages_enabled - JSONB config queries'
      ],
      low_priority: [
        'idx_requests_submitted_by - User-specific queries',
        'idx_requests_track_data_name - Track name searches',
        'idx_requests_idempotency_key - Duplicate prevention'
      ]
    };
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      DatabaseIndexer.createAllIndexes()
        .then(() => console.log('✅ All indexes created successfully'))
        .catch(error => {
          console.error('❌ Index creation failed:', error);
          process.exit(1);
        });
      break;
      
    case 'drop':
      DatabaseIndexer.dropAllIndexes()
        .then(() => console.log('✅ All indexes dropped successfully'))
        .catch(error => {
          console.error('❌ Index drop failed:', error);
          process.exit(1);
        });
      break;
      
    case 'analyze':
      DatabaseIndexer.analyzePerformance()
        .then(() => console.log('✅ Performance analysis completed'))
        .catch(error => {
          console.error('❌ Performance analysis failed:', error);
          process.exit(1);
        });
      break;
      
    case 'recommendations':
      console.log('📋 Index Recommendations:');
      console.log(JSON.stringify(DatabaseIndexer.getIndexRecommendations(), null, 2));
      break;
      
    default:
      console.log(`
Database Indexer

Usage: tsx indexes.ts <command>

Commands:
  create         Create all performance indexes
  drop           Drop all custom indexes
  analyze        Analyze current performance
  recommendations Show index recommendations

Examples:
  tsx indexes.ts create
  tsx indexes.ts analyze
      `);
  }
}
