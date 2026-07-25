export type SupportErrorLevel = 'error' | 'fatal';

export type SupportErrorSource =
  | 'api'
  | 'client'
  | 'spotify'
  | 'db'
  | 'pusher'
  | 'unknown';

/** Expected/recoverable failures vs true production issues. */
export type SupportErrorClassification = 'handled' | 'unhandled';

export type SupportActorRole = 'guest' | 'admin' | 'superadmin' | 'system';

export interface LogErrorInput {
  level?: SupportErrorLevel;
  source?: SupportErrorSource;
  /** Override auto-classification (429/auth → handled, else unhandled). */
  classification?: SupportErrorClassification;
  message: string;
  stack?: string | null;
  route?: string | null;
  method?: string | null;
  userId?: string | null;
  username?: string | null;
  eventId?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface LogActivityInput {
  action: string;
  actorRole: SupportActorRole;
  summary: string;
  userId?: string | null;
  username?: string | null;
  eventId?: string | null;
  route?: string | null;
  ipHash?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface SupportErrorRow {
  id: string;
  created_at: string;
  level: SupportErrorLevel;
  source: SupportErrorSource;
  message: string;
  stack: string | null;
  route: string | null;
  method: string | null;
  user_id: string | null;
  username: string | null;
  event_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  meta: Record<string, unknown> | null;
  fingerprint: string | null;
  occurrence_count: number;
  last_seen_at: string | null;
  classification: SupportErrorClassification;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface SupportActivityRow {
  id: string;
  created_at: string;
  action: string;
  actor_role: SupportActorRole;
  user_id: string | null;
  username: string | null;
  event_id: string | null;
  route: string | null;
  ip_hash: string | null;
  summary: string;
  meta: Record<string, unknown> | null;
}
