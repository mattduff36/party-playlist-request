/**
 * Load Testing Benchmarks
 * 
 * This module defines performance benchmarks and thresholds
 * for load testing scenarios.
 */

export interface Benchmark {
  name: string;
  description: string;
  thresholds: PerformanceThresholds;
  scenarios: string[];
}

export interface PerformanceThresholds {
  maxResponseTime: number; // milliseconds
  p95ResponseTime: number; // milliseconds
  p99ResponseTime: number; // milliseconds
  minRequestsPerSecond: number;
  maxErrorRate: number; // percentage
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // percentage
}

export interface BenchmarkResult {
  benchmark: string;
  passed: boolean;
  score: number; // 0-100
  details: BenchmarkDetail[];
}

export interface BenchmarkDetail {
  metric: string;
  expected: number;
  actual: number;
  passed: boolean;
  weight: number;
}

/**
 * Basic performance benchmarks
 */
export const basicBenchmarks: Benchmark = {
  name: 'Basic Performance',
  description: 'Standard performance requirements for normal operation',
  thresholds: {
    maxResponseTime: 2000, // 2 seconds
    p95ResponseTime: 1000, // 1 second
    p99ResponseTime: 1500, // 1.5 seconds
    minRequestsPerSecond: 50,
    maxErrorRate: 1, // 1%
    maxMemoryUsage: 512, // 512 MB
    maxCpuUsage: 80 // 80%
  },
  scenarios: ['Basic User Simulation']
};

/**
 * High load benchmarks
 */
export const highLoadBenchmarks: Benchmark = {
  name: 'High Load Performance',
  description: 'Performance requirements under high concurrent load',
  thresholds: {
    maxResponseTime: 5000, // 5 seconds
    p95ResponseTime: 3000, // 3 seconds
    p99ResponseTime: 4000, // 4 seconds
    minRequestsPerSecond: 200,
    maxErrorRate: 5, // 5%
    maxMemoryUsage: 1024, // 1 GB
    maxCpuUsage: 90 // 90%
  },
  scenarios: ['High Load Simulation', 'Real-time Synchronization Test']
};

/**
 * Stress test benchmarks
 */
export const stressTestBenchmarks: Benchmark = {
  name: 'Stress Test Performance',
  description: 'Performance requirements under extreme stress conditions',
  thresholds: {
    maxResponseTime: 10000, // 10 seconds
    p95ResponseTime: 8000, // 8 seconds
    p99ResponseTime: 9000, // 9 seconds
    minRequestsPerSecond: 100,
    maxErrorRate: 10, // 10%
    maxMemoryUsage: 2048, // 2 GB
    maxCpuUsage: 95 // 95%
  },
  scenarios: ['Stress Test']
};

/**
 * Memory leak benchmarks
 */
export const memoryLeakBenchmarks: Benchmark = {
  name: 'Memory Leak Detection',
  description: 'Memory usage requirements for long-running tests',
  thresholds: {
    maxResponseTime: 3000, // 3 seconds
    p95ResponseTime: 2000, // 2 seconds
    p99ResponseTime: 2500, // 2.5 seconds
    minRequestsPerSecond: 30,
    maxErrorRate: 2, // 2%
    maxMemoryUsage: 256, // 256 MB (should not grow significantly)
    maxCpuUsage: 70 // 70%
  },
  scenarios: ['Memory Leak Detection']
};

/**
 * Real-time benchmarks
 */
export const realTimeBenchmarks: Benchmark = {
  name: 'Real-time Performance',
  description: 'Performance requirements for real-time features',
  thresholds: {
    maxResponseTime: 1000, // 1 second
    p95ResponseTime: 500, // 500ms
    p99ResponseTime: 800, // 800ms
    minRequestsPerSecond: 100,
    maxErrorRate: 0.5, // 0.5%
    maxMemoryUsage: 256, // 256 MB
    maxCpuUsage: 60 // 60%
  },
  scenarios: ['Real-time Synchronization Test']
};

/**
 * All available benchmarks
 */
export const benchmarks: Benchmark[] = [
  basicBenchmarks,
  highLoadBenchmarks,
  stressTestBenchmarks,
  memoryLeakBenchmarks,
  realTimeBenchmarks
];

/**
 * Evaluate test results against benchmarks
 */
