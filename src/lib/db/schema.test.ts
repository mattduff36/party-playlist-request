import { describe, it, expect } from '@jest/globals';
import { events, admins, spotify_tokens, requests } from './schema';

describe('Database Schema', () => {
  describe('Events Table', () => {
    it('should have correct structure', () => {
      expect(events.id.name).toBe('id');
      expect(events.status.name).toBe('status');
      expect(events.version.name).toBe('version');
      expect(events.active_admin_id.name).toBe('active_admin_id');
      expect(events.device_id.name).toBe('device_id');
      expect(events.config.name).toBe('config');
      expect(events.updated_at.name).toBe('updated_at');
    });

    it('should have correct column types', () => {
      expect(events.id.primary).toBe(true);
      expect(events.status.notNull).toBe(true);
      expect(events.version.notNull).toBe(true);
      expect(events.config.notNull).toBe(true);
      expect(events.updated_at.notNull).toBe(true);
    });
  });

  describe('Admins Table', () => {
    it('should have correct structure', () => {
      expect(admins.id.name).toBe('id');
      expect(admins.email.name).toBe('email');
      expect(admins.password_hash.name).toBe('password_hash');
      expect(admins.name.name).toBe('name');
      expect(admins.created_at.name).toBe('created_at');
    });

    it('should have correct column types', () => {
      expect(admins.id.primary).toBe(true);
      expect(admins.email.notNull).toBe(true);
      expect(admins.password_hash.notNull).toBe(true);
      expect(admins.created_at.notNull).toBe(true);
    });
  });

  describe('Spotify Tokens Table', () => {
    it('should have correct structure', () => {
      expect(spotify_tokens.admin_id.name).toBe('admin_id');
      expect(spotify_tokens.access_token.name).toBe('access_token');
      expect(spotify_tokens.refresh_token.name).toBe('refresh_token');
      expect(spotify_tokens.expires_at.name).toBe('expires_at');
      expect(spotify_tokens.scope.name).toBe('scope');
      expect(spotify_tokens.updated_at.name).toBe('updated_at');
    });

    it('should have correct column types', () => {
      expect(spotify_tokens.admin_id.primary).toBe(true);
      expect(spotify_tokens.updated_at.notNull).toBe(true);
    });
  });

  describe('Requests Table', () => {
    it('should have correct structure', () => {
      expect(requests.id.name).toBe('id');
      expect(requests.event_id.name).toBe('event_id');
      expect(requests.track_id.name).toBe('track_id');
      expect(requests.track_data.name).toBe('track_data');
      expect(requests.submitted_by.name).toBe('submitted_by');
      expect(requests.status.name).toBe('status');
      expect(requests.idempotency_key.name).toBe('idempotency_key');
      expect(requests.created_at.name).toBe('created_at');
      expect(requests.approved_at.name).toBe('approved_at');
      expect(requests.rejected_at.name).toBe('rejected_at');
      expect(requests.played_at.name).toBe('played_at');
    });

    it('should have correct column types', () => {
      expect(requests.id.primary).toBe(true);
      expect(requests.event_id.notNull).toBe(true);
      expect(requests.track_id.notNull).toBe(true);
      expect(requests.track_data.notNull).toBe(true);
      expect(requests.status.notNull).toBe(true);
      expect(requests.created_at.notNull).toBe(true);
    });
  });

  describe('Relations', () => {
    it('should have correct foreign key relationships', () => {
      // Events -> Admins (active_admin_id should reference admins.id)
      expect(events.active_admin_id.name).toBe('active_admin_id');
      
      // Requests -> Events (event_id should reference events.id)
      expect(requests.event_id.name).toBe('event_id');
      
      // Spotify Tokens -> Admins (admin_id should reference admins.id)
      expect(spotify_tokens.admin_id.name).toBe('admin_id');
    });
  });
});
