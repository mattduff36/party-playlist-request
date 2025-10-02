/**
 * Tests for Load Testing Benchmarks
 */

import { describe, it, expect } from '@jest/globals';
import {
  basicBenchmarks,
  highLoadBenchmarks,
  stressTestBenchmarks,
  memoryLeakBenchmarks,
  realTimeBenchmarks,
  benchmarks,
  evaluateBenchmark,
  getBenchmark,
  getBenchmarkNames,
  getBenchmarksForScenario,
  generateBenchmarkReport
} from '../benchmarks';

describe('Load Testing Benchmarks', () => {
  describe('Benchmark Definitions', () => {
    it('should have correct basic benchmarks', () => {
      expect(basicBenchmarks.name).toBe('Basic Performance');
      expect(basicBenchmarks.thresholds.maxResponseTime).toBe(2000);
      expect(basicBenchmarks.thresholds.p95ResponseTime).toBe(1000);
      expect(basicBenchmarks.thresholds.p99ResponseTime).toBe(1500);
      expect(basicBenchmarks.thresholds.minRequestsPerSecond).toBe(50);
      expect(basicBenchmarks.thresholds.maxErrorRate).toBe(1);
      expect(basicBenchmarks.thresholds.maxMemoryUsage).toBe(512);
      expect(basicBenchmarks.thresholds.maxCpuUsage).toBe(80);
    });

    it('should have correct high load benchmarks', () => {
      expect(highLoadBenchmarks.name).toBe('High Load Performance');
      expect(highLoadBenchmarks.thresholds.maxResponseTime).toBe(5000);
      expect(highLoadBenchmarks.thresholds.p95ResponseTime).toBe(3000);
      expect(highLoadBenchmarks.thresholds.p99ResponseTime).toBe(4000);
      expect(highLoadBenchmarks.thresholds.minRequestsPerSecond).toBe(200);
      expect(highLoadBenchmarks.thresholds.maxErrorRate).toBe(5);
      expect(highLoadBenchmarks.thresholds.maxMemoryUsage).toBe(1024);
      expect(highLoadBenchmarks.thresholds.maxCpuUsage).toBe(90);
    });

    it('should have correct stress test benchmarks', () => {
      expect(stressTestBenchmarks.name).toBe('Stress Test Performance');
      expect(stressTestBenchmarks.thresholds.maxResponseTime).toBe(10000);
      expect(stressTestBenchmarks.thresholds.p95ResponseTime).toBe(8000);
      expect(stressTestBenchmarks.thresholds.p99ResponseTime).toBe(9000);
      expect(stressTestBenchmarks.thresholds.minRequestsPerSecond).toBe(100);
      expect(stressTestBenchmarks.thresholds.maxErrorRate).toBe(10);
      expect(stressTestBenchmarks.thresholds.maxMemoryUsage).toBe(2048);
      expect(stressTestBenchmarks.thresholds.maxCpuUsage).toBe(95);
    });

    it('should have correct memory leak benchmarks', () => {
      expect(memoryLeakBenchmarks.name).toBe('Memory Leak Detection');
      expect(memoryLeakBenchmarks.thresholds.maxResponseTime).toBe(3000);
      expect(memoryLeakBenchmarks.thresholds.p95ResponseTime).toBe(2000);
      expect(memoryLeakBenchmarks.thresholds.p99ResponseTime).toBe(2500);
      expect(memoryLeakBenchmarks.thresholds.minRequestsPerSecond).toBe(30);
      expect(memoryLeakBenchmarks.thresholds.maxErrorRate).toBe(2);
      expect(memoryLeakBenchmarks.thresholds.maxMemoryUsage).toBe(256);
      expect(memoryLeakBenchmarks.thresholds.maxCpuUsage).toBe(70);
    });

    it('should have correct real-time benchmarks', () => {
      expect(realTimeBenchmarks.name).toBe('Real-time Performance');
      expect(realTimeBenchmarks.thresholds.maxResponseTime).toBe(1000);
      expect(realTimeBenchmarks.thresholds.p95ResponseTime).toBe(500);
      expect(realTimeBenchmarks.thresholds.p99ResponseTime).toBe(800);
      expect(realTimeBenchmarks.thresholds.minRequestsPerSecond).toBe(100);
      expect(realTimeBenchmarks.thresholds.maxErrorRate).toBe(0.5);
      expect(realTimeBenchmarks.thresholds.maxMemoryUsage).toBe(256);
      expect(realTimeBenchmarks.thresholds.maxCpuUsage).toBe(60);
    });
  });

  describe('Benchmark Management', () => {
    it('should return all benchmarks', () => {
      expect(benchmarks).toHaveLength(5);
      expect(benchmarks).toContain(basicBenchmarks);
      expect(benchmarks).toContain(highLoadBenchmarks);
      expect(benchmarks).toContain(stressTestBenchmarks);
      expect(benchmarks).toContain(memoryLeakBenchmarks);
      expect(benchmarks).toContain(realTimeBenchmarks);
    });

    it('should get benchmark by name', () => {
      const benchmark = getBenchmark('Basic Performance');
      expect(benchmark).toBe(basicBenchmarks);
    });

    it('should return undefined for non-existent benchmark', () => {
      const benchmark = getBenchmark('Non-existent Benchmark');
      expect(benchmark).toBeUndefined();
    });

    it('should get all benchmark names', () => {
      const names = getBenchmarkNames();
      expect(names).toHaveLength(5);
      expect(names).toContain('Basic Performance');
      expect(names).toContain('High Load Performance');
      expect(names).toContain('Stress Test Performance');
      expect(names).toContain('Memory Leak Detection');
      expect(names).toContain('Real-time Performance');
    });

    it('should get benchmarks for scenario', () => {
      const basicBenchmarks = getBenchmarksForScenario('Basic User Simulation');
      expect(basicBenchmarks).toHaveLength(1);
      expect(basicBenchmarks[0].name).toBe('Basic Performance');
    });
  });

  describe('Benchmark Evaluation', () => {
    it('should evaluate passing results', () => {
      const testResults = {
        averageResponseTime: 1000,
        p95ResponseTime: 800,
        p99ResponseTime: 1200,
        requestsPerSecond: 100,
        totalRequests: 1000,
        failedRequests: 5,
        memoryUsage: 256
      };

      const result = evaluateBenchmark(basicBenchmarks, testResults);
      
      expect(result.benchmark).toBe('Basic Performance');
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(80);
      expect(result.details).toHaveLength(6);
    });

    it('should evaluate failing results', () => {
      const testResults = {
        averageResponseTime: 5000,
        p95ResponseTime: 4000,
        p99ResponseTime: 6000,
        requestsPerSecond: 10,
        totalRequests: 1000,
        failedRequests: 100,
        memoryUsage: 1024
      };

      const result = evaluateBenchmark(basicBenchmarks, testResults);
      
      expect(result.benchmark).toBe('Basic Performance');
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(80);
    });

    it('should handle zero requests', () => {
      const testResults = {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        totalRequests: 0,
        failedRequests: 0,
        memoryUsage: 0
      };

      const result = evaluateBenchmark(basicBenchmarks, testResults);
      
      expect(result.benchmark).toBe('Basic Performance');
      expect(result.details.find(d => d.metric === 'Error Rate')?.actual).toBe(0);
    });

    it('should calculate error rate correctly', () => {
      const testResults = {
        averageResponseTime: 1000,
        p95ResponseTime: 800,
        p99ResponseTime: 1200,
        requestsPerSecond: 100,
        totalRequests: 1000,
        failedRequests: 50,
        memoryUsage: 256
      };

      const result = evaluateBenchmark(basicBenchmarks, testResults);
      
      const errorRateDetail = result.details.find(d => d.metric === 'Error Rate');
      expect(errorRateDetail?.actual).toBe(5);
      expect(errorRateDetail?.passed).toBe(false); // 5% > 1% threshold
    });
  });

  describe('Benchmark Report Generation', () => {
    it('should generate report for passing results', () => {
      const results: any[] = [{
        benchmark: 'Basic Performance',
        passed: true,
        score: 95.5,
        details: [
          {
            metric: 'Average Response Time',
            expected: 2000,
            actual: 1000,
            passed: true,
            weight: 20
          }
        ]
      }];

      const report = generateBenchmarkReport(results);
      
      expect(report).toContain('# Load Testing Benchmark Report');
      expect(report).toContain('## Basic Performance');
      expect(report).toContain('**Status:** ✅ PASSED');
      expect(report).toContain('**Score:** 95.5%');
      expect(report).toContain('| Metric | Expected | Actual | Status |');
      expect(report).toContain('| Average Response Time | 2000 | 1000.00 | ✅ |');
    });

    it('should generate report for failing results', () => {
      const results: any[] = [{
        benchmark: 'Basic Performance',
        passed: false,
        score: 45.0,
        details: [
          {
            metric: 'Average Response Time',
            expected: 2000,
            actual: 5000,
            passed: false,
            weight: 20
          }
        ]
      }];

      const report = generateBenchmarkReport(results);
      
      expect(report).toContain('**Status:** ❌ FAILED');
      expect(report).toContain('**Score:** 45.0%');
      expect(report).toContain('| Average Response Time | 2000 | 5000.00 | ❌ |');
    });

    it('should generate report for multiple benchmarks', () => {
      const results: any[] = [
        {
          benchmark: 'Basic Performance',
          passed: true,
          score: 95.0,
          details: []
        },
        {
          benchmark: 'High Load Performance',
          passed: false,
          score: 60.0,
          details: []
        }
      ];

      const report = generateBenchmarkReport(results);
      
      expect(report).toContain('## Basic Performance');
      expect(report).toContain('## High Load Performance');
      expect(report).toContain('✅ PASSED');
      expect(report).toContain('❌ FAILED');
    });
  });
});