export function evaluateBenchmark(
  benchmark: Benchmark,
  testResults: any
): BenchmarkResult {
  const details: BenchmarkDetail[] = [];
  let totalWeight = 0;
  let passedWeight = 0;

  // Response time checks
  const responseTimeDetail: BenchmarkDetail = {
    metric: 'Average Response Time',
    expected: benchmark.thresholds.maxResponseTime,
    actual: testResults.averageResponseTime,
    passed: testResults.averageResponseTime <= benchmark.thresholds.maxResponseTime,
    weight: 20
  };
  details.push(responseTimeDetail);
  totalWeight += responseTimeDetail.weight;
  if (responseTimeDetail.passed) passedWeight += responseTimeDetail.weight;

  const p95Detail: BenchmarkDetail = {
    metric: 'P95 Response Time',
    expected: benchmark.thresholds.p95ResponseTime,
    actual: testResults.p95ResponseTime,
    passed: testResults.p95ResponseTime <= benchmark.thresholds.p95ResponseTime,
    weight: 25
  };
  details.push(p95Detail);
  totalWeight += p95Detail.weight;
  if (p95Detail.passed) passedWeight += p95Detail.weight;

  const p99Detail: BenchmarkDetail = {
    metric: 'P99 Response Time',
    expected: benchmark.thresholds.p99ResponseTime,
    actual: testResults.p99ResponseTime,
    passed: testResults.p99ResponseTime <= benchmark.thresholds.p99ResponseTime,
    weight: 15
  };
  details.push(p99Detail);
  totalWeight += p99Detail.weight;
  if (p99Detail.passed) passedWeight += p99Detail.weight;

  // Throughput checks
  const throughputDetail: BenchmarkDetail = {
    metric: 'Requests Per Second',
    expected: benchmark.thresholds.minRequestsPerSecond,
    actual: testResults.requestsPerSecond,
    passed: testResults.requestsPerSecond >= benchmark.thresholds.minRequestsPerSecond,
    weight: 20
  };
  details.push(throughputDetail);
  totalWeight += throughputDetail.weight;
  if (throughputDetail.passed) passedWeight += throughputDetail.weight;

  // Error rate checks
  const errorRate = testResults.totalRequests > 0 
    ? (testResults.failedRequests / testResults.totalRequests) * 100 
    : 0;
  const errorRateDetail: BenchmarkDetail = {
    metric: 'Error Rate',
    expected: benchmark.thresholds.maxErrorRate,
    actual: errorRate,
    passed: errorRate <= benchmark.thresholds.maxErrorRate,
    weight: 15
  };
  details.push(errorRateDetail);
  totalWeight += errorRateDetail.weight;
  if (errorRateDetail.passed) passedWeight += errorRateDetail.weight;

  // Memory usage checks
  const memoryDetail: BenchmarkDetail = {
    metric: 'Memory Usage',
    expected: benchmark.thresholds.maxMemoryUsage,
    actual: testResults.memoryUsage || 0,
    passed: (testResults.memoryUsage || 0) <= benchmark.thresholds.maxMemoryUsage,
    weight: 5
  };
  details.push(memoryDetail);
  totalWeight += memoryDetail.weight;
  if (memoryDetail.passed) passedWeight += memoryDetail.weight;

  const score = totalWeight > 0 ? (passedWeight / totalWeight) * 100 : 0;
  const passed = score >= 80; // 80% threshold for passing

  return {
    benchmark: benchmark.name,
    passed,
    score,
    details
  };
}

/**
 * Get benchmark by name
 */
export function getBenchmark(name: string): Benchmark | undefined {
  return benchmarks.find(benchmark => benchmark.name === name);
}

/**
 * Get all benchmark names
 */
export function getBenchmarkNames(): string[] {
  return benchmarks.map(benchmark => benchmark.name);
}

/**
 * Get benchmarks for a scenario
 */
export function getBenchmarksForScenario(scenarioName: string): Benchmark[] {
  return benchmarks.filter(benchmark => 
    benchmark.scenarios.includes(scenarioName)
  );
}

/**
 * Generate benchmark report
 */
export function generateBenchmarkReport(results: BenchmarkResult[]): string {
  let report = '# Load Testing Benchmark Report\n\n';
  
  for (const result of results) {
    report += `## ${result.benchmark}\n\n`;
    report += `**Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `**Score:** ${result.score.toFixed(1)}%\n\n`;
    
    report += '### Performance Metrics\n\n';
    report += '| Metric | Expected | Actual | Status |\n';
    report += '|--------|----------|--------|--------|\n';
    
    for (const detail of result.details) {
      const status = detail.passed ? '✅' : '❌';
      report += `| ${detail.metric} | ${detail.expected} | ${detail.actual.toFixed(2)} | ${status} |\n`;
    }
    
    report += '\n';
  }
  
  return report;
}

