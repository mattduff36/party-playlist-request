/**
 * Metrics Collection System
 * 
 * This module provides comprehensive metrics collection for monitoring
 * system performance, health, and usage patterns.
 */

export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  // Performance metrics
  responseTime: number;
  throughput: number;
  errorRate: number;
  
  // Resource metrics
  memoryUsage: number;
  cpuUsage: number;
  diskUsage?: number;
  
  // Database metrics
  dbConnections: number;
  dbQueryTime: number;
  dbErrorRate: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheSize: number;
  cacheEvictions: number;
  
  // Pusher metrics
  pusherEventsPerSecond: number;
  pusherConnectionCount: number;
  pusherErrorRate: number;
  
  // Business metrics
  activeUsers: number;
  requestsPerMinute: number;
  eventsActive: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: keyof SystemMetrics;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // seconds
  lastTriggered?: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

class MetricsCollector {
  private metrics: Map<string, MetricData[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alerts: Alert[] = [];
  private isCollecting: boolean = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultAlertRules();
  }

  /**
   * Start collecting metrics
   */
  startCollection(intervalMs: number = 30000) {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);

    console.log('📊 Metrics collection started');
  }

  /**
   * Stop collecting metrics
   */
  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    this.isCollecting = false;
    console.log('📊 Metrics collection stopped');
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: MetricData) {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricList = this.metrics.get(metric.name)!;
    metricList.push(metric);

    // Keep only last 1000 metrics per type
    if (metricList.length > 1000) {
      metricList.splice(0, metricList.length - 1000);
    }

    // Check for alerts
    this.checkAlerts(metric);
  }

  /**
   * Get current system metrics
   */
  getCurrentMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    
    return {
      responseTime: this.getAverageMetric('response_time') || 0,
      throughput: this.getAverageMetric('throughput') || 0,
      errorRate: this.getAverageMetric('error_rate') || 0,
      memoryUsage: memoryUsage.heapUsed,
      cpuUsage: this.getAverageMetric('cpu_usage') || 0,
      dbConnections: this.getAverageMetric('db_connections') || 0,
      dbQueryTime: this.getAverageMetric('db_query_time') || 0,
      dbErrorRate: this.getAverageMetric('db_error_rate') || 0,
      cacheHitRate: this.getAverageMetric('cache_hit_rate') || 0,
      cacheSize: this.getAverageMetric('cache_size') || 0,
      cacheEvictions: this.getAverageMetric('cache_evictions') || 0,
      pusherEventsPerSecond: this.getAverageMetric('pusher_events_per_second') || 0,
      pusherConnectionCount: this.getAverageMetric('pusher_connection_count') || 0,
      pusherErrorRate: this.getAverageMetric('pusher_error_rate') || 0,
      activeUsers: this.getAverageMetric('active_users') || 0,
      requestsPerMinute: this.getAverageMetric('requests_per_minute') || 0,
      eventsActive: this.getAverageMetric('events_active') || 0,
    };
  }

  /**
   * Get metrics for a specific time range
   */
  getMetrics(name: string, startTime?: number, endTime?: number): MetricData[] {
    const metricList = this.metrics.get(name) || [];
    
    if (!startTime && !endTime) {
      return metricList;
    }

    return metricList.filter(metric => {
      if (startTime && metric.timestamp < startTime) return false;
      if (endTime && metric.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Add an alert rule
   */
  addAlertRule(rule: AlertRule) {
    this.alertRules.set(rule.id, rule);
    console.log(`🚨 Alert rule added: ${rule.name}`);
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string) {
    this.alertRules.delete(ruleId);
    console.log(`🚨 Alert rule removed: ${ruleId}`);
  }

  /**
   * Get all alerts
   */
  getAlerts(resolved?: boolean): Alert[] {
    if (resolved === undefined) {
      return this.alerts;
    }
    return this.alerts.filter(alert => alert.resolved === resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      console.log(`✅ Alert resolved: ${alert.message}`);
    }
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    const total = this.alerts.length;
    const resolved = this.alerts.filter(a => a.resolved).length;
    const critical = this.alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
    const high = this.alerts.filter(a => a.severity === 'high' && !a.resolved).length;

    return {
      total,
      resolved,
      unresolved: total - resolved,
      critical,
      high,
      medium: this.alerts.filter(a => a.severity === 'medium' && !a.resolved).length,
      low: this.alerts.filter(a => a.severity === 'low' && !a.resolved).length,
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json') {
    const currentMetrics = this.getCurrentMetrics();
    
    if (format === 'prometheus') {
      return this.exportPrometheusFormat(currentMetrics);
    }
    
    return {
      timestamp: Date.now(),
      metrics: currentMetrics,
      alertStats: this.getAlertStats(),
    };
  }

  private collectSystemMetrics() {
    const timestamp = Date.now();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    this.recordMetric({
      name: 'memory_usage',
      value: memoryUsage.heapUsed,
      timestamp,
      tags: { type: 'heap_used' }
    });

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.recordMetric({
      name: 'cpu_usage',
      value: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      timestamp
    });

    // Event loop lag
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      this.recordMetric({
        name: 'event_loop_lag',
        value: lag,
        timestamp: Date.now()
      });
    });
  }

  private getAverageMetric(name: string): number {
    const metricList = this.metrics.get(name) || [];
    if (metricList.length === 0) return 0;

    const sum = metricList.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metricList.length;
  }

  private checkAlerts(metric: MetricData) {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check if this metric matches the rule
      if (this.metricMatchesRule(metric, rule)) {
        this.evaluateAlertRule(metric, rule);
      }
    }
  }

  private metricMatchesRule(metric: MetricData, rule: AlertRule): boolean {
    // Map metric names to system metrics keys
    const metricMap: Record<string, keyof SystemMetrics> = {
      'response_time': 'responseTime',
      'throughput': 'throughput',
      'error_rate': 'errorRate',
      'memory_usage': 'memoryUsage',
      'cpu_usage': 'cpuUsage',
      'db_connections': 'dbConnections',
      'db_query_time': 'dbQueryTime',
      'db_error_rate': 'dbErrorRate',
      'cache_hit_rate': 'cacheHitRate',
      'cache_size': 'cacheSize',
      'cache_evictions': 'cacheEvictions',
      'pusher_events_per_second': 'pusherEventsPerSecond',
      'pusher_connection_count': 'pusherConnectionCount',
      'pusher_error_rate': 'pusherErrorRate',
      'active_users': 'activeUsers',
      'requests_per_minute': 'requestsPerMinute',
      'events_active': 'eventsActive',
    };

    const metricKey = metricMap[metric.name];
    return metricKey === rule.metric;
  }

  private evaluateAlertRule(metric: MetricData, rule: AlertRule) {
    const now = Date.now();
    
    // Check cooldown
    if (rule.lastTriggered && (now - rule.lastTriggered) < (rule.cooldown * 1000)) {
      return;
    }

    let shouldAlert = false;
    const value = metric.value;
    const threshold = rule.threshold;

    switch (rule.operator) {
      case 'gt':
        shouldAlert = value > threshold;
        break;
      case 'lt':
        shouldAlert = value < threshold;
        break;
      case 'eq':
        shouldAlert = value === threshold;
        break;
      case 'gte':
        shouldAlert = value >= threshold;
        break;
      case 'lte':
        shouldAlert = value <= threshold;
        break;
    }

    if (shouldAlert) {
      this.createAlert(metric, rule);
      rule.lastTriggered = now;
    }
  }

  private createAlert(metric: MetricData, rule: AlertRule) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${metric.name} is ${rule.operator} ${rule.threshold} (current: ${metric.value})`,
      metric: metric.name,
      value: metric.value,
      threshold: rule.threshold,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);
    console.log(`🚨 ALERT [${rule.severity.toUpperCase()}]: ${alert.message}`);
  }

  private exportPrometheusFormat(metrics: SystemMetrics): string {
    const lines: string[] = [];
    
    lines.push('# HELP party_playlist_response_time_seconds Response time in seconds');
    lines.push('# TYPE party_playlist_response_time_seconds gauge');
    lines.push(`party_playlist_response_time_seconds ${metrics.responseTime / 1000}`);
    
    lines.push('# HELP party_playlist_throughput_requests_per_second Throughput in requests per second');
    lines.push('# TYPE party_playlist_throughput_requests_per_second gauge');
    lines.push(`party_playlist_throughput_requests_per_second ${metrics.throughput}`);
    
    lines.push('# HELP party_playlist_error_rate Error rate as percentage');
    lines.push('# TYPE party_playlist_error_rate gauge');
    lines.push(`party_playlist_error_rate ${metrics.errorRate}`);
    
    lines.push('# HELP party_playlist_memory_usage_bytes Memory usage in bytes');
    lines.push('# TYPE party_playlist_memory_usage_bytes gauge');
    lines.push(`party_playlist_memory_usage_bytes ${metrics.memoryUsage}`);
    
    lines.push('# HELP party_playlist_cpu_usage_seconds CPU usage in seconds');
    lines.push('# TYPE party_playlist_cpu_usage_seconds gauge');
    lines.push(`party_playlist_cpu_usage_seconds ${metrics.cpuUsage}`);
    
    lines.push('# HELP party_playlist_db_connections Database connections count');
    lines.push('# TYPE party_playlist_db_connections gauge');
    lines.push(`party_playlist_db_connections ${metrics.dbConnections}`);
    
    lines.push('# HELP party_playlist_cache_hit_rate Cache hit rate as percentage');
    lines.push('# TYPE party_playlist_cache_hit_rate gauge');
    lines.push(`party_playlist_cache_hit_rate ${metrics.cacheHitRate}`);
    
    lines.push('# HELP party_playlist_active_users Active users count');
    lines.push('# TYPE party_playlist_active_users gauge');
    lines.push(`party_playlist_active_users ${metrics.activeUsers}`);
    
    return lines.join('\n');
  }

  private initializeDefaultAlertRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        metric: 'responseTime',
        operator: 'gt',
        threshold: 2000, // 2 seconds
        severity: 'high',
        enabled: true,
        cooldown: 300, // 5 minutes
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'errorRate',
        operator: 'gt',
        threshold: 0.05, // 5%
        severity: 'critical',
        enabled: true,
        cooldown: 60, // 1 minute
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        metric: 'memoryUsage',
        operator: 'gt',
        threshold: 500 * 1024 * 1024, // 500MB
        severity: 'medium',
        enabled: true,
        cooldown: 600, // 10 minutes
      },
      {
        id: 'low_cache_hit_rate',
        name: 'Low Cache Hit Rate',
        metric: 'cacheHitRate',
        operator: 'lt',
        threshold: 0.8, // 80%
        severity: 'low',
        enabled: true,
        cooldown: 900, // 15 minutes
      },
      {
        id: 'high_db_connections',
        name: 'High Database Connections',
        metric: 'dbConnections',
        operator: 'gt',
        threshold: 20,
        severity: 'medium',
        enabled: true,
        cooldown: 300, // 5 minutes
      },
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Auto-start collection in production
if (process.env.NODE_ENV === 'production') {
  metricsCollector.startCollection(30000); // Collect every 30 seconds
}
