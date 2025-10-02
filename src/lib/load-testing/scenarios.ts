/**
 * Load Testing Scenarios
 * 
 * This module defines various load testing scenarios to validate
 * the system's performance under different conditions.
 */

export interface LoadTestScenario {
  name: string;
  description: string;
  duration: number; // in seconds
  userCount: number;
  rampUpTime: number; // in seconds
  actions: LoadTestAction[];
}

export interface LoadTestAction {
  name: string;
  weight: number; // relative probability (0-100)
  minDelay: number; // minimum delay between actions (ms)
  maxDelay: number; // maximum delay between actions (ms)
  execute: () => Promise<void>;
}

export interface LoadTestResult {
  scenario: string;
  duration: number;
  totalUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errors: LoadTestError[];
}

export interface LoadTestError {
  timestamp: number;
  action: string;
  error: string;
  userId: string;
}

/**
 * Basic user simulation scenario
 */
export const basicUserScenario: LoadTestScenario = {
  name: 'Basic User Simulation',
  description: 'Simulates normal user behavior with page loads and API calls',
  duration: 300, // 5 minutes
  userCount: 100,
  rampUpTime: 60, // 1 minute
  actions: [
    {
      name: 'load_homepage',
      weight: 30,
      minDelay: 1000,
      maxDelay: 3000,
      execute: async () => {
        // Simulate homepage load
        await fetch('/api/events/current');
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
      }
    },
    {
      name: 'load_display_page',
      weight: 25,
      minDelay: 1000,
      maxDelay: 3000,
      execute: async () => {
        // Simulate display page load
        await fetch('/api/events/current');
        await fetch('/api/requests');
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000));
      }
    },
    {
      name: 'submit_request',
      weight: 20,
      minDelay: 2000,
      maxDelay: 10000,
      execute: async () => {
        // Simulate song request submission
        const request = {
          songTitle: `Test Song ${Math.random()}`,
          artist: `Test Artist ${Math.random()}`,
          spotifyId: `spotify:track:${Math.random().toString(36).substr(2, 22)}`,
          requestedBy: `User ${Math.random().toString(36).substr(2, 8)}`
        };
        
        await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        });
      }
    },
    {
      name: 'view_requests',
      weight: 15,
      minDelay: 1000,
      maxDelay: 5000,
      execute: async () => {
        // Simulate viewing requests
        await fetch('/api/requests');
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
      }
    },
    {
      name: 'check_event_status',
      weight: 10,
      minDelay: 500,
      maxDelay: 2000,
      execute: async () => {
        // Simulate checking event status
        await fetch('/api/events/current');
      }
    }
  ]
};

/**
 * High load scenario
 */
export const highLoadScenario: LoadTestScenario = {
  name: 'High Load Simulation',
  description: 'Simulates high concurrent user load with frequent API calls',
  duration: 600, // 10 minutes
  userCount: 350,
  rampUpTime: 120, // 2 minutes
  actions: [
    {
      name: 'rapid_requests',
      weight: 40,
      minDelay: 100,
      maxDelay: 500,
      execute: async () => {
        // Rapid fire requests
        await Promise.all([
          fetch('/api/events/current'),
          fetch('/api/requests'),
          fetch('/api/events/current')
        ]);
      }
    },
    {
      name: 'bulk_submit_requests',
      weight: 30,
      minDelay: 200,
      maxDelay: 1000,
      execute: async () => {
        // Submit multiple requests quickly
        const requests = Array.from({ length: 3 }, (_, i) => ({
          songTitle: `Bulk Song ${i} ${Math.random()}`,
          artist: `Bulk Artist ${i}`,
          spotifyId: `spotify:track:${Math.random().toString(36).substr(2, 22)}`,
          requestedBy: `BulkUser ${Math.random().toString(36).substr(2, 8)}`
        }));
        
        await Promise.all(
          requests.map(request => 
            fetch('/api/requests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(request)
            })
          )
        );
      }
    },
    {
      name: 'concurrent_page_loads',
      weight: 20,
      minDelay: 50,
      maxDelay: 200,
      execute: async () => {
        // Concurrent page loads
        await Promise.all([
          fetch('/api/events/current'),
          fetch('/api/requests'),
          fetch('/api/events/current'),
          fetch('/api/requests')
        ]);
      }
    },
    {
      name: 'status_polling',
      weight: 10,
      minDelay: 100,
      maxDelay: 300,
      execute: async () => {
        // Continuous status polling
        await fetch('/api/events/current');
      }
    }
  ]
};

/**
 * Stress test scenario
 */
