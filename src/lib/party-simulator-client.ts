/**
 * Browser-side party simulator singleton.
 * Survives Next.js client-side navigations so the interval and stats
 * stay alive while the tab remains open.
 */

import {
  SimulationConfig,
  SimulationStats,
  SimulationLog,
  DEFAULT_SIMULATION_DURATION_MS,
  PARTY_SONGS,
  generateRequesterNames,
  parseSongQuery,
} from '@/lib/party-simulator-shared';

export interface PartySimulatorClientListener {
  (stats: SimulationStats): void;
}

const EMPTY_STATS: SimulationStats = {
  isRunning: false,
  requestsSent: 0,
  requestsSuccessful: 0,
  requestsFailed: 0,
  startedAt: null,
  endsAt: null,
  lastRequestAt: null,
  activeRequesters: [],
  logs: [],
};

class ClientPartySimulator {
  private stats: SimulationStats = { ...EMPTY_STATS };
  private config: SimulationConfig | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private firstRequestTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private autoStopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private usedRequesters: Set<string> = new Set();
  private listeners: Set<PartySimulatorClientListener> = new Set();

  getStats(): SimulationStats {
    return this.stats;
  }

  getConfig(): SimulationConfig | null {
    return this.config;
  }

  subscribe(listener: PartySimulatorClientListener): () => void {
    this.listeners.add(listener);
    listener(this.stats);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(config: SimulationConfig): void {
    if (this.stats.isRunning) {
      console.warn('[Client] Simulation is already running');
      return;
    }

    if (!config.username) {
      throw new Error('Username is required');
    }

    if (!config.environment) {
      throw new Error('Environment is required');
    }

    this.config = config;
    this.usedRequesters = new Set();

    const activeRequesters = generateRequesterNames(config.uniqueRequesters);
    const durationMs = config.durationMs || DEFAULT_SIMULATION_DURATION_MS;
    const startedAtMs = Date.now();
    const endsAtMs = startedAtMs + durationMs;

    this.setStats({
      isRunning: true,
      requestsSent: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      startedAt: new Date(startedAtMs).toISOString(),
      endsAt: new Date(endsAtMs).toISOString(),
      lastRequestAt: null,
      activeRequesters,
      logs: [],
    });

    console.log(`🎉 [Client] Party simulation started:`, {
      environment: config.environment,
      username: config.username,
      interval: config.requestInterval,
      requesters: config.uniqueRequesters,
      burstMode: config.burstMode,
      durationMs,
      endsAt: new Date(endsAtMs).toISOString(),
    });

    this.intervalId = setInterval(async () => {
      if (!this.config || !this.stats.isRunning) {
        console.log(`🛑 [Client] Simulation stopped, clearing interval`);
        this.clearTimers();
        return;
      }

      try {
        if (this.config.burstMode && Math.random() < 0.2) {
          const burstCount = Math.floor(Math.random() * 3) + 2;
          console.log(`💥 [Client] Burst mode: sending ${burstCount} requests`);

          for (let i = 0; i < burstCount; i++) {
            if (!this.config || !this.stats.isRunning) break;

            try {
              await this.sendRequest();
            } catch (error) {
              console.error('❌ [Client] Burst request failed (continuing):', error);
            }

            if (i < burstCount - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, Math.random() * 1000 + 1000)
              );
            }
          }
        } else {
          await this.sendRequest();
        }
      } catch (error) {
        console.error(
          '❌ [Client] Unexpected error in simulation loop (will continue):',
          error
        );
      }
    }, config.requestInterval);

    this.firstRequestTimeoutId = setTimeout(async () => {
      if (this.config && this.stats.isRunning) {
        try {
          await this.sendRequest();
        } catch (error) {
          console.error('❌ [Client] First request failed:', error);
        }
      }
    }, Math.floor(Math.random() * 10000));

