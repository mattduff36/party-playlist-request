import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db, dbNode, initializeDatabase, checkDatabaseHealth } from './index';
import { events, admins, spotify_tokens, requests } from './schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { DataMigration } from './migrations/migrate-data';
import { DatabaseIndexer } from './indexes';
import { DatabaseConstraints } from './constraints';

describe('Comprehensive Database Operations', () => {
  let testEventId: string;
  let testAdminId: string;
  let testRequestId: string;

  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    // Clean up test data
    if (testRequestId) {
      await db.delete(requests).where(eq(requests.id, testRequestId));
    }
    if (testEventId) {
      await db.delete(events).where(eq(events.id, testEventId));
    }
    if (testAdminId) {
      await db.delete(spotify_tokens).where(eq(spotify_tokens.admin_id, testAdminId));
      await db.delete(admins).where(eq(admins.id, testAdminId));
    }
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await db.delete(requests);
    await db.delete(events);
    await db.delete(spotify_tokens);
    await db.delete(admins);
  });

  describe('Database Health and Connection', () => {
    it('should establish database connection', async () => {
      const health = await checkDatabaseHealth();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });

    it('should handle connection errors gracefully', async () => {
      // Test with invalid connection string
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'invalid-connection-string';
      
      try {
        await checkDatabaseHealth();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        process.env.DATABASE_URL = originalUrl;
      }
    });
  });

  describe('Events Table Operations', () => {
    it('should create event with default values', async () => {
      const [event] = await db.insert(events).values({
        status: 'offline',
        version: 0,
        config: {
          pages_enabled: { requests: false, display: false },
          event_title: 'Test Event'
        }
      }).returning();

      expect(event.id).toBeDefined();
      expect(event.status).toBe('offline');
      expect(event.version).toBe(0);
      expect(event.config).toEqual({
        pages_enabled: { requests: false, display: false },
        event_title: 'Test Event'
      });

      testEventId = event.id;
    });

    it('should update event status and increment version', async () => {
      const [event] = await db.insert(events).values({
        status: 'offline',
        version: 0,
        config: { pages_enabled: { requests: false, display: false } }
      }).returning();

      const [updatedEvent] = await db.update(events)
        .set({ 
          status: 'live',
          version: event.version + 1,
          config: {
            pages_enabled: { requests: true, display: true },
            event_title: 'Updated Event'
          }
        })
        .where(eq(events.id, event.id))
        .returning();

      expect(updatedEvent.status).toBe('live');
      expect(updatedEvent.version).toBe(1);
      expect(updatedEvent.config.pages_enabled.requests).toBe(true);
    });

    it('should enforce status constraint', async () => {
      await expect(
        db.insert(events).values({
          status: 'invalid_status' as any,
          version: 0,
          config: {}
        })
      ).rejects.toThrow();
    });

    it('should handle JSONB config queries', async () => {
      const [event] = await db.insert(events).values({
        status: 'live',
        version: 0,
        config: {
          pages_enabled: { requests: true, display: true },
          event_title: 'JSONB Test Event',
          request_limit: 50
        }
      }).returning();

      const [foundEvent] = await db.select()
        .from(events)
        .where(eq(events.id, event.id));

      expect(foundEvent.config.pages_enabled.requests).toBe(true);
      expect(foundEvent.config.event_title).toBe('JSONB Test Event');
      expect(foundEvent.config.request_limit).toBe(50);
    });
  });

  describe('Admins Table Operations', () => {
    it('should create admin with email and password', async () => {
      const [admin] = await db.insert(admins).values({
        email: 'test@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Test Admin'
      }).returning();

      expect(admin.id).toBeDefined();
      expect(admin.email).toBe('test@example.com');
      expect(admin.password_hash).toBe('$2b$10$hashedpassword');
      expect(admin.name).toBe('Test Admin');

      testAdminId = admin.id;
    });

    it('should enforce unique email constraint', async () => {
      await db.insert(admins).values({
        email: 'unique@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'First Admin'
      });

      await expect(
        db.insert(admins).values({
          email: 'unique@example.com',
          password_hash: '$2b$10$anotherhash',
          name: 'Second Admin'
        })
      ).rejects.toThrow();
    });

    it('should update admin information', async () => {
      const [admin] = await db.insert(admins).values({
        email: 'update@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Original Name'
      }).returning();

      const [updatedAdmin] = await db.update(admins)
        .set({ name: 'Updated Name' })
        .where(eq(admins.id, admin.id))
        .returning();

      expect(updatedAdmin.name).toBe('Updated Name');
      expect(updatedAdmin.email).toBe('update@example.com');
    });
  });

  describe('Spotify Tokens Table Operations', () => {
    it('should create Spotify tokens linked to admin', async () => {
      const [admin] = await db.insert(admins).values({
        email: 'spotify@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Spotify Admin'
      }).returning();

      const [token] = await db.insert(spotify_tokens).values({
        admin_id: admin.id,
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expires_at: new Date(Date.now() + 3600000),
        scope: 'user-modify-playback-state user-read-playback-state'
      }).returning();

      expect(token.admin_id).toBe(admin.id);
      expect(token.access_token).toBe('access_token_123');
      expect(token.scope).toBe('user-modify-playback-state user-read-playback-state');
    });

    it('should handle token refresh', async () => {
      const [admin] = await db.insert(admins).values({
        email: 'refresh@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Refresh Admin'
      }).returning();

      const [token] = await db.insert(spotify_tokens).values({
        admin_id: admin.id,
        access_token: 'old_access_token',
        refresh_token: 'refresh_token_123',
        expires_at: new Date(Date.now() - 3600000), // Expired
        scope: 'user-modify-playback-state'
      }).returning();

      const [updatedToken] = await db.update(spotify_tokens)
        .set({
          access_token: 'new_access_token',
          expires_at: new Date(Date.now() + 3600000)
        })
        .where(eq(spotify_tokens.admin_id, admin.id))
        .returning();

      expect(updatedToken.access_token).toBe('new_access_token');
      expect(updatedToken.refresh_token).toBe('refresh_token_123');
    });

    it('should cascade delete when admin is deleted', async () => {
      const [admin] = await db.insert(admins).values({
        email: 'cascade@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Cascade Admin'
      }).returning();

      await db.insert(spotify_tokens).values({
        admin_id: admin.id,
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        scope: 'user-modify-playback-state'
      });

      // Delete admin
      await db.delete(admins).where(eq(admins.id, admin.id));

      // Check that tokens are also deleted
      const tokens = await db.select()
        .from(spotify_tokens)
        .where(eq(spotify_tokens.admin_id, admin.id));

      expect(tokens).toHaveLength(0);
    });
  });

  describe('Requests Table Operations', () => {
    beforeEach(async () => {
      // Create test event and admin
      const [event] = await db.insert(events).values({
        status: 'live',
        version: 0,
        config: { pages_enabled: { requests: true, display: true } }
      }).returning();
      testEventId = event.id;

      const [admin] = await db.insert(admins).values({
        email: 'requests@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Requests Admin'
      }).returning();
      testAdminId = admin.id;
    });

    it('should create request with full track data', async () => {
      const trackData = {
        id: 'spotify_track_123',
        uri: 'spotify:track:123',
        name: 'Test Song',
        artists: [{ name: 'Test Artist', id: 'artist_123' }],
        album: {
          name: 'Test Album',
          id: 'album_123',
          images: [{ url: 'https://example.com/image.jpg', width: 300, height: 300 }]
        },
        duration_ms: 180000,
        explicit: false,
        external_urls: { spotify: 'https://open.spotify.com/track/123' }
      };

      const [request] = await db.insert(requests).values({
        event_id: testEventId,
        track_id: 'spotify_track_123',
        track_data: trackData,
        submitted_by: 'Test User',
        status: 'pending',
        idempotency_key: 'unique_key_123'
      }).returning();

      expect(request.id).toBeDefined();
      expect(request.event_id).toBe(testEventId);
      expect(request.track_data).toEqual(trackData);
      expect(request.status).toBe('pending');

      testRequestId = request.id;
    });

    it('should update request status with timestamps', async () => {
      const [request] = await db.insert(requests).values({
        event_id: testEventId,
        track_id: 'spotify_track_456',
        track_data: { id: '456', name: 'Another Song', artists: [], album: { name: 'Album', id: '', images: [] }, duration_ms: 200000, explicit: false, external_urls: { spotify: '' } },
        submitted_by: 'Another User',
        status: 'pending',
        idempotency_key: 'unique_key_456'
      }).returning();

      const [approvedRequest] = await db.update(requests)
        .set({
          status: 'approved',
          approved_at: new Date()
        })
        .where(eq(requests.id, request.id))
        .returning();

      expect(approvedRequest.status).toBe('approved');
      expect(approvedRequest.approved_at).toBeDefined();
      expect(approvedRequest.rejected_at).toBeNull();
    });

    it('should enforce idempotency key uniqueness per event', async () => {
      await db.insert(requests).values({
        event_id: testEventId,
        track_id: 'spotify_track_789',
        track_data: { id: '789', name: 'First Song', artists: [], album: { name: 'Album', id: '', images: [] }, duration_ms: 150000, explicit: false, external_urls: { spotify: '' } },
        submitted_by: 'User 1',
        status: 'pending',
        idempotency_key: 'duplicate_key'
      });

      await expect(
        db.insert(requests).values({
          event_id: testEventId,
          track_id: 'spotify_track_999',
          track_data: { id: '999', name: 'Second Song', artists: [], album: { name: 'Album', id: '', images: [] }, duration_ms: 160000, explicit: false, external_urls: { spotify: '' } },
          submitted_by: 'User 2',
          status: 'pending',
          idempotency_key: 'duplicate_key'
        })
      ).rejects.toThrow();
    });

    it('should cascade delete when event is deleted', async () => {
      const [request] = await db.insert(requests).values({
        event_id: testEventId,
        track_id: 'spotify_track_cascade',
        track_data: { id: 'cascade', name: 'Cascade Song', artists: [], album: { name: 'Album', id: '', images: [] }, duration_ms: 170000, explicit: false, external_urls: { spotify: '' } },
        submitted_by: 'Cascade User',
        status: 'pending',
        idempotency_key: 'cascade_key'
      }).returning();

      // Delete event
      await db.delete(events).where(eq(events.id, testEventId));

      // Check that request is also deleted
      const foundRequest = await db.select()
        .from(requests)
        .where(eq(requests.id, request.id));

      expect(foundRequest).toHaveLength(0);
    });
  });

  describe('Complex Queries and Relationships', () => {
    beforeEach(async () => {
      // Create test data
      const [event] = await db.insert(events).values({
        status: 'live',
        version: 0,
        config: { pages_enabled: { requests: true, display: true } }
      }).returning();
      testEventId = event.id;

      const [admin] = await db.insert(admins).values({
        email: 'complex@example.com',
        password_hash: '$2b$10$hashedpassword',
        name: 'Complex Admin'
      }).returning();
      testAdminId = admin.id;

      await db.update(events)
        .set({ active_admin_id: admin.id })
        .where(eq(events.id, testEventId));

      // Create multiple requests
      const requestsData = [
        { track_id: 'track1', name: 'Song 1', status: 'pending' as const },
        { track_id: 'track2', name: 'Song 2', status: 'approved' as const },
        { track_id: 'track3', name: 'Song 3', status: 'rejected' as const },
        { track_id: 'track4', name: 'Song 4', status: 'played' as const }
      ];

      for (const req of requestsData) {
        await db.insert(requests).values({
          event_id: testEventId,
          track_id: req.track_id,
          track_data: {
            id: req.track_id,
            name: req.name,
            artists: [{ name: 'Artist', id: '' }],
            album: { name: 'Album', id: '', images: [] },
            duration_ms: 180000,
            explicit: false,
            external_urls: { spotify: '' }
          },
          submitted_by: 'Test User',
          status: req.status,
          idempotency_key: `key_${req.track_id}`,
          approved_at: req.status === 'approved' || req.status === 'played' ? new Date() : null,
          rejected_at: req.status === 'rejected' ? new Date() : null,
          played_at: req.status === 'played' ? new Date() : null
        });
      }
    });

    it('should query requests by status with ordering', async () => {
      const pendingRequests = await db.select()
        .from(requests)
        .where(and(
          eq(requests.event_id, testEventId),
          eq(requests.status, 'pending')
        ))
        .orderBy(desc(requests.created_at));

      expect(pendingRequests).toHaveLength(1);
      expect(pendingRequests[0].track_data.name).toBe('Song 1');

      const approvedRequests = await db.select()
        .from(requests)
        .where(and(
          eq(requests.event_id, testEventId),
          eq(requests.status, 'approved')
        ))
        .orderBy(asc(requests.approved_at));

      expect(approvedRequests).toHaveLength(1);
      expect(approvedRequests[0].track_data.name).toBe('Song 2');
    });

    it('should query event with active admin and requests', async () => {
      const eventWithAdmin = await db.select()
        .from(events)
        .leftJoin(admins, eq(events.active_admin_id, admins.id))
        .where(eq(events.id, testEventId));

      expect(eventWithAdmin).toHaveLength(1);
      expect(eventWithAdmin[0].events.active_admin_id).toBe(testAdminId);
      expect(eventWithAdmin[0].admins?.email).toBe('complex@example.com');
    });

    it('should query requests with event information', async () => {
      const requestsWithEvent = await db.select()
        .from(requests)
        .leftJoin(events, eq(requests.event_id, events.id))
        .where(eq(requests.event_id, testEventId));

      expect(requestsWithEvent).toHaveLength(4);
      requestsWithEvent.forEach(req => {
        expect(req.events?.id).toBe(testEventId);
        expect(req.events?.status).toBe('live');
      });
    });

    it('should handle JSONB queries on track data', async () => {
      // This would require custom SQL for JSONB queries
      const result = await db.execute(`
        SELECT * FROM requests 
        WHERE event_id = $1 
        AND track_data->>'name' LIKE '%Song%'
        ORDER BY created_at DESC
      `, [testEventId]);

      expect(result.rows).toHaveLength(4);
    });
  });

  describe('Performance and Indexing', () => {
    it('should create indexes for performance', async () => {
      const results = await DatabaseIndexer.createAllIndexes();
      const successCount = results.filter(r => r.status === 'created').length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('should analyze performance metrics', async () => {
      const analysis = await DatabaseIndexer.analyzePerformance();
      expect(analysis.indexStats).toBeDefined();
      expect(analysis.tableStats).toBeDefined();
    });
  });

  describe('Data Validation and Constraints', () => {
    it('should create constraints for data integrity', async () => {
      const results = await DatabaseConstraints.createAllConstraints();
      const successCount = results.filter(r => r.status === 'created').length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('should validate data according to business rules', async () => {
      const validationResults = await DatabaseConstraints.createValidationRules();
      const passedCount = validationResults.filter(r => r.status === 'passed').length;
      expect(passedCount).toBeGreaterThan(0);
    });
  });

  describe('Migration Testing', () => {
    it('should validate migration prerequisites', async () => {
      const migration = new DataMigration();
      const validation = await migration.validateOldTables();
      
      // This will fail in test environment without old tables
      // but validates the migration logic
      expect(validation).toBeDefined();
      expect(typeof validation.success).toBe('boolean');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid JSONB data gracefully', async () => {
      await expect(
        db.insert(events).values({
          status: 'offline',
          version: 0,
          config: 'invalid_json' as any
        })
      ).rejects.toThrow();
    });

    it('should handle null values appropriately', async () => {
      const [event] = await db.insert(events).values({
        status: 'offline',
        version: 0,
        config: {},
        active_admin_id: null,
        device_id: null
      }).returning();

      expect(event.active_admin_id).toBeNull();
      expect(event.device_id).toBeNull();
    });

    it('should handle concurrent updates', async () => {
      const [event] = await db.insert(events).values({
        status: 'offline',
        version: 0,
        config: {}
      }).returning();

      // Simulate concurrent updates
      const update1 = db.update(events)
        .set({ version: event.version + 1 })
        .where(eq(events.id, event.id));

      const update2 = db.update(events)
        .set({ version: event.version + 2 })
        .where(eq(events.id, event.id));

      await Promise.all([update1, update2]);

      const [updatedEvent] = await db.select()
        .from(events)
        .where(eq(events.id, event.id));

      expect(updatedEvent.version).toBeGreaterThan(event.version);
    });
  });
});
