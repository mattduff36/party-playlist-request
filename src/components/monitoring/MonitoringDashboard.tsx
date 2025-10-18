/**
 * Monitoring Dashboard Component
 * 
 * This component provides a comprehensive monitoring dashboard
 * for administrators to view system health, metrics, and alerts.
 */

'use client';

import React, { useState, useEffect } from 'react';
// Minimal local UI shims to unblock build if shadcn components are missing
const Card = ({ children, className }: any) => <div className={`rounded border bg-white ${className || ''}`}>{children}</div>;
const CardHeader = ({ children, className }: any) => <div className={`p-4 border-b ${className || ''}`}>{children}</div>;
const CardTitle = ({ children, className }: any) => <div className={`text-lg font-semibold ${className || ''}`}>{children}</div>;
const CardContent = ({ children, className }: any) => <div className={`p-4 ${className || ''}`}>{children}</div>;
const Badge = ({ children, className }: any) => <span className={`inline-block px-2 py-1 rounded text-xs ${className || ''}`}>{children}</span>;
const Button = ({ children, className, onClick, size }: any) => (
  <button onClick={onClick} className={`inline-flex items-center px-3 py-2 border rounded ${className || ''}`}>{children}</button>
);
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  HardDrive, 
  Cpu,
  Wifi,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Settings
} from 'lucide-react';

interface SystemMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  dbConnections: number;
  cacheHitRate: number;
  pusherEventsPerSecond: number;
  activeUsers: number;
  requestsPerMinute: number;
  eventsActive: number;
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: number;
  responseTime?: number;
  details?: Record<string, any>;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
}

interface MonitoringData {
  timestamp: number;
  metrics: SystemMetrics;
  health: SystemHealth;
  alerts: {
    total: number;
    resolved: number;
    unresolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent: Alert[];
  };
  deliveries: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    retrying: number;
    successRate: number;
  };
  summary: {
    systemStatus: 'healthy' | 'degraded' | 'unhealthy';
    activeAlerts: number;
    criticalAlerts: number;
    deliverySuccessRate: number;
    uptime: number;
  };
}

function MonitoringDashboard() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/monitoring/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch monitoring data');
      }
      const monitoringData = await response.json();
      setData(monitoringData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading monitoring data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <XCircle className="h-8 w-8 text-red-500" />
        <span className="ml-2 text-red-500">Error: {error}</span>
        <Button onClick={fetchData} className="ml-4" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span>No monitoring data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-gray-600">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Auto Refresh
          </Button>
          <Button onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            {getStatusIcon(data.summary.systemStatus)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getStatusColor(data.summary.systemStatus)}>
                {data.summary.systemStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-gray-600">
              Uptime: {data.summary.uptime}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.activeAlerts}</div>
            <p className="text-xs text-gray-600">
              {data.summary.criticalAlerts} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.metrics.responseTime)}ms
            </div>
            <p className="text-xs text-gray-600">
              Average response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.metrics.activeUsers}</div>
            <p className="text-xs text-gray-600">
              Currently connected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Throughput</span>
              <span className="text-sm">{formatNumber(data.metrics.throughput)} req/s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Error Rate</span>
              <span className="text-sm">{(data.metrics.errorRate * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Requests/min</span>
              <span className="text-sm">{data.metrics.requestsPerMinute}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Active Events</span>
              <span className="text-sm">{data.metrics.eventsActive}</span>
            </div>
          </CardContent>
        </Card>

        {/* Resource Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <HardDrive className="h-5 w-5 mr-2" />
              Resource Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Memory Usage</span>
              <span className="text-sm">{formatBytes(data.metrics.memoryUsage)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">CPU Usage</span>
              <span className="text-sm">{formatNumber(data.metrics.cpuUsage)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">DB Connections</span>
              <span className="text-sm">{data.metrics.dbConnections}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Cache Hit Rate</span>
              <span className="text-sm">{(data.metrics.cacheHitRate * 100).toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            System Health Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.health.checks.map((check) => (
              <div key={check.name} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <div className="font-medium capitalize">
                      {check.name.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-gray-600">{check.message}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(check.status)}>
                    {check.status}
                  </Badge>
                  {check.responseTime && (
                    <span className="text-sm text-gray-500">
                      {check.responseTime}ms
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      {data.alerts.recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.alerts.recent.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <div>
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-sm text-gray-600">
                        {alert.metric}: {alert.value} (threshold: {alert.threshold})
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MonitoringDashboardWrapper() {
  if (process.env.NEXT_PUBLIC_ENABLE_MONITORING !== 'true') {
    return (
      <div className="p-6 text-sm text-gray-600">Monitoring dashboard is disabled.</div>
    );
  }
  return <MonitoringDashboard />;
}
