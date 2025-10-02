/**
 * Load Testing Runner
 * 
 * This module provides the core functionality for running load tests
 * and collecting performance metrics.
 */

import { LoadTestScenario, LoadTestResult, LoadTestError, LoadTestAction } from './scenarios';

export interface LoadTestConfig {
  baseUrl: string;
  timeout: number;
  maxConcurrentUsers: number;
  retryAttempts: number;
  retryDelay: number;
  metricsInterval: number; // in milliseconds
}

export interface UserSession {
  id: string;
  startTime: number;
  endTime?: number;
  actions: UserAction[];
  errors: LoadTestError[];
}

export interface UserAction {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface LoadTestMetrics {
  totalUsers: number;
  activeUsers: number;
  completedUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export class LoadTestRunner {
  private config: LoadTestConfig;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private users: Map<string, UserSession> = new Map();
  private metrics: LoadTestMetrics;
  private metricsInterval: NodeJS.Timeout | null = null;
  private onProgress?: (metrics: LoadTestMetrics) => void;
  private onComplete?: (result: LoadTestResult) => void;

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): LoadTestMetrics {
    return {
      totalUsers: 0,
      activeUsers: 0,
      completedUsers: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  /**
   * Run a load test scenario
   */
  async runScenario(
    scenario: LoadTestScenario,
    onProgress?: (metrics: LoadTestMetrics) => void,
    onComplete?: (result: LoadTestResult) => void
  ): Promise<LoadTestResult> {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.isRunning = true;
    this.startTime = Date.now();
    this.users.clear();
    this.metrics = this.initializeMetrics();

    console.log(`Starting load test: ${scenario.name}`);
    console.log(`Duration: ${scenario.duration}s, Users: ${scenario.userCount}`);

    // Start metrics collection
    this.startMetricsCollection();

    // Ramp up users
    await this.rampUpUsers(scenario);

    // Run the test for the specified duration
    await this.runTestDuration(scenario);

    // Wait for all users to complete
    await this.waitForCompletion();

    // Stop metrics collection
    this.stopMetricsCollection();

    // Generate final result
    const result = this.generateResult(scenario);
    
    this.isRunning = false;
    this.onComplete?.(result);
    
    return result;
  }

  /**
   * Ramp up users gradually
   */
  private async rampUpUsers(scenario: LoadTestScenario): Promise<void> {
    const rampUpInterval = (scenario.rampUpTime * 1000) / scenario.userCount;
    
    for (let i = 0; i < scenario.userCount; i++) {
      if (!this.isRunning) break;
      
      const userId = `user_${i}_${Date.now()}`;
      this.startUser(userId, scenario);
      
      // Wait before starting next user
      if (i < scenario.userCount - 1) {
        await new Promise(resolve => setTimeout(resolve, rampUpInterval));
      }
    }
  }

  /**
   * Start a user session
   */
  private startUser(userId: string, scenario: LoadTestScenario): void {
    const session: UserSession = {
      id: userId,
      startTime: Date.now(),
      actions: [],
      errors: []
    };

    this.users.set(userId, session);
    this.metrics.totalUsers++;
    this.metrics.activeUsers++;

    // Start user simulation
    this.simulateUser(userId, scenario);
  }

  /**
   * Simulate user behavior
   */
  private async simulateUser(userId: string, scenario: LoadTestScenario): Promise<void> {
    const session = this.users.get(userId);
    if (!session) return;

    const endTime = this.startTime + (scenario.duration * 1000);

    while (this.isRunning && Date.now() < endTime) {
      const action = this.selectAction(scenario.actions);
      if (!action) break;

      await this.executeAction(userId, action);
      
      // Wait between actions
      const delay = Math.random() * (action.maxDelay - action.minDelay) + action.minDelay;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Mark user as completed
    session.endTime = Date.now();
    this.metrics.activeUsers--;
    this.metrics.completedUsers++;
  }

  /**
   * Select an action based on weights
   */
  private selectAction(actions: LoadTestAction[]): LoadTestAction | null {
    const totalWeight = actions.reduce((sum, action) => sum + action.weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (const action of actions) {
      currentWeight += action.weight;
      if (random <= currentWeight) {
        return action;
      }
    }
    
    return actions[0] || null;
  }

  /**
   * Execute an action for a user
   */
  private async executeAction(userId: string, action: LoadTestAction): Promise<void> {
    const session = this.users.get(userId);
    if (!session) return;

    const actionStartTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      await action.execute();
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      session.errors.push({
        timestamp: Date.now(),
        action: action.name,
        error: error,
        userId: userId
      });
    }

    const actionEndTime = Date.now();
    const duration = actionEndTime - actionStartTime;

    session.actions.push({
      name: action.name,
      startTime: actionStartTime,
      endTime: actionEndTime,
      duration: duration,
      success: success,
      error: error
    });

    // Update metrics
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
  }

  /**
   * Run test for specified duration
   */
  private async runTestDuration(scenario: LoadTestScenario): Promise<void> {
    const duration = scenario.duration * 1000;
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Wait for all users to complete
   */
  private async waitForCompletion(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const startWait = Date.now();

    while (this.metrics.activeUsers > 0 && (Date.now() - startWait) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.onProgress?.(this.metrics);
    }, this.config.metricsInterval);
  }

  /**
   * Stop metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;

    // Calculate response times
    const allDurations: number[] = [];
    for (const session of this.users.values()) {
      for (const action of session.actions) {
        allDurations.push(action.duration);
      }
    }

    if (allDurations.length > 0) {
      allDurations.sort((a, b) => a - b);
      this.metrics.averageResponseTime = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
      this.metrics.p95ResponseTime = allDurations[Math.floor(allDurations.length * 0.95)];
      this.metrics.p99ResponseTime = allDurations[Math.floor(allDurations.length * 0.99)];
    }

    // Calculate requests per second
    this.metrics.requestsPerSecond = this.metrics.totalRequests / elapsed;

    // Calculate error rate
    this.metrics.errorRate = this.metrics.totalRequests > 0 
      ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
      : 0;

    // Get system metrics
    this.metrics.memoryUsage = this.getMemoryUsage();
    this.metrics.cpuUsage = this.getCpuUsage();
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    return 0;
  }

  /**
   * Get CPU usage
   */
  private getCpuUsage(): number {
    // This would need to be implemented with a proper CPU monitoring library
    // For now, return 0
    return 0;
  }

  /**
   * Generate final test result
   */
  private generateResult(scenario: LoadTestScenario): LoadTestResult {
    const allErrors: LoadTestError[] = [];
    for (const session of this.users.values()) {
      allErrors.push(...session.errors);
    }

    return {
      scenario: scenario.name,
      duration: scenario.duration,
      totalUsers: this.metrics.totalUsers,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      averageResponseTime: this.metrics.averageResponseTime,
      p95ResponseTime: this.metrics.p95ResponseTime,
      p99ResponseTime: this.metrics.p99ResponseTime,
      requestsPerSecond: this.metrics.requestsPerSecond,
      errors: allErrors
    };
  }

  /**
   * Stop the current test
   */
  stop(): void {
    this.isRunning = false;
    this.stopMetricsCollection();
  }

  /**
   * Check if test is running
   */
  isTestRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): LoadTestMetrics {
    return { ...this.metrics };
  }
}

