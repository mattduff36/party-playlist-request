/**
 * Client-side party simulator hook
 * Runs simulation in the browser using setInterval
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  SimulationConfig,
  SimulationStats,
  SimulationLog,
  PARTY_SONGS,
  generateRequesterNames,
  parseSongQuery
} from '@/lib/party-simulator-shared';

export function usePartySimulator() {
  const [stats, setStats] = useState<SimulationStats>({
    isRunning: false,
    requestsSent: 0,
    requestsSuccessful: 0,
    requestsFailed: 0,
    startedAt: null,
    lastRequestAt: null,
    activeRequesters: [],
    logs: []
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef<SimulationConfig | null>(null);
  const usedRequestersRef = useRef<Set<string>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const sendRequest = useCallback(async (): Promise<void> => {
    if (!configRef.current) return;

    const config = configRef.current;
    let requesterName = 'Unknown';
    let song = PARTY_SONGS[0]; // Default fallback

    try {
      // Select random requester
      requesterName = selectRequester();
      
      // Select random song
      const availableSongs = config.explicitSongs 
        ? PARTY_SONGS 
        : PARTY_SONGS.filter(s => !s.explicit);
      song = availableSongs[Math.floor(Math.random() * availableSongs.length)];

      console.log(`🎵 [Client] Simulating request from "${requesterName}": ${song.query}`);

      // Build URLs using config
      const baseUrl = config.environment === 'local' 
        ? 'http://localhost:3000' 
        : 'https://partyplaylist.co.uk';
      const username = config.username;

      console.log(`🔍 [Client] Target: ${config.environment} - ${username}`);

      // First, search for the song with username parameter
      const searchUrl = `${baseUrl}/api/search?q=${encodeURIComponent(song.query)}&username=${encodeURIComponent(username)}`;
      console.log(`🔍 [Client] Searching: ${searchUrl}`);
      
      const searchResponse = await fetch(searchUrl, {
        method: 'GET'
      });

      console.log(`🔍 [Client] Search response: ${searchResponse.status} ${searchResponse.statusText}`);

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error(`❌ [Client] Search failed: ${searchResponse.status} - ${errorText}`);
        throw new Error(`Search failed: ${searchResponse.status} - ${errorText}`);
      }

      const searchData = await searchResponse.json();
      console.log(`🔍 [Client] Search data:`, JSON.stringify(searchData).substring(0, 200));
      
      // The API returns { tracks: [...], query, total }, not { tracks: { items: [...] } }
      const tracks = searchData?.tracks || [];
      console.log(`🔍 [Client] Search returned ${tracks.length} tracks`);

      if (tracks.length === 0) {
        console.error(`❌ [Client] No tracks found for query: ${song.query}`);
        throw new Error('No tracks found');
      }

      // Select the first track
      const track = tracks[0];

      // Generate a realistic session ID
      const sessionId = crypto.randomUUID();

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
      if (config.requestPin) {
        requestBody.pin = config.requestPin;
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

      // Update stats for success
      setStats(prevStats => {
        const newLog: SimulationLog = {
          timestamp: new Date().toISOString(),
          requester: requesterName,
          song: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          status: 'success'
        };

        return {
          ...prevStats,
          requestsSent: prevStats.requestsSent + 1,
          requestsSuccessful: prevStats.requestsSuccessful + 1,
          lastRequestAt: new Date().toISOString(),
          logs: [newLog, ...prevStats.logs.slice(0, 49)] // Keep only last 50
        };
      });
      
      console.log(`✅ [Client] Request sent successfully by ${requesterName}: ${track.name}`);

    } catch (error) {
      // Update stats for failure
      setStats(prevStats => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const { song: songName, artist: artistName } = parseSongQuery(song.query);
        
        const newLog: SimulationLog = {
          timestamp: new Date().toISOString(),
          requester: requesterName,
          song: songName,
          artist: artistName,
          status: 'failed',
          error: errorMessage
        };

        return {
          ...prevStats,
          requestsSent: prevStats.requestsSent + 1,
          requestsFailed: prevStats.requestsFailed + 1,
          lastRequestAt: new Date().toISOString(),
          logs: [newLog, ...prevStats.logs.slice(0, 49)] // Keep only last 50
        };
      });
      
      console.error(`❌ [Client] Failed to send simulated request:`, error);
    }
  }, []);

  const selectRequester = useCallback((): string => {
    if (!configRef.current) return 'Guest';

    const activeRequesters = stats.activeRequesters;
    
    if (activeRequesters.length === 0) return 'Guest';

    // 70% chance to pick someone who hasn't requested yet
    // 30% chance to pick someone who has (repeat requester)
    const useNewRequester = Math.random() < 0.7;

    if (useNewRequester && usedRequestersRef.current.size < activeRequesters.length) {
      // Pick someone new
      const unused = activeRequesters.filter(name => !usedRequestersRef.current.has(name));
      if (unused.length > 0) {
        const name = unused[Math.floor(Math.random() * unused.length)];
        usedRequestersRef.current.add(name);
        return name;
      }
    }

    // Pick any active requester (including repeats)
    return activeRequesters[Math.floor(Math.random() * activeRequesters.length)];
  }, [stats.activeRequesters]);

  const startSimulation = useCallback((config: SimulationConfig) => {
    if (stats.isRunning) {
      console.warn('[Client] Simulation is already running');
      return;
    }

    if (!config.username) {
      throw new Error('Username is required');
    }

    if (!config.environment) {
      throw new Error('Environment is required');
    }

    configRef.current = config;
    usedRequestersRef.current = new Set();

    const activeRequesters = generateRequesterNames(config.uniqueRequesters);
    
    setStats({
      isRunning: true,
      requestsSent: 0,
      requestsSuccessful: 0,
      requestsFailed: 0,
      startedAt: new Date().toISOString(),
      lastRequestAt: null,
      activeRequesters,
      logs: []
    });

    console.log(`🎉 [Client] Party simulation started:`, {
      environment: config.environment,
      username: config.username,
      interval: config.requestInterval,
      requesters: config.uniqueRequesters,
      burstMode: config.burstMode
    });

    // Start the interval
    intervalRef.current = setInterval(async () => {
      if (!configRef.current || !stats.isRunning) {
        console.log(`🛑 [Client] Simulation stopped, clearing interval`);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      try {
        if (configRef.current.burstMode && Math.random() < 0.2) {
          // Burst mode: send 2-4 requests in quick succession
          const burstCount = Math.floor(Math.random() * 3) + 2;
          console.log(`💥 [Client] Burst mode: sending ${burstCount} requests`);
          
          for (let i = 0; i < burstCount; i++) {
            if (!configRef.current || !stats.isRunning) break;
            
            try {
              await sendRequest();
            } catch (error) {
              console.error('❌ [Client] Burst request failed (continuing):', error);
            }
            
            // Delay between burst requests (1s - 2s) to avoid rate limiting
            if (i < burstCount - 1) {
              await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));
            }
          }
        } else {
          // Single request
          await sendRequest();
        }
      } catch (error) {
        console.error('❌ [Client] Unexpected error in simulation loop (will continue):', error);
      }
    }, config.requestInterval);

    // Send first request within 10 seconds
    setTimeout(async () => {
      if (configRef.current && stats.isRunning) {
        try {
          await sendRequest();
        } catch (error) {
          console.error('❌ [Client] First request failed:', error);
        }
      }
    }, Math.floor(Math.random() * 10000)); // Random delay 0-10 seconds
  }, [stats.isRunning, sendRequest]);

  const stopSimulation = useCallback(() => {
    console.log(`🛑 [Client] stopSimulation() called`);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setStats(prevStats => ({
      ...prevStats,
      isRunning: false
    }));
    
    configRef.current = null;
    usedRequestersRef.current = new Set();
    
    console.log(`🛑 [Client] Party simulation stopped`);
  }, []);

  const triggerManualRequest = useCallback(async () => {
    if (!stats.isRunning) {
      throw new Error('Simulation is not running');
    }

    console.log(`🎯 [Client] Manual single request triggered`);
    try {
      await sendRequest();
    } catch (error) {
      console.error(`❌ [Client] Manual request failed:`, error);
      throw error;
    }
  }, [stats.isRunning, sendRequest]);

  const triggerManualBurst = useCallback(async () => {
    if (!stats.isRunning) {
      throw new Error('Simulation is not running');
    }

    const burstCount = Math.floor(Math.random() * 3) + 2; // 2-4 requests
    console.log(`💥 [Client] Manual burst triggered: ${burstCount} requests`);

    for (let i = 0; i < burstCount; i++) {
      try {
        await sendRequest();
      } catch (error) {
        console.error(`❌ [Client] Burst request ${i + 1} failed:`, error);
      }
      
      // 4 second delay between burst requests for reliable testing
      if (i < burstCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }
  }, [stats.isRunning, sendRequest]);

  return {
    stats,
    startSimulation,
    stopSimulation,
    triggerManualRequest,
    triggerManualBurst
  };
}
