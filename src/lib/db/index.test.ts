import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db, dbNode, initializeDatabase, checkDatabaseHealth } from './index';
import { events, admins, spotify_tokens, requests } from './schema';
import { eq } from 'drizzle-orm';

describe('Database Operations', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(requests);
    await db.delete(events);
    await db.delete(spotify_tokens);
    await db.delete(admins);
  });

  describe('Database Connection', () => {
    it('should establish database connection', async () => {
      const health = await checkDatabaseHealth();
      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('Events Table', () => {
    it('should create and read events', async () => {
      const newEvent = {
        status: 'offline' as const,
        version: 0,
        config: {
          pages_enabled: {
            requests: false,
            display: false,
          },
          event_title: 'Test Event',
        },
      };

      const [createdEvent] = await db.insert(events).values(newEvent).returning();
      expect(createdEvent.id).toBeDefined();
      expect(createdEvent.status).toBe('offline');
      expect(createdEvent.version).toBe(0);

      const [retrievedEvent] = await db.select().from(events).where(eq(events.id, createdEvent.id));
      expect(retrievedEvent).toEqual(createdEvent);
    });

    it('should update event status', async () => {
      const [event] = await db.select().from(events).limit(1);
      expect(event).toBeDefined();

      const updatedEvent = await db
        .update(events)
        .set({ 
          status: 'live', 
          version: event.version + 1,
          config: {
            ...event.config as any,
            pages_enabled: {
              requests: true,
              display: true,
            },
          },
        })
        .where(eq(events.id, event.id))
        .returning();

      expect(updatedEvent[0].status).toBe('live');
      expect(updatedEvent[0].version).toBe(event.version + 1);
    });
  });

  describe('Admins Table', () => {
    it('should create and read admins', async () => {
      const newAdmin = {
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test Admin',
      };

      const [createdAdmin] = await db.insert(admins).values(newAdmin).returning();
      expect(createdAdmin.id).toBeDefined();
      expect(createdAdmin.email).toBe('test@example.com');

      const [retrievedAdmin] = await db.select().from(admins).where(eq(admins.id, createdAdmin.id));
      expect(retrievedAdmin).toEqual(createdAdmin);
    });

    it('should enforce unique email constraint', async () => {
      const duplicateAdmin = {
        email: 'test@example.com', // Same email as previous test
        password_hash: 'another_hash',
        name: 'Another Admin',
      };

      await expect(
        db.insert(admins).values(duplicateAdmin)
      ).rejects.toThrow();
    });
  });

  describe('Spotify Tokens Table', () => {
    it('should create and read spotify tokens', async () => {
      // First create an admin
      const [admin] = await db.select().from(admins).limit(1);
      expect(admin).toBeDefined();

      const newToken = {
        admin_id: admin.id,
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expires_at: new Date(Date.now() + 3600000), // 1 hour from now
        scope: 'user-modify-playback-state user-read-playback-state',
      };

      const [createdToken] = await db.insert(spotify_tokens).values(newToken).returning();
      expect(createdToken.admin_id).toBe(admin.id);
      expect(createdToken.access_token).toBe('access_token_123');

      const [retrievedToken] = await db
        .select()
        .from(spotify_tokens)
        .where(eq(spotify_tokens.admin_id, admin.id));
      expect(retrievedToken).toEqual(createdToken);
    });
  });

  describe('Requests Table', () => {
    it('should create and read requests', async () => {
      // Get an existing event
      const [event] = await db.select().from(events).limit(1);
      expect(event).toBeDefined();

      const trackData = {
        id: 'spotify_track_123',
        uri: 'spotify:track:123',
        name: 'Test Song',
        artists: [{ name: 'Test Artist', id: 'artist_123' }],
        album: {
          name: 'Test Album',
          id: 'album_123',
          images: [{ url: 'https://example.com/image.jpg', width: 300, height: 300 }],
        },
        duration_ms: 180000,
        explicit: false,
        external_urls: {
          spotify: 'https://open.spotify.com/track/123',
        },
      };

      const newRequest = {
        event_id: event.id,
        track_id: 'spotify_track_123',
        track_data: trackData,
        submitted_by: 'Test User',
        status: 'pending' as const,
        idempotency_key: 'unique_key_123',
      };

      const [createdRequest] = await db.insert(requests).values(newRequest).returning();
      expect(createdRequest.id).toBeDefined();
      expect(createdRequest.event_id).toBe(event.id);
      expect(createdRequest.status).toBe('pending');

      const [retrievedRequest] = await db
        .select()
        .from(requests)
        .where(eq(requests.id, createdRequest.id));
      expect(retrievedRequest).toEqual(createdRequest);
    });

    it('should update request status', async () => {
      const [request] = await db.select().from(requests).limit(1);
      expect(request).toBeDefined();

      const updatedRequest = await db
        .update(requests)
        .set({ 
          status: 'approved',
          approved_at: new Date(),
        })
        .where(eq(requests.id, request.id))
        .returning();

      expect(updatedRequest[0].status).toBe('approved');
      expect(updatedRequest[0].approved_at).toBeDefined();
    });
  });

  describe('Relations', () => {
    it('should handle cascading deletes', async () => {
      // Create an event with an admin
      const [admin] = await db.select().from(admins).limit(1);
      const [event] = await db.select().from(events).limit(1);
      
      // Update event to have active admin
      await db.update(events).set({ active_admin_id: admin.id }).where(eq(events.id, event.id));

      // Create a request for this event
      const trackData = {
        id: 'spotify_track_456',
        uri: 'spotify:track:456',
        name: 'Another Test Song',
        artists: [{ name: 'Another Artist', id: 'artist_456' }],
        album: {
          name: 'Another Album',
          id: 'album_456',
          images: [],
        },
        duration_ms: 200000,
        explicit: false,
        external_urls: {
          spotify: 'https://open.spotify.com/track/456',
        },
      };

      const [request] = await db.insert(requests).values({
        event_id: event.id,
        track_id: 'spotify_track_456',
        track_data: trackData,
        submitted_by: 'Another User',
        status: 'pending',
        idempotency_key: 'unique_key_456',
      }).returning();

      // Delete the event - should cascade delete the request
      await db.delete(events).where(eq(events.id, event.id));

      // Verify request was deleted
      const [deletedRequest] = await db
        .select()
        .from(requests)
        .where(eq(requests.id, request.id));
      expect(deletedRequest).toBeUndefined();
    });
  });
});
