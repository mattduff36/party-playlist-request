import { Pool } from 'pg';
import { db, dbNode } from '../index';
import { events, admins, spotify_tokens, requests } from '../schema';
import { eq } from 'drizzle-orm';

interface MigrationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class DataMigration {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  async validateOldTables(): Promise<MigrationResult> {
    try {
      const tables = ['requests', 'settings', 'admins', 'spotify_auth', 'event_settings', 'oauth_sessions', 'notifications'];
      const results: any = {};

      for (const table of tables) {
        const result = await this.pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        results[table] = parseInt(result.rows[0].count);
      }

      return {
        success: true,
        message: 'Old tables validation completed',
        data: results
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate old tables',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async createBackupTables(): Promise<MigrationResult> {
    try {
      const tables = ['requests', 'settings', 'admins', 'spotify_auth', 'event_settings', 'oauth_sessions', 'notifications'];
      
      for (const table of tables) {
        await this.pool.query(`CREATE TABLE IF NOT EXISTS ${table}_backup AS SELECT * FROM ${table}`);
      }

      return {
        success: true,
        message: 'Backup tables created successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create backup tables',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async migrateEventsData(): Promise<MigrationResult> {
    try {
      // Get event settings and settings data
      const eventSettingsResult = await this.pool.query('SELECT * FROM event_settings WHERE id = 1');
      const settingsResult = await this.pool.query('SELECT * FROM settings');
      
      if (eventSettingsResult.rows.length === 0) {
        return {
          success: false,
          message: 'No event settings found to migrate'
        };
      }

      const es = eventSettingsResult.rows[0];
      const settings = settingsResult.rows.reduce((acc: any, row: any) => {
        acc[row.key] = row.value;
        return acc;
      }, {});

      // Determine event status
      const status = (es.requests_page_enabled && es.display_page_enabled) ? 'live' :
                    (!es.requests_page_enabled && !es.display_page_enabled) ? 'offline' : 'standby';

      // Create config object
      const config = {
        pages_enabled: {
          requests: es.requests_page_enabled || false,
          display: es.display_page_enabled || false
        },
        event_title: es.event_title || 'Party DJ Requests',
        dj_name: es.dj_name || '',
        venue_info: es.venue_info || '',
        welcome_message: es.welcome_message || 'Request your favorite songs!',
        secondary_message: es.secondary_message || 'Your requests will be reviewed by the DJ',
        tertiary_message: es.tertiary_message || 'Keep the party going!',
        show_qr_code: es.show_qr_code || true,
        request_limit: es.request_limit || 10,
        auto_approve: es.auto_approve || false,
        message_text: es.message_text,
        message_duration: es.message_duration,
        message_created_at: es.message_created_at,
        party_playlist_id: settings.party_playlist_id || '',
        target_device_id: settings.target_device_id || '',
        party_name: settings.party_name || 'Party DJ Requests',
        max_requests_per_ip_per_hour: settings.max_requests_per_ip_per_hour || '10',
        request_cooldown_seconds: settings.request_cooldown_seconds || '30'
      };

      // Insert event
      const [newEvent] = await db.insert(events).values({
        // Provide required fields per schema; fallback placeholders if needed
        status: status as any,
        version: 0 as any,
        config: config as any,
        updated_at: new Date(es.updated_at) as any
      } as any).returning();

      return {
        success: true,
        message: 'Events data migrated successfully',
        data: { eventId: newEvent.id, status }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to migrate events data',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async migrateAdminsData(): Promise<MigrationResult> {
    try {
      const adminsResult = await this.pool.query('SELECT * FROM admins');
      const migratedAdmins = [];

      for (const admin of adminsResult.rows) {
        const [newAdmin] = await db.insert(admins).values({
          email: admin.username, // Assuming username is email
          password_hash: admin.password_hash,
          name: admin.username, // Use username as name initially
          created_at: new Date(admin.created_at)
        }).returning();

        migratedAdmins.push(newAdmin);
      }

      return {
        success: true,
        message: `Migrated ${migratedAdmins.length} admin accounts`,
        data: migratedAdmins
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to migrate admins data',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async migrateSpotifyTokensData(): Promise<MigrationResult> {
    try {
      const spotifyResult = await this.pool.query('SELECT * FROM spotify_auth WHERE id = 1');
      
      if (spotifyResult.rows.length === 0) {
        return {
          success: true,
          message: 'No Spotify tokens to migrate'
        };
      }

      const spotify = spotifyResult.rows[0];
      
      // Get first admin to link tokens to
      const [firstAdmin] = await db.select().from(admins).limit(1);
      
      if (!firstAdmin) {
        return {
          success: false,
          message: 'No admin found to link Spotify tokens to'
        };
      }

      const [newToken] = await db.insert(spotify_tokens).values({
        admin_id: firstAdmin.id,
        access_token: spotify.access_token,
        refresh_token: spotify.refresh_token,
        expires_at: spotify.expires_at ? new Date(spotify.expires_at) : null,
        scope: spotify.scope,
        updated_at: new Date(spotify.updated_at)
      }).returning();

      // Update events table with active admin
      await db.update(events).set({ active_admin_id: firstAdmin.id });

      return {
        success: true,
        message: 'Spotify tokens migrated successfully',
        data: newToken
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to migrate Spotify tokens data',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async migrateRequestsData(): Promise<MigrationResult> {
    try {
      const requestsResult = await this.pool.query('SELECT * FROM requests ORDER BY created_at');
      const migratedRequests = [];

      // Get the event ID to link requests to
      const [event] = await db.select().from(events).limit(1);
      if (!event) {
        return {
          success: false,
          message: 'No event found to link requests to'
        };
      }

      for (const request of requestsResult.rows) {
        // Transform status
        let status = request.status;
        if (status === 'queued') status = 'approved';
        if (status === 'failed') status = 'rejected';

        // Create track data object
        const trackData = {
          id: request.track_uri,
          uri: request.track_uri,
          name: request.track_name,
          artists: [{ name: request.artist_name, id: '' }],
          album: {
            name: request.album_name || '',
            id: '',
            images: []
          },
          duration_ms: request.duration_ms,
          explicit: false,
          external_urls: { spotify: '' },
          preview_url: null
        };

        const [newRequest] = await db.insert(requests).values({
          event_id: event.id,
          track_id: request.track_uri,
          track_data: trackData as any,
          submitted_by: request.requester_nickname || 'Anonymous',
          status: status as any,
          idempotency_key: request.requester_ip_hash,
          created_at: new Date(request.created_at),
          approved_at: request.approved_at ? new Date(request.approved_at) : null,
          rejected_at: request.status === 'rejected' ? new Date(request.created_at) : null,
          played_at: request.status === 'played' && request.approved_at ? new Date(request.approved_at) : null
        }).returning();

        migratedRequests.push(newRequest);
      }

      return {
        success: true,
        message: `Migrated ${migratedRequests.length} requests`,
        data: { count: migratedRequests.length }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to migrate requests data',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async validateMigration(): Promise<MigrationResult> {
    try {
      const validation = {
        events: await db.select().from(events),
        admins: await db.select().from(admins),
        spotify_tokens: await db.select().from(spotify_tokens),
        requests: await db.select().from(requests)
      };

      const counts = {
        events: validation.events.length,
        admins: validation.admins.length,
        spotify_tokens: validation.spotify_tokens.length,
        requests: validation.requests.length
      };

      // Check data integrity
      const allRequestsHaveEventId = validation.requests.every(r => r.event_id);
      const allTokensHaveAdminId = validation.spotify_tokens.every(t => t.admin_id);
      const hasActiveEvent = validation.events.length > 0;

      return {
        success: allRequestsHaveEventId && allTokensHaveAdminId && hasActiveEvent,
        message: 'Migration validation completed',
        data: {
          counts,
          integrity: {
            allRequestsHaveEventId,
            allTokensHaveAdminId,
            hasActiveEvent
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate migration',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async runFullMigration(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    try {
      // Step 1: Validate old tables
      console.log('🔍 Validating old tables...');
      const validation = await this.validateOldTables();
      results.push(validation);
      if (!validation.success) throw new Error(validation.message);

      // Step 2: Create backups
      console.log('💾 Creating backup tables...');
      const backup = await this.createBackupTables();
      results.push(backup);
      if (!backup.success) throw new Error(backup.message);

      // Step 3: Migrate data
      console.log('🔄 Migrating events data...');
      const eventsResult = await this.migrateEventsData();
      results.push(eventsResult);
      if (!eventsResult.success) throw new Error(eventsResult.message);

      console.log('🔄 Migrating admins data...');
      const adminsResult = await this.migrateAdminsData();
      results.push(adminsResult);
      if (!adminsResult.success) throw new Error(adminsResult.message);

      console.log('🔄 Migrating Spotify tokens data...');
      const spotifyResult = await this.migrateSpotifyTokensData();
      results.push(spotifyResult);
      if (!spotifyResult.success) throw new Error(spotifyResult.message);

      console.log('🔄 Migrating requests data...');
      const requestsResult = await this.migrateRequestsData();
      results.push(requestsResult);
      if (!requestsResult.success) throw new Error(requestsResult.message);

      // Step 4: Validate migration
      console.log('✅ Validating migration...');
      const validationResult = await this.validateMigration();
      results.push(validationResult);
      if (!validationResult.success) throw new Error(validationResult.message);

      console.log('🎉 Migration completed successfully!');
      return results;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      results.push({
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return results;
    } finally {
      await this.pool.end();
    }
  }
}

// CLI interface
if (require.main === module) {
  const migration = new DataMigration();
  migration.runFullMigration()
    .then(results => {
      console.log('\n📊 Migration Results:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.success ? '✅' : '❌'} ${result.message}`);
        if (result.error) console.log(`   Error: ${result.error}`);
        if (result.data) console.log(`   Data:`, result.data);
      });
      process.exit(results.every(r => r.success) ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}
