import { kv } from '@vercel/kv';
import crypto from 'crypto';

export interface Request {
  id: string;
  track_uri: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  requester_ip_hash: string;
  requester_nickname?: string;
  status: 'pending' | 'approved' | 'rejected' | 'queued' | 'failed';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
  spotify_added_to_queue: boolean;
  spotify_added_to_playlist: boolean;
}

export interface Settings {
  [key: string]: string;
}

export interface Admin {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface SpotifyAuth {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  token_type: string;
  updated_at: string;
}

// Key generators
const requestKey = (id: string) => `request:${id}`;
const requestsByStatusKey = (status: string) => `requests_by_status:${status}`;
const allRequestsKey = () => 'all_requests';
const settingsKey = (key: string) => `setting:${key}`;
const adminKey = (id: string) => `admin:${id}`;
const spotifyAuthKey = () => 'spotify_auth';

// Request operations
export async function createRequest(request: Omit<Request, 'id' | 'created_at'>): Promise<Request> {
  const id = crypto.randomUUID();
  const newRequest: Request = {
    ...request,
    id,
    created_at: new Date().toISOString(),
    spotify_added_to_queue: false,
    spotify_added_to_playlist: false,
  };

  // Store the request
  await kv.set(requestKey(id), newRequest);
  
  // Add to status index
  await kv.sadd(requestsByStatusKey(request.status), id);
  
  // Add to all requests index
  await kv.sadd(allRequestsKey(), id);

  return newRequest;
}

export async function getRequest(id: string): Promise<Request | null> {
  return await kv.get(requestKey(id));
}

export async function updateRequest(id: string, updates: Partial<Request>): Promise<Request | null> {
  const existing = await getRequest(id);
  if (!existing) return null;

  // If status is changing, update indexes
  if (updates.status && updates.status !== existing.status) {
    await kv.srem(requestsByStatusKey(existing.status), id);
    await kv.sadd(requestsByStatusKey(updates.status), id);
  }

  const updated = { ...existing, ...updates };
  await kv.set(requestKey(id), updated);
  return updated;
}

export async function getRequestsByStatus(status: string, limit = 50, offset = 0): Promise<Request[]> {
  const requestIds = await kv.smembers(requestsByStatusKey(status));
  const requests = await Promise.all(
    requestIds.slice(offset, offset + limit).map(id => getRequest(id as string))
  );
  return requests.filter(Boolean) as Request[];
}

export async function getAllRequests(limit = 50, offset = 0): Promise<Request[]> {
  const requestIds = await kv.smembers(allRequestsKey());
  const requests = await Promise.all(
    requestIds.slice(offset, offset + limit).map(id => getRequest(id as string))
  );
  return (requests.filter(Boolean) as Request[]).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getRequestsCount(): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
  const [total, pending, approved, rejected] = await Promise.all([
    kv.scard(allRequestsKey()),
    kv.scard(requestsByStatusKey('pending')),
    kv.scard(requestsByStatusKey('approved')),
    kv.scard(requestsByStatusKey('rejected')),
  ]);

  return { total, pending, approved, rejected };
}

// Settings operations
export async function getSetting(key: string): Promise<string | null> {
  return await kv.get(settingsKey(key));
}

export async function setSetting(key: string, value: string): Promise<void> {
  await kv.set(settingsKey(key), value);
}

export async function getAllSettings(): Promise<Settings> {
  const keys = ['party_playlist_id', 'target_device_id', 'admin_password_hash', 'party_name'];
  const values = await Promise.all(keys.map(key => getSetting(key)));
  
  const settings: Settings = {};
  keys.forEach((key, index) => {
    if (values[index]) {
      settings[key] = values[index]!;
    }
  });
  
  return settings;
}

// Admin operations
export async function getAdmin(username: string): Promise<Admin | null> {
  return await kv.get(adminKey(username));
}

export async function createAdmin(admin: Admin): Promise<void> {
  await kv.set(adminKey(admin.username), admin);
}

export async function updateAdminLastLogin(username: string): Promise<void> {
  const admin = await getAdmin(username);
  if (admin) {
    await kv.set(adminKey(username), {
      ...admin,
      last_login: new Date().toISOString(),
    });
  }
}

// Spotify auth operations
export async function getSpotifyAuth(): Promise<SpotifyAuth | null> {
  return await kv.get(spotifyAuthKey());
}

export async function setSpotifyAuth(auth: SpotifyAuth): Promise<void> {
  await kv.set(spotifyAuthKey(), {
    ...auth,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteSpotifyAuth(): Promise<void> {
  await kv.del(spotifyAuthKey());
}

// Utility functions
export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.IP_SALT || 'default-salt')).digest('hex');
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

// Initialize default data
export async function initializeDefaults(): Promise<void> {
  // Set default settings if they don't exist
  const defaultSettings = {
    party_playlist_id: '',
    target_device_id: '',
    party_name: 'Party DJ Requests',
    max_requests_per_ip_per_hour: '10',
    request_cooldown_seconds: '30',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await getSetting(key);
    if (!existing) {
      await setSetting(key, value);
    }
  }

  // Create default admin if it doesn't exist and password is provided
  const existingAdmin = await getAdmin('admin');
  if (!existingAdmin && process.env.ADMIN_PASSWORD) {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    
    await createAdmin({
      id: 'admin-001',
      username: 'admin',
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      is_active: true,
    });
  }
}