export const stressTestScenario: LoadTestScenario = {
  name: 'Stress Test',
  description: 'Pushes the system to its limits with maximum concurrent users',
  duration: 900, // 15 minutes
  userCount: 500,
  rampUpTime: 180, // 3 minutes
  actions: [
    {
      name: 'max_concurrent_requests',
      weight: 50,
      minDelay: 10,
      maxDelay: 100,
      execute: async () => {
        // Maximum concurrent requests
        const promises = Array.from({ length: 10 }, () => 
          fetch('/api/events/current')
        );
        await Promise.all(promises);
      }
    },
    {
      name: 'burst_requests',
      weight: 30,
      minDelay: 5,
      maxDelay: 50,
      execute: async () => {
        // Burst of requests
        for (let i = 0; i < 5; i++) {
          await fetch('/api/requests');
        }
      }
    },
    {
      name: 'heavy_operations',
      weight: 20,
      minDelay: 100,
      maxDelay: 500,
      execute: async () => {
        // Heavy operations
        const heavyRequest = {
          songTitle: `Heavy Test Song ${Math.random()}`,
          artist: `Heavy Test Artist ${Math.random()}`,
          spotifyId: `spotify:track:${Math.random().toString(36).substr(2, 22)}`,
          requestedBy: `HeavyUser ${Math.random().toString(36).substr(2, 8)}`,
          metadata: {
            album: `Heavy Album ${Math.random()}`,
            duration: Math.floor(Math.random() * 300000),
            popularity: Math.floor(Math.random() * 100),
            genres: ['rock', 'pop', 'electronic'],
            year: 2020 + Math.floor(Math.random() * 4)
          }
        };
        
        await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(heavyRequest)
        });
      }
    }
  ]
};

/**
 * Real-time synchronization scenario
 */
export const realTimeSyncScenario: LoadTestScenario = {
  name: 'Real-time Synchronization Test',
  description: 'Tests real-time features with WebSocket connections',
  duration: 1800, // 30 minutes
  userCount: 200,
  rampUpTime: 300, // 5 minutes
  actions: [
    {
      name: 'websocket_connection',
      weight: 25,
      minDelay: 1000,
      maxDelay: 5000,
      execute: async () => {
        // Simulate WebSocket connection
        // This would be implemented with actual Pusher connection
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10000));
      }
    },
    {
      name: 'real_time_requests',
      weight: 30,
      minDelay: 500,
      maxDelay: 2000,
      execute: async () => {
        // Real-time request submission
        const request = {
          songTitle: `Real-time Song ${Math.random()}`,
          artist: `Real-time Artist ${Math.random()}`,
          spotifyId: `spotify:track:${Math.random().toString(36).substr(2, 22)}`,
          requestedBy: `RealTimeUser ${Math.random().toString(36).substr(2, 8)}`
        };
        
        await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        });
      }
    },
    {
      name: 'status_updates',
      weight: 25,
      minDelay: 200,
      maxDelay: 1000,
      execute: async () => {
        // Status updates
        await fetch('/api/events/current');
      }
    },
    {
      name: 'admin_operations',
      weight: 20,
      minDelay: 1000,
      maxDelay: 5000,
      execute: async () => {
        // Admin operations
        await fetch('/api/admin/status');
        await fetch('/api/requests');
      }
    }
  ]
};

/**
 * Memory leak detection scenario
 */
export const memoryLeakScenario: LoadTestScenario = {
  name: 'Memory Leak Detection',
  description: 'Long-running test to detect memory leaks',
  duration: 3600, // 1 hour
  userCount: 50,
  rampUpTime: 60, // 1 minute
  actions: [
    {
      name: 'sustained_requests',
      weight: 40,
      minDelay: 1000,
      maxDelay: 3000,
      execute: async () => {
        // Sustained request pattern
        await fetch('/api/events/current');
        await fetch('/api/requests');
      }
    },
    {
      name: 'periodic_heavy_operations',
      weight: 30,
      minDelay: 5000,
      maxDelay: 15000,
      execute: async () => {
        // Periodic heavy operations
        const requests = Array.from({ length: 10 }, (_, i) => ({
          songTitle: `Memory Test Song ${i} ${Math.random()}`,
          artist: `Memory Test Artist ${i}`,
          spotifyId: `spotify:track:${Math.random().toString(36).substr(2, 22)}`,
          requestedBy: `MemoryUser ${Math.random().toString(36).substr(2, 8)}`
        }));
        
        await Promise.all(
          requests.map(request => 
            fetch('/api/requests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(request)
            })
          )
        );
      }
    },
    {
      name: 'cleanup_operations',
      weight: 30,
      minDelay: 2000,
      maxDelay: 8000,
      execute: async () => {
        // Cleanup operations
        await fetch('/api/events/current');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetch('/api/requests');
      }
    }
  ]
};

/**
 * All available scenarios
 */
export const scenarios: LoadTestScenario[] = [
  basicUserScenario,
  highLoadScenario,
  stressTestScenario,
  realTimeSyncScenario,
  memoryLeakScenario
];

/**
 * Get scenario by name
 */
export function getScenario(name: string): LoadTestScenario | undefined {
  return scenarios.find(scenario => scenario.name === name);
}

/**
 * Get all scenario names
 */
export function getScenarioNames(): string[] {
  return scenarios.map(scenario => scenario.name);
}

