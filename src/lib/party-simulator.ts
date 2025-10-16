/**
 * Party Simulator Service
 * 
 * Simulates realistic party requests for testing purposes
 */

import { randomUUID } from 'crypto';

interface SimulationConfig {
  targetUrl: string; // The request page URL
  requestPin?: string; // Optional PIN for protected request pages
  requestInterval: number; // Time between requests in ms (e.g., 30000 = 30s)
  uniqueRequesters: number; // Number of different people (1-20)
  burstMode: boolean; // If true, sends multiple requests at once occasionally
  explicitSongs: boolean; // Include explicit songs in random selection
}

interface SimulationStats {
  isRunning: boolean;
  requestsSent: number;
  requestsSuccessful: number;
  requestsFailed: number;
  startedAt: string | null;
  lastRequestAt: string | null;
  activeRequesters: string[];
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

  /**
   * Start the party simulation
   */
  start(config: SimulationConfig): void {
    if (this.stats.isRunning) {
      throw new Error('Simulation is already running');
    }

    if (!config.targetUrl) {
      throw new Error('Target URL is required');
    }

    this.config = config;
    this.stats = {
      isRunning: true,
      requestsSent: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      startedAt: new Date().toISOString(),
      lastRequestAt: null,
      activeRequesters: this.generateRequesterNames(config.uniqueRequesters)
    };
    this.usedRequesters = new Set();

    console.log('🎉 Party simulation started:', {
      targetUrl: config.targetUrl,
      interval: config.requestInterval,
      requesters: config.uniqueRequesters,
      burstMode: config.burstMode
    });

    // Start sending requests
    this.scheduleNextRequest();
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.stats.isRunning = false;
    this.config = null;
    console.log('🛑 Party simulation stopped');
  }

  /**
   * Get current simulation statistics
   */
  getStats(): SimulationStats {
    return { ...this.stats };
  }

  /**
   * Schedule the next request(s)
   */
  private scheduleNextRequest(): void {
    if (!this.config || !this.stats.isRunning) return;

    const delay = this.config.requestInterval;
    const isBurst = this.config.burstMode && Math.random() < 0.2; // 20% chance of burst

    this.intervalId = setTimeout(async () => {
      try {
        if (isBurst) {
          // Send 2-4 requests in quick succession
          const burstCount = Math.floor(Math.random() * 3) + 2;
          console.log(`💥 Burst mode: sending ${burstCount} requests`);
          for (let i = 0; i < burstCount; i++) {
            await this.sendRequest();
            // Small delay between burst requests (500ms - 2s)
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1500 + 500));
          }
        } else {
          await this.sendRequest();
        }
      } catch (error) {
        // Log but don't stop the simulation on error
        console.error('❌ Error in simulation loop (will continue):', error);
      } finally {
        // ALWAYS schedule next request, even if this one failed
        this.scheduleNextRequest();
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

      console.log(`🎵 Simulating request from "${requesterName}": ${song.query}`);

      // Extract base URL and username from target URL
      // URL format: https://domain.com/username/request
      const urlParts = this.config.targetUrl.split('/');
      const username = urlParts[urlParts.length - 2]; // Get username (second-to-last part)
      const baseUrl = urlParts.slice(0, urlParts.length - 2).join('/'); // Get base URL without /username/request

      console.log(`🔍 Extracted username: ${username}, base URL: ${baseUrl}`);

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
      
      console.log(`✅ Request sent successfully by ${requesterName}: ${track.name}`);

    } catch (error) {
      this.stats.requestsSent++;
      this.stats.requestsFailed++;
      this.stats.lastRequestAt = new Date().toISOString();
      console.error('❌ Failed to send simulated request:', error);
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

// Singleton instance
export const partySimulator = new PartySimulator();

export type { SimulationConfig, SimulationStats };