    this.autoStopTimeoutId = setTimeout(() => {
      if (!this.stats.isRunning) return;
      console.log(`⏰ [Client] Simulation duration expired — auto-stopping`);
      this.stop();
    }, durationMs);
  }

  stop(): void {
    console.log(`🛑 [Client] stopSimulation() called`);

    this.clearTimers();
    this.config = null;
    this.usedRequesters = new Set();

    this.setStats({
      ...this.stats,
      isRunning: false,
      endsAt: null,
    });

    console.log(`🛑 [Client] Party simulation stopped`);
  }

  async triggerManualRequest(): Promise<void> {
    if (!this.stats.isRunning) {
      throw new Error('Simulation is not running');
    }

    console.log(`🎯 [Client] Manual single request triggered`);
    try {
      await this.sendRequest();
    } catch (error) {
      console.error(`❌ [Client] Manual request failed:`, error);
      throw error;
    }
  }

  async triggerManualBurst(): Promise<void> {
    if (!this.stats.isRunning) {
      throw new Error('Simulation is not running');
    }

    const burstCount = Math.floor(Math.random() * 3) + 2;
    console.log(`💥 [Client] Manual burst triggered: ${burstCount} requests`);

    for (let i = 0; i < burstCount; i++) {
      try {
        await this.sendRequest();
      } catch (error) {
        console.error(`❌ [Client] Burst request ${i + 1} failed:`, error);
      }

      if (i < burstCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
    }
  }

  private clearTimers(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.firstRequestTimeoutId) {
      clearTimeout(this.firstRequestTimeoutId);
      this.firstRequestTimeoutId = null;
    }
    if (this.autoStopTimeoutId) {
      clearTimeout(this.autoStopTimeoutId);
      this.autoStopTimeoutId = null;
    }
  }

  private setStats(next: SimulationStats): void {
    this.stats = next;
    for (const listener of this.listeners) {
      listener(this.stats);
    }
  }

  private updateStats(
    updater: (prev: SimulationStats) => SimulationStats
  ): void {
    this.setStats(updater(this.stats));
  }

  private selectRequester(): string {
    if (!this.config) return 'Guest';

    let activeRequesters = this.stats.activeRequesters;

    if (activeRequesters.length === 0) {
      activeRequesters = generateRequesterNames(this.config.uniqueRequesters);
    }

    if (activeRequesters.length === 0) return 'Guest';

    const useNewRequester = Math.random() < 0.7;

    if (useNewRequester && this.usedRequesters.size < activeRequesters.length) {
      const unused = activeRequesters.filter(
        (name) => !this.usedRequesters.has(name)
      );
      if (unused.length > 0) {
        const name = unused[Math.floor(Math.random() * unused.length)];
        this.usedRequesters.add(name);
        return name;
      }
    }

    return activeRequesters[
      Math.floor(Math.random() * activeRequesters.length)
    ];
  }

  private async sendRequest(): Promise<void> {
    if (!this.config) return;

    const config = this.config;
    let requesterName = 'Unknown';
    let song = PARTY_SONGS[0];

    try {
      requesterName = this.selectRequester();

      const availableSongs = config.explicitSongs
        ? PARTY_SONGS
        : PARTY_SONGS.filter((s) => !s.explicit);
      song =
        availableSongs[Math.floor(Math.random() * availableSongs.length)];

      console.log(
        `🎵 [Client] Simulating request from "${requesterName}": ${song.query}`
      );

      const baseUrl =
        config.environment === 'local'
          ? 'http://localhost:3000'
          : 'https://partyplaylist.co.uk';
      const username = config.username;

      console.log(`🔍 [Client] Target: ${config.environment} - ${username}`);

      const accessCode = config.requestPin?.trim();
      if (!accessCode) {
        throw new Error('Access code is required for guest request simulation');
      }

      const searchUrl =
        `${baseUrl}/api/spotify/search?q=${encodeURIComponent(song.query)}` +
        `&username=${encodeURIComponent(username)}` +
        `&accessCode=${encodeURIComponent(accessCode)}`;
      console.log(`🔍 [Client] Searching: ${searchUrl}`);

      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
      });

      console.log(
        `🔍 [Client] Search response: ${searchResponse.status} ${searchResponse.statusText}`
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error(
          `❌ [Client] Search failed: ${searchResponse.status} - ${errorText}`
        );
        throw new Error(
          `Search failed: ${searchResponse.status} - ${errorText}`
        );
      }

      const searchData = await searchResponse.json();
      console.log(
        `🔍 [Client] Search data:`,
        JSON.stringify(searchData).substring(0, 200)
      );

      const tracks = searchData?.tracks || [];
      console.log(`🔍 [Client] Search returned ${tracks.length} tracks`);

      if (tracks.length === 0) {
        console.error(`❌ [Client] No tracks found for query: ${song.query}`);
        throw new Error('No tracks found');
      }

      const track = tracks[0];
      const sessionId = crypto.randomUUID();

      const requestBody = {
        track_uri: track.uri,
        trackName: track.name,
        artistName: track.artists.map((a: { name: string }) => a.name).join(', '),
        albumName: track.album?.name || '',
        requester_nickname: requesterName,
        user_session_id: sessionId,
        username,
        accessCode,
        pin: accessCode,
      };

      const requestResponse = await fetch(`${baseUrl}/api/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!requestResponse.ok) {
        const errorData = await requestResponse.json().catch(() => ({}));
        throw new Error(
          `Request failed: ${requestResponse.status} - ${
            (errorData as { error?: string }).error || 'Unknown error'
          }`
        );
      }

      this.updateStats((prevStats) => {
        const newLog: SimulationLog = {
          timestamp: new Date().toISOString(),
          requester: requesterName,
          song: track.name,
          artist: track.artists.map((a: { name: string }) => a.name).join(', '),
          status: 'success',
        };

        return {
          ...prevStats,
          requestsSent: prevStats.requestsSent + 1,
          requestsSuccessful: prevStats.requestsSuccessful + 1,
          lastRequestAt: new Date().toISOString(),
          logs: [newLog, ...prevStats.logs.slice(0, 49)],
        };
      });

      console.log(
        `✅ [Client] Request sent successfully by ${requesterName}: ${track.name}`
      );
    } catch (error) {
      this.updateStats((prevStats) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const { song: songName, artist: artistName } = parseSongQuery(
          song.query
        );

        const newLog: SimulationLog = {
          timestamp: new Date().toISOString(),
          requester: requesterName,
          song: songName,
          artist: artistName,
          status: 'failed',
          error: errorMessage,
        };

        return {
          ...prevStats,
          requestsSent: prevStats.requestsSent + 1,
          requestsFailed: prevStats.requestsFailed + 1,
          lastRequestAt: new Date().toISOString(),
          logs: [newLog, ...prevStats.logs.slice(0, 49)],
        };
      });

      console.error(`❌ [Client] Failed to send simulated request:`, error);
    }
  }
}

const globalForClientSimulator = globalThis as typeof globalThis & {
  __partySimulatorClient?: ClientPartySimulator;
};

if (!globalForClientSimulator.__partySimulatorClient) {
  globalForClientSimulator.__partySimulatorClient = new ClientPartySimulator();
}

export const clientPartySimulator =
  globalForClientSimulator.__partySimulatorClient;