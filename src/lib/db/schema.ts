import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - Multi-tenant user accounts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  display_name: text('display_name'),
  role: text('role').notNull().default('user'),
  active_session_id: text('active_session_id'),
  active_session_created_at: timestamp('active_session_created_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Events table - Core state management (now per-user)
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pin: text('pin').notNull().unique(),
  status: text('status', { 
    enum: ['offline', 'standby', 'live'] 
  }).notNull().default('offline'),
  config: jsonb('config').notNull().default('{}'),
  active_admin_id: uuid('active_admin_id').references(() => admins.id),
  version: integer('version').notNull().default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  device_id: text('device_id'),
});

// Admins table - Admin user management
export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  name: text('name'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Spotify tokens table - Spotify integration per admin
export const spotify_tokens = pgTable('spotify_tokens', {
  admin_id: uuid('admin_id').primaryKey().references(() => admins.id, { onDelete: 'cascade' }),
  access_token: text('access_token'),
  refresh_token: text('refresh_token'), // Will be encrypted
  expires_at: timestamp('expires_at', { withTimezone: true }),
  scope: text('scope'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Requests table - Song requests with full track data
export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_id: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  track_id: text('track_id').notNull(),
  track_data: jsonb('track_data').notNull(), // Full track information from Spotify
  submitted_by: text('submitted_by'),
  status: text('status', { 
    enum: ['pending', 'approved', 'rejected', 'played'] 
  }).notNull().default('pending'),
  idempotency_key: text('idempotency_key'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  rejected_at: timestamp('rejected_at', { withTimezone: true }),
  played_at: timestamp('played_at', { withTimezone: true }),
});

// Define relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  active_admin: one(admins, {
    fields: [events.active_admin_id],
    references: [admins.id],
  }),
  requests: many(requests),
}));

export const adminsRelations = relations(admins, ({ one, many }) => ({
  spotify_tokens: one(spotify_tokens),
  events: many(events),
}));

export const spotifyTokensRelations = relations(spotify_tokens, ({ one }) => ({
  admin: one(admins, {
    fields: [spotify_tokens.admin_id],
    references: [admins.id],
  }),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  event: one(events, {
    fields: [requests.event_id],
    references: [events.id],
  }),
}));

// Type exports for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
export type SpotifyToken = typeof spotify_tokens.$inferSelect;
export type NewSpotifyToken = typeof spotify_tokens.$inferInsert;
export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;

// Event status type
export type EventStatus = 'offline' | 'standby' | 'live';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'played';

// Track data interface for JSONB field
export interface TrackData {
  id: string;
  uri: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    id: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  duration_ms: number;
  explicit: boolean;
  preview_url?: string;
  external_urls: {
    spotify: string;
  };
}

// Event config interface for JSONB field
export interface EventConfig {
  pages_enabled: {
    requests: boolean;
    display: boolean;
  };
  event_title?: string;
  dj_name?: string;
  venue_info?: string;
  welcome_message?: string;
  secondary_message?: string;
  tertiary_message?: string;
  show_qr_code?: boolean;
  request_limit?: number;
  auto_approve?: boolean;
  decline_explicit?: boolean;
  message_text?: string;
  message_duration?: number;
  message_created_at?: string;
  // Display screen settings
  qr_boost_duration?: number;
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_tertiary_color?: string;
  show_scrolling_bar?: boolean;
  karaoke_mode?: boolean;
}
