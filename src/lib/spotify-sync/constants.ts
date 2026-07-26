/** Target SLA: track identity + progress within ~5s. */
export const PLAYBACK_STALE_MS = 5_000;

/** Neon lease window — concurrent heartbeats coalesce to one Spotify poll. */
export const TICK_LEASE_MS = 4_000;

/** Queue refresh cadence while playing (track changes always force queue). */
export const PLAYING_QUEUE_MS = 20_000;

/** Queue refresh cadence while idle. */
export const IDLE_QUEUE_MS = 60_000;

/** Stats Pusher cadence. */
export const STATS_UPDATE_MS = 30_000;
