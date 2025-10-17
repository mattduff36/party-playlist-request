/**
 * Shared constants and types for party simulator
 * Used by both client-side and server-side implementations
 */

export interface SimulationConfig {
  environment: 'local' | 'production'; // Local or production environment
  username: string; // Username to test (e.g., 'testuser1')
  requestPin?: string; // Optional PIN for protected request pages
  requestInterval: number; // Time between requests in ms (e.g., 30000 = 30s)
  uniqueRequesters: number; // Number of different people (1-20)
  burstMode: boolean; // If true, sends multiple requests at once occasionally
  explicitSongs: boolean; // Include explicit songs in random selection
}

export interface SimulationLog {
  timestamp: string;
  requester: string;
  song: string;
  artist: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface SimulationStats {
  isRunning: boolean;
  requestsSent: number;
  requestsSuccessful: number;
  requestsFailed: number;
  startedAt: string | null;
  lastRequestAt: string | null;
  activeRequesters: string[];
  logs: SimulationLog[];
}

// Realistic requester names
export const REQUESTER_NAMES = [
  'Sarah', 'Mike', 'Emily', 'Jake', 'Ashley', 'Chris',
  'Jessica', 'Ryan', 'Megan', 'Tyler', 'Amanda', 'Josh',
  'Lauren', 'Brandon', 'Nicole', 'Kevin', 'Samantha', 'Alex',
  'Rachel', 'Justin'
];

// Popular party songs for simulation
export const PARTY_SONGS = [
  // Current Pop Hits
  { query: 'Flowers Miley Cyrus', explicit: false },
  { query: 'Anti-Hero Taylor Swift', explicit: false },
  { query: 'As It Was Harry Styles', explicit: false },
  { query: 'Heat Waves Glass Animals', explicit: false },
  { query: 'Levitating Dua Lipa', explicit: false },
  { query: 'Blinding Lights The Weeknd', explicit: false },
  { query: 'Watermelon Sugar Harry Styles', explicit: false },
  
  // Dance/Electronic
  { query: 'One Kiss Calvin Harris', explicit: false },
  { query: 'Electricity Silk City', explicit: false },
  { query: 'Scared To Be Lonely Martin Garrix', explicit: false },
  { query: 'Titanium David Guetta', explicit: false },
  { query: 'Wake Me Up Avicii', explicit: false },
  
  // Hip Hop/R&B
  { query: 'INDUSTRY BABY Lil Nas X', explicit: true },
  { query: 'Peaches Justin Bieber', explicit: false },
  { query: 'Circles Post Malone', explicit: false },
  { query: 'Sunflower Post Malone', explicit: false },
  { query: 'Good 4 U Olivia Rodrigo', explicit: false },
  
  // Classic Party
  { query: 'Mr. Brightside The Killers', explicit: false },
  { query: 'Don\'t Stop Me Now Queen', explicit: false },
  { query: 'Uptown Funk Bruno Mars', explicit: false },
  { query: 'Can\'t Stop the Feeling Justin Timberlake', explicit: false },
  { query: 'Shut Up and Dance Walk the Moon', explicit: false },
  { query: 'Dancing Queen ABBA', explicit: false },
  { query: 'September Earth Wind Fire', explicit: false },
  
  // Rock/Alternative
  { query: 'Somebody Told Me The Killers', explicit: false },
  { query: 'Pumped Up Kicks Foster the People', explicit: false },
  { query: 'Radioactive Imagine Dragons', explicit: false },
  { query: 'Believer Imagine Dragons', explicit: false },
  { query: 'Thunder Imagine Dragons', explicit: false },
  
  // Throwbacks
  { query: 'Yeah Usher', explicit: true },
  { query: 'In Da Club 50 Cent', explicit: true },
  { query: 'Crazy in Love Beyonce', explicit: false },
  { query: 'Hey Ya OutKast', explicit: false },
  { query: 'Sweet Child O Mine Guns N Roses', explicit: false }
];

/**
 * Generate requester names based on count
 */
export function generateRequesterNames(count: number): string[] {
  const names = [...REQUESTER_NAMES];
  // Shuffle and take the requested number
  return names.sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Parse song query into song and artist names
 * Format: "Song Name Artist Name"
 */
export function parseSongQuery(query: string): { song: string; artist: string } {
  const queryParts = query.split(' ');
  const songName = queryParts.slice(0, Math.floor(queryParts.length / 2)).join(' ');
  const artistName = queryParts.slice(Math.floor(queryParts.length / 2)).join(' ');
  
  return {
    song: songName || query,
    artist: artistName || 'Unknown'
  };
}
