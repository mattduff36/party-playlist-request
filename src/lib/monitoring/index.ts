/**
 * Monitoring System Index
 * 
 * This module exports all monitoring-related functionality
 * including metrics collection, alerting, and health checks.
 */

export { metricsCollector, type MetricData, type SystemMetrics, type AlertRule, type Alert } from './metrics';
export { alertingSystem, type AlertChannel, type AlertTemplate, type AlertDelivery } from './alerts';
export { healthCheckSystem, type HealthCheck, type SystemHealth } from './health';

// Re-export for convenience
export { default as MonitoringDashboard } from '../../components/monitoring/MonitoringDashboard';
