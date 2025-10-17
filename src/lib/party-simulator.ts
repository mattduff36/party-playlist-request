/**
 * Party Simulator Service
 * 
 * Simulates realistic party requests for testing purposes
 */

import { randomUUID } from 'crypto';

interface SimulationConfig {
  environment: 'local' | 'production'; // Local or production environment
  username: string; // Username to test (e.g., 'testuser1')
  requestPin?: string; // Optional PIN for protected request pages
  requestInterval: number; // Time between requests in ms (e.g., 30000 = 30s)
  uniqueRequesters: number; // Number of different people (1-20)
  burstMode: boolean; // If true, sends multiple requests at once occasionally
  explicitSongs: boolean; // Include explicit songs in random selection
}

interface SimulationLog {
  timestamp: string;
  requester: string;
  song: string;
  artist: string;
  status: 'success' | 'failed';
  error?: string;
}

interface SimulationStats {
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
const REQUESTER_NAMES = [
  'Sarah', 'Mike', 'Emily', 'Jake', 'Ashley', 'Chris',
  'Jessica', 'Ryan', 'Megan', 'Tyler', 'Amanda', 'Josh',
  'Lauren', 'Brandon', 'Nicole', 'Kevin', 'Samantha', 'Alex',
  'Rachel', 'Justin'
];

// Popular party songs for simulation
const PARTY_SONGS = [
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

class PartySimulator {
  private instanceId: string = Math.random().toString(36).substring(7);
  private config: SimulationConfig | null = null;
  private stats: SimulationStats = {
    isRunning: false,
    requestsSent: 0,
    requestsSuccessful: 0,
    requestsFailed: 0,
    startedAt: null,
    lastRequestAt: null,
    activeRequesters: []
  };
  private intervalId: NodeJS.Timeout | null = null;
  private usedRequesters: Set<string> = new Set();

  constructor() {
    console.log(`🆔 PartySimulator instance created: ${this.instanceId}`);
  }

  /**
   * Start the party simulation
   */
  start(config: SimulationConfig): void {
    if (this.stats.isRunning) {
      throw new Error('Simulation is already running');
    }

    if (!config.username) {
      throw new Error('Username is required');
    }

    if (!config.environment) {
      throw new Error('Environment is required');
    }

    this.config = config;
    this.stats = {
      isRunning: true,
      requestsSent: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      startedAt: new Date().toISOString(),
      lastRequestAt: null,
      activeRequesters: this.generateRequesterNames(config.uniqueRequesters),
      logs: []
    };
    this.usedRequesters = new Set();

    const targetUrl = this.getTargetUrl();
    console.log(`🎉 [${this.instanceId}] Party simulation started:`, {
      environment: config.environment,
      username: config.username,
      targetUrl,
      interval: config.requestInterval,
      requesters: config.uniqueRequesters,
      burstMode: config.burstMode
    });

    // Start sending requests - first request within 10 seconds
    this.scheduleNextRequest(true);
  }

  /**
   * Get the target URL based on environment and username
   */
  private getTargetUrl(): string {
    if (!this.config) return '';
    
    const baseUrl = this.config.environment === 'local' 
      ? 'http://localhost:3000' 
      : 'https://partyplaylist.co.uk';
    
    return `${baseUrl}/${this.config.username}/request`;
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    console.log(`🛑 [${this.instanceId}] stop() called, stack trace:`, new Error().stack);
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.stats.isRunning = false;
    this.config = null;
    console.log(`🛑 [${this.instanceId}] Party simulation stopped`);
  }

  /**
   * Get current simulation statistics
   */
  getStats(): SimulationStats {
    return { ...this.stats };
  }

  /**
   * Manually trigger a single request (for testing/demo purposes)
   */
  async triggerManualRequest(): Promise<void> {
    if (!this.config || !this.stats.isRunning) {
      throw new Error('Simulation is not running');
    }

    console.log(`🎯 [${this.instanceId}] Manual single request triggered`);
    try {
      await this.sendRequest();
    } catch (error) {
      console.error(`❌ [${this.instanceId}] Manual request failed:`, error);
      throw error;
    }
  }

  /**
   * Manually trigger a burst of requests (for testing/demo purposes)
   */
  async triggerManualBurst(): Promise<void> {
    if (!this.config || !this.stats.isRunning) {
      throw new Error('Simulation is not running');
    }

    const burstCount = Math.floor(Math.random() * 3) + 2; // 2-4 requests
    console.log(`💥 [${this.instanceId}] Manual burst triggered: ${burstCount} requests`);

    for (let i = 0; i < burstCount; i++) {
      try {
        await this.sendRequest();
      } catch (error) {
        console.error(`❌ [${this.instanceId}] Burst request ${i + 1} failed:`, error);
      }
      
      // Longer delay between burst requests (1s - 2s) to avoid rate limiting
      if (i < burstCount - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
      }
    }
  }

  /**
   * Schedule the next request(s)
   * @param isFirstRequest - If true, schedules the first request within 10 seconds
   */
  private scheduleNextRequest(isFirstRequest: boolean = false): void {
    // Check if we should continue BEFORE scheduling
    if (!this.config || !this.stats.isRunning) {
      console.log(`🛑 [${this.instanceId}] Stopping scheduler: isRunning =`, this.stats.isRunning);
      return;
    }

    // First request happens within 10 seconds, subsequent requests use configured interval
    const delay = isFirstRequest 
      ? Math.floor(Math.random() * 10000) // Random delay 0-10 seconds
      : this.config.requestInterval;
    
    const isBurst = !isFirstRequest && this.config.burstMode && Math.random() < 0.2; // 20% chance of burst (not on first request)

    this.intervalId = setTimeout(async () => {
      // Double-check we're still running AFTER the delay
      if (!this.config || !this.stats.isRunning) {
        console.log(`🛑 [${this.instanceId}] Simulation stopped during delay, not sending request`);
        return;
      }

      try {
        if (isBurst) {
          // Send 2-4 requests in quick succession
          const burstCount = Math.floor(Math.random() * 3) + 2;
          console.log(`💥 Burst mode: sending ${burstCount} requests`);
          for (let i = 0; i < burstCount; i++) {
            // Check we're still running before each burst request
            if (!this.stats.isRunning) break;
            
            // Wrap each request in try-catch to prevent any errors from stopping the loop
            try {
              await this.sendRequest();
            } catch (error) {
              console.error('❌ Burst request failed (continuing):', error);
            }
            
            // Longer delay between burst requests (1s - 2s) to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
          }
        } else {
          // Wrap single request in try-catch
          try {
            await this.sendRequest();
          } catch (error) {
            console.error('❌ Request failed (continuing):', error);
          }
        }
      } catch (error) {
        // Extra safety net - log but don't stop the simulation on ANY error
        console.error('❌ Unexpected error in simulation loop (will continue):', error);
      } finally {
        // ALWAYS schedule next request IF still running
        console.log(`📊 [${this.instanceId}] finally block: isRunning=${this.stats.isRunning}, hasConfig=${!!this.config}`);
        if (this.stats.isRunning && this.config) {
          console.log(`✅ [${this.instanceId}] Scheduling next request in ${this.config.requestInterval}ms...`);
          this.scheduleNextRequest(false); // Subsequent requests use normal interval
        } else {
          console.log(`🛑 [${this.instanceId}] Not scheduling next request - simulation stopped or no config`);
        }
      }
    }, delay);
  }

  /**
   * Send a single request
   */
  private async sendRequest(): Promise<void> {
    if (!this.config) return;

    try {
      // Select random requester
      const requesterName = this.selectRequester();
      
      // Select random song
      const availableSongs = this.config.explicitSongs 
        ? PARTY_SONGS 
        : PARTY_SONGS.filter(s => !s.explicit);
      const song = availableSongs[Math.floor(Math.random() * availableSongs.length)];

      console.log(`🎵 [${this.instanceId}] Simulating request from "${requesterName}": ${song.query}`);

      // Build URLs using config
      const baseUrl = this.config.environment === 'local' 
        ? 'http://localhost:3000' 
        : 'https://partyplaylist.co.uk';
      const username = this.config.username;

      console.log(`🔍 [${this.instanceId}] Target: ${this.config.environment} - ${username}`);

      // First, search for the song with username parameter
      const searchUrl = `${baseUrl}/api/search?q=${encodeURIComponent(song.query)}&username=${encodeURIComponent(username)}`;
      console.log(`🔍 Searching: ${searchUrl}`);
      
      const searchResponse = await fetch(searchUrl, {
        method: 'GET'
      });

      console.log(`🔍 Search response: ${searchResponse.status} ${searchResponse.statusText}`);

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error(`❌ Search failed: ${searchResponse.status} - ${errorText}`);
        throw new Error(`Search failed: ${searchResponse.status} - ${errorText}`);
      }

      const searchData = await searchResponse.json();
      console.log(`🔍 Search data:`, JSON.stringify(searchData).substring(0, 200));
      
      // The API returns { tracks: [...], query, total }, not { tracks: { items: [...] } }
      const tracks = searchData?.tracks || [];
      console.log(`🔍 Search returned ${tracks.length} tracks`);

      if (tracks.length === 0) {
        console.error(`❌ No tracks found for query: ${song.query}`);
        throw new Error('No tracks found');
      }

      // Select the first track
      const track = tracks[0];

      // Generate a realistic session ID
      const sessionId = randomUUID();

      // Prepare request body
      const requestBody: any = {
        track_uri: track.uri,
        trackName: track.name,
        artistName: track.artists.map((a: any) => a.name).join(', '),
        albumName: track.album?.name || '',
        requester_nickname: requesterName,
        user_session_id: sessionId,
        username: username // Required for multi-tenant support
      };

      // Add PIN if provided
      if (this.config.requestPin) {
        requestBody.pin = this.config.requestPin;
      }

      // Submit the request
      const requestResponse = await fetch(`${baseUrl}/api/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!requestResponse.ok) {
        const errorData = await requestResponse.json().catch(() => ({}));
        throw new Error(`Request failed: ${requestResponse.status} - ${errorData.error || 'Unknown error'}`);
      }

      this.stats.requestsSent++;
      this.stats.requestsSuccessful++;
      this.stats.lastRequestAt = new Date().toISOString();
      
      // Add log entry
      this.stats.logs.unshift({
        timestamp: new Date().toISOString(),
        requester: requesterName,
        song: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        status: 'success'
      });
      
      // Keep only last 50 logs to prevent memory issues
      if (this.stats.logs.length > 50) {
        this.stats.logs = this.stats.logs.slice(0, 50);
      }
      
      console.log(`✅ [${this.instanceId}] Request sent successfully by ${requesterName}: ${track.name}`);

    } catch (error) {
      this.stats.requestsSent++;
      this.stats.requestsFailed++;
      this.stats.lastRequestAt = new Date().toISOString();
      
      // Add log entry for failed request
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.stats.logs.unshift({
        timestamp: new Date().toISOString(),
        requester: requesterName,
        song: song.title,
        artist: song.artist,
        status: 'failed',
        error: errorMessage
      });
      
      // Keep only last 50 logs to prevent memory issues
      if (this.stats.logs.length > 50) {
        this.stats.logs = this.stats.logs.slice(0, 50);
      }
      
      console.error(`❌ [${this.instanceId}] Failed to send simulated request:`, error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error(`❌ [${this.instanceId}] Error message:`, error.message);
        console.error(`❌ [${this.instanceId}] Error stack:`, error.stack);
      }
    }
  }

  /**
   * Generate requester names based on config
   */
  private generateRequesterNames(count: number): string[] {
    const names = [...REQUESTER_NAMES];
    // Shuffle and take the requested number
    return names.sort(() => Math.random() - 0.5).slice(0, count);
  }

  /**
   * Select a requester (with some repeating to be realistic)
   */
  private selectRequester(): string {
    if (!this.config) return 'Guest';

    // 70% chance to pick someone who hasn't requested yet
    // 30% chance to pick someone who has (repeat requester)
    const useNewRequester = Math.random() < 0.7;

    if (useNewRequester && this.usedRequesters.size < this.stats.activeRequesters.length) {
      // Pick someone new
      const unused = this.stats.activeRequesters.filter(name => !this.usedRequesters.has(name));
      if (unused.length > 0) {
        const name = unused[Math.floor(Math.random() * unused.length)];
        this.usedRequesters.add(name);
        return name;
      }
    }

    // Pick any active requester (including repeats)
    return this.stats.activeRequesters[Math.floor(Math.random() * this.stats.activeRequesters.length)];
  }
}

// Singleton instance - use global to persist across hot-reloads in development
const globalForSimulator = global as unknown as {
  partySimulator: PartySimulator | undefined;
};

if (!globalForSimulator.partySimulator) {
  console.log('🔥 Creating NEW PartySimulator singleton instance');
  globalForSimulator.partySimulator = new PartySimulator();
} else {
  console.log('♻️ Reusing existing PartySimulator singleton instance');
}

export const partySimulator = globalForSimulator.partySimulator;

export type { SimulationConfig, SimulationStats };

