/**
 * Load Testing Configuration
 * 
 * This configuration file defines various load testing scenarios
 * for the party playlist system to ensure it can handle 350+ concurrent users.
 */

module.exports = {
  // Test scenarios
  scenarios: {
    // Basic load test - gradual ramp up to 350 users
    basicLoad: {
      name: 'Basic Load Test',
      users: 350,
      duration: '5m',
      rampUp: '2m',
      rampDown: '1m',
      description: 'Gradual ramp up to 350 concurrent users over 2 minutes'
    },

    // Spike test - sudden burst of users
    spikeTest: {
      name: 'Spike Test',
      users: 500,
      duration: '3m',
      rampUp: '30s',
      rampDown: '30s',
      description: 'Sudden spike to 500 users to test system resilience'
    },

    // Stress test - beyond normal capacity
    stressTest: {
      name: 'Stress Test',
      users: 1000,
      duration: '10m',
      rampUp: '5m',
      rampDown: '2m',
      description: 'Stress test with 1000 users to find breaking point'
    },

    // Endurance test - sustained load
    enduranceTest: {
      name: 'Endurance Test',
      users: 350,
      duration: '30m',
      rampUp: '5m',
      rampDown: '5m',
      description: 'Sustained load test for 30 minutes to check for memory leaks'
    },

    // Real-world simulation
    realWorldSimulation: {
      name: 'Real World Simulation',
      users: 350,
      duration: '15m',
      rampUp: '3m',
      rampDown: '2m',
      description: 'Simulates real-world usage patterns with varying load'
    }
  },

  // Performance thresholds
  thresholds: {
    // Response time thresholds
    responseTime: {
      average: 2000,    // 2 seconds average
      p95: 5000,        // 5 seconds 95th percentile
      p99: 10000,       // 10 seconds 99th percentile
      max: 15000        // 15 seconds maximum
    },

    // Error rate thresholds
    errorRate: {
      max: 0.05,        // 5% maximum error rate
      critical: 0.01    // 1% critical error rate
    },

    // Throughput thresholds
    throughput: {
      min: 100,         // Minimum 100 requests per second
      target: 200,      // Target 200 requests per second
      max: 500          // Maximum 500 requests per second
    },

    // Resource usage thresholds
    resources: {
      memory: {
        max: 1024 * 1024 * 1024,  // 1GB maximum memory usage
        warning: 512 * 1024 * 1024 // 512MB warning threshold
      },
      cpu: {
        max: 80,         // 80% maximum CPU usage
        warning: 60      // 60% warning threshold
      }
    }
  },

  // Test data configuration
  testData: {
    // User data
    users: {
      count: 350,
      dataSize: '1KB',  // Average user data size
      sessionDuration: '30m' // Average session duration
    },

    // Event data
    events: {
      count: 10,        // Number of test events
      requestsPerEvent: 100, // Requests per event
      dataSize: '5KB'   // Average event data size
    },

    // Request data
    requests: {
      count: 1000,      // Total number of requests
      dataSize: '2KB',  // Average request data size
      frequency: '1s'   // Request frequency
    }
  },

  // Monitoring configuration
  monitoring: {
    // Metrics to collect
    metrics: [
      'response_time',
      'error_rate',
      'throughput',
      'memory_usage',
      'cpu_usage',
      'database_connections',
      'cache_hit_rate',
      'pusher_events_per_second'
    ],

    // Alert thresholds
    alerts: {
      responseTime: 5000,     // Alert if response time > 5s
      errorRate: 0.05,        // Alert if error rate > 5%
      memoryUsage: 0.8,       // Alert if memory usage > 80%
      cpuUsage: 0.9           // Alert if CPU usage > 90%
    }
  },

  // Test environment configuration
  environment: {
    // Base URL for testing
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    
    // Database configuration
    database: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      maxConnections: 50,
      connectionTimeout: 30000
    },

    // Redis configuration
    redis: {
      url: process.env.TEST_REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
      maxConnections: 100,
      connectionTimeout: 10000
    },

    // Vercel KV configuration
    vercelKV: {
      url: process.env.TEST_KV_URL || process.env.KV_REST_API_URL,
      maxConnections: 50,
      connectionTimeout: 10000
    },

    // Pusher configuration
    pusher: {
      appId: process.env.TEST_PUSHER_APP_ID || process.env.PUSHER_APP_ID,
      key: process.env.TEST_PUSHER_KEY || process.env.PUSHER_KEY,
      secret: process.env.TEST_PUSHER_SECRET || process.env.PUSHER_SECRET,
      cluster: process.env.TEST_PUSHER_CLUSTER || process.env.PUSHER_CLUSTER
    }
  },

  // Test execution configuration
  execution: {
    // Parallel execution
    parallel: {
      enabled: true,
      maxConcurrent: 10,  // Maximum 10 parallel test runs
      delay: 1000         // 1 second delay between parallel runs
    },

    // Retry configuration
    retry: {
      enabled: true,
      maxRetries: 3,
      retryDelay: 5000    // 5 seconds between retries
    },

    // Timeout configuration
    timeout: {
      global: 300000,     // 5 minutes global timeout
      request: 30000,     // 30 seconds request timeout
      test: 600000        // 10 minutes test timeout
    }
  },

  // Reporting configuration
  reporting: {
    // Output formats
    formats: ['json', 'html', 'csv'],
    
    // Output directory
    outputDir: './test-results/load-tests',
    
    // Report generation
    generate: {
      summary: true,
      detailed: true,
      charts: true,
      recommendations: true
    }
  }
};
