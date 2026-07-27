'use client';

import { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Users,
  Clock,
  Zap,
  CheckCircle,
  XCircle,
  Radio,
  TrendingUp,
  ExternalLink,
  AlertCircle,
  Terminal,
  CheckCircle2,
  Plus,
  Sparkles
} from 'lucide-react';
import { usePartySimulator } from '@/hooks/usePartySimulator';
import {
  SimulationConfig,
  SimulationDurationMs,
  SimulationStats,
  DEFAULT_SIMULATION_DURATION_MS,
  SIMULATION_DURATION_OPTIONS,
  formatRemainingTime,
  formatSimulationDurationLabel,
} from '@/lib/party-simulator-shared';
import Checkbox from '@/components/ui/Checkbox';
import { authenticatedFetch } from '@/lib/api/authenticated-fetch';

const EMPTY_STATS: SimulationStats = {
  isRunning: false,
  requestsSent: 0,
  requestsSuccessful: 0,
  requestsFailed: 0,
  startedAt: null,
  endsAt: null,
  lastRequestAt: null,
  activeRequesters: [],
  logs: []
};

export default function PartyTestPage() {
  // Environment detection
  const isProduction = typeof window !== 'undefined' && 
                      window.location.hostname !== 'localhost';
  const useClientSide = isProduction;

  // Client-side simulator hook (production) — backed by a module singleton
  const {
    stats: clientStats,
    startSimulation: startClientSimulation,
    stopSimulation: stopClientSimulation,
    triggerManualRequest: triggerClientManualRequest,
    triggerManualBurst: triggerClientManualBurst,
    getRunningConfig,
  } = usePartySimulator();

  const [config, setConfig] = useState<SimulationConfig>({
    environment: isProduction ? 'production' : 'local',
    username: '',
    requestPin: '',
    requestInterval: 300000, // 5 minutes (default)
    uniqueRequesters: 5,
    burstMode: false,
    explicitSongs: false,
    durationMs: DEFAULT_SIMULATION_DURATION_MS,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualTriggerLoading, setManualTriggerLoading] = useState(false);
  // Server-side simulator stats (local development)
  const [serverStats, setServerStats] = useState<SimulationStats>(EMPTY_STATS);
  const stats = useClientSide ? clientStats : serverStats;
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick while running so remaining time stays current across remounts
  useEffect(() => {
    if (!stats.isRunning || !stats.endsAt) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stats.isRunning, stats.endsAt]);

  // Restore config form when remounting onto an already-running client simulation
  useEffect(() => {
    if (!useClientSide) return;
    const runningConfig = getRunningConfig();
    if (runningConfig && clientStats.isRunning) {
      setConfig(runningConfig);
    }
  }, [useClientSide, clientStats.isRunning, getRunningConfig]);

  // Server-side stats polling (only for local development)
  useEffect(() => {
    if (useClientSide) return; // Skip server polling in production

    const interval = setInterval(() => {
      fetchStats();
    }, 2000);

    return () => clearInterval(interval);
  }, [useClientSide]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/superadmin/party-simulator', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setServerStats(data.stats);
      } else if (response.status === 500) {
        // Don't spam errors for 500s during polling, just log
        console.error('Error fetching stats: 500 Internal Server Error');
      }
    } catch (err) {
      // Silent fail during polling to avoid console spam
      console.error('Error fetching stats:', err);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');

    const code = config.requestPin?.trim() || '';
    if (!code || (code.length !== 6 && code.length !== 8 && code.length !== 4)) {
      setError('Enter a valid access code (6-digit or 8-char secure) from the DJ admin panel');
      setLoading(false);
      return;
    }

    try {
      if (useClientSide) {
        // Client-side implementation
        startClientSimulation(config);
      } else {
        // Server-side implementation (local development)
        const response = await authenticatedFetch('/api/superadmin/party-simulator', {
          method: 'POST',
          body: JSON.stringify(config)
        });

        const data = await response.json();

        if (!response.ok) {
          const errorMsg = response.status === 500 
            ? `Server error (500): ${data.error || 'Failed to start simulation'}. Check server logs for details.`
            : (data.error || 'Failed to start simulation');
          setError(errorMsg);
          return;
        }

        setServerStats(data.stats);
      }
    } catch (error: unknown) {
      setError(`Network error: ${(error instanceof Error ? error.message : String(error)) || 'Could not connect to server'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError('');

    try {
      if (useClientSide) {
        // Client-side implementation
        stopClientSimulation();
      } else {
        // Server-side implementation (local development)
        const response = await authenticatedFetch('/api/superadmin/party-simulator', {
          method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to stop simulation');
          return;
        }

        setServerStats(data.stats);
      }
    } catch (error: unknown) {
      setError((error instanceof Error ? error.message : String(error)) || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRequest = async () => {
    if (manualTriggerLoading || !stats.isRunning) return;
    
    setManualTriggerLoading(true);
    try {
      if (useClientSide) {
        // Client-side implementation
        await triggerClientManualRequest();
      } else {
        // Server-side implementation (local development)
        const response = await authenticatedFetch('/api/superadmin/party-simulator/trigger', {
          method: 'POST',
          body: JSON.stringify({ type: 'single' })
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to trigger request');
        }
        
        // Stats will update via polling
        await fetchStats();
      }
    } catch (error: unknown) {
      setError((error instanceof Error ? error.message : String(error)) || 'Network error');
    } finally {
      setManualTriggerLoading(false);
    }
  };

  const handleManualBurst = async () => {
    if (manualTriggerLoading || !stats.isRunning) return;
    
    setManualTriggerLoading(true);
    try {
      if (useClientSide) {
        // Client-side implementation
        await triggerClientManualBurst();
      } else {
        // Server-side implementation (local development)
        const response = await authenticatedFetch('/api/superadmin/party-simulator/trigger', {
          method: 'POST',
          body: JSON.stringify({ type: 'burst' })
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to trigger burst');
        }
        
        // Stats will update via polling
        await fetchStats();
      }
    } catch (error: unknown) {
      setError((error instanceof Error ? error.message : String(error)) || 'Network error');
    } finally {
      setManualTriggerLoading(false);
    }
  };

  const getSuccessRate = () => {
    if (stats.requestsSent === 0) return 0;
    return Math.round((stats.requestsSuccessful / stats.requestsSent) * 100);
  };

  const formatDuration = (isoDate: string | null) => {
    if (!isoDate) return '0s';
    const start = new Date(isoDate);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatTimestamp = (isoDate: string | null) => {
    if (!isoDate) return 'Never';
    return new Date(isoDate).toLocaleTimeString();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-bone mb-2">Party Simulator</h1>
        <p className="text-muted">Test your party with simulated requests from virtual users</p>
      </div>

      {/* Status Banner */}
      {stats.isRunning && (
        <div className="bg-accent/20 border-2 border-accent rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Radio className="w-6 h-6 text-accent animate-pulse" />
            <div>
              <p className="text-bone font-bold">Simulation Running</p>
              <p className="text-muted text-sm">
                Elapsed: {formatDuration(stats.startedAt)}
                {stats.endsAt && (
                  <> • Remaining: {formatRemainingTime(stats.endsAt, nowMs)}</>
                )}
                {' '}• Last request: {formatTimestamp(stats.lastRequestAt)}
              </p>
            </div>
          </div>
          
          {/* Manual Trigger Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleManualRequest}
              disabled={manualTriggerLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-accent hover:bg-accent disabled:bg-accent/70 disabled:cursor-not-allowed text-bone rounded-lg font-medium transition-colors duration-200"
              title="Manually trigger a single random request"
            >
              <Plus className={`w-4 h-4 ${manualTriggerLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Add Request</span>
            </button>
            
            <button
              onClick={handleManualBurst}
              disabled={manualTriggerLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-bone rounded-lg font-medium transition-colors duration-200"
              title="Manually trigger a burst of 2-4 random requests"
            >
              <Sparkles className={`w-4 h-4 ${manualTriggerLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Add Burst</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode Indicator (execution mode, not simulation status) */}
      {useClientSide ? (
        <div className="bg-accent/20 border border-accent/50 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-accent font-semibold mb-1 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Client-Side Mode (Production)
              </p>
              <p className="text-muted text-sm">
                Continues while you browse this site; closing the tab stops it.
                It auto-stops after the run duration you select below.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Radio className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-accent font-semibold mb-1">Server-Side Mode (Local Development)</p>
              <p className="text-muted text-sm">
                The simulation runs on the server using setTimeout, which works perfectly in local development 
                but not in Vercel&apos;s serverless environment. This mode is ideal for development and testing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-300 transition-colors ml-4"
            aria-label="Dismiss error"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="bg-surface backdrop-blur-md rounded-xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold text-bone mb-6">Configuration</h2>

          <div className="space-y-6">
            {/* Environment Selection */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Environment
              </label>
              <select
                value={config.environment}
                onChange={(e) => setConfig({ ...config, environment: e.target.value as 'local' | 'production' })}
                disabled={stats.isRunning}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                <option value="local" className="bg-gray-900">Local (localhost:3000)</option>
                <option value="production" className="bg-gray-900">Production (partyplaylist.co.uk)</option>
              </select>
              <p className="text-xs text-faint mt-1">
                Choose where to send test requests
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Username
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                disabled={stats.isRunning}
                placeholder="testuser1"
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              />
              <p className="text-xs text-faint mt-1">
                The user account to test (e.g., testuser1, testuser2, etc.)
              </p>
            </div>

            {/* Access code */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Access code (required)
              </label>
              <input
                type="text"
                value={config.requestPin}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    requestPin: e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toUpperCase(),
                  })
                }
                disabled={stats.isRunning}
                placeholder="101234"
                maxLength={8}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone placeholder-faint focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 font-mono tracking-wider"
              />
              <p className="text-xs text-faint mt-1">
                6-digit (or 8-char secure) access code from the DJ admin panel
              </p>
            </div>

            {/* Run duration (auto-stop) */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Run Duration</span>
                </span>
                <span className="text-accent font-mono">
                  {formatSimulationDurationLabel(config.durationMs)}
                </span>
              </label>
              <select
                value={config.durationMs}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    durationMs: Number(e.target.value) as SimulationDurationMs,
                  })
                }
                disabled={stats.isRunning}
                className="w-full px-4 py-2 bg-surface border border-white/10 rounded-lg text-bone focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
              >
                {SIMULATION_DURATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-gray-900">
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-faint mt-1">
                Auto-stops after this time. Continues while you browse this site; closing the tab stops it.
              </p>
            </div>

            {/* Request Interval */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Request Interval</span>
                </span>
                <span className="text-accent font-mono">
                  {config.requestInterval >= 60000 
                    ? `${Math.round(config.requestInterval / 60000)}m` 
                    : `${config.requestInterval / 1000}s`}
                </span>
              </label>
              <input
                type="range"
                min="60000"
                max="1800000"
                step="60000"
                value={config.requestInterval}
                onChange={(e) => setConfig({ ...config, requestInterval: parseInt(e.target.value) })}
                disabled={stats.isRunning}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-faint mt-1">
                <span>Fast (1m)</span>
                <span>Slow (30m)</span>
              </div>
            </div>

            {/* Unique Requesters */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Unique Requesters</span>
                </span>
                <span className="text-accent font-mono">{config.uniqueRequesters}</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={config.uniqueRequesters}
                onChange={(e) => setConfig({ ...config, uniqueRequesters: parseInt(e.target.value) })}
                disabled={stats.isRunning}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-faint mt-1">
                <span>1 person</span>
                <span>20 people</span>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="burst-mode"
                  checked={config.burstMode}
                  onChange={(e) => setConfig({ ...config, burstMode: e.target.checked })}
                  disabled={stats.isRunning}
                />
                <label htmlFor="burst-mode" className="text-sm text-muted flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>Burst Mode (occasional multiple requests at once)</span>
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="explicit-songs"
                  checked={config.explicitSongs}
                  onChange={(e) => setConfig({ ...config, explicitSongs: e.target.checked })}
                  disabled={stats.isRunning}
                />
                <label htmlFor="explicit-songs" className="text-sm text-muted flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <span>Include Explicit Songs</span>
                </label>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="pt-4 space-y-3">
              {!stats.isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={loading || !config.username}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-accent hover:bg-accent-hover text-ink rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" />
                  <span>{loading ? 'Starting...' : 'Start Simulation'}</span>
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-bone rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-red-500/50 disabled:opacity-50"
                >
                  <Square className="w-5 h-5" />
                  <span>{loading ? 'Stopping...' : 'Stop Simulation'}</span>
                </button>
              )}

              {config.username && (
                <a
                  href={`${config.environment === 'local' ? 'http://localhost:3000' : 'https://partyplaylist.co.uk'}/${config.username}/request`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center space-x-2 px-6 py-2 bg-surface hover:bg-white/20 text-bone rounded-lg font-medium transition-colors border border-white/10"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Request Page</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Panel */}
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Total Requests */}
            <div className="bg-surface backdrop-blur-md rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted text-sm">Total Requests</span>
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
              <p className="text-3xl font-bold text-bone">{stats.requestsSent}</p>
            </div>

            {/* Success Rate */}
            <div className="bg-surface backdrop-blur-md rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted text-sm">Success Rate</span>
                <CheckCircle className="w-5 h-5 text-accent" />
              </div>
              <p className="text-3xl font-bold text-bone">{getSuccessRate()}%</p>
            </div>

            {/* Successful */}
            <div className="bg-accent/20 backdrop-blur-md rounded-xl p-6 border border-accent/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-accent text-sm">Successful</span>
                <CheckCircle className="w-5 h-5 text-accent" />
              </div>
              <p className="text-3xl font-bold text-accent">{stats.requestsSuccessful}</p>
            </div>

            {/* Failed */}
            <div className="bg-red-500/20 backdrop-blur-md rounded-xl p-6 border border-red-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-300 text-sm">Failed</span>
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-3xl font-bold text-red-400">{stats.requestsFailed}</p>
            </div>
          </div>

          {/* Active Requesters */}
          {stats.activeRequesters.length > 0 && (
            <div className="bg-surface backdrop-blur-md rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-bold text-bone mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5 text-accent" />
                <span>Active Requesters ({stats.activeRequesters.length})</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.activeRequesters.map((name) => (
                  <span
                    key={name}
                    className="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-medium border border-accent/30"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Console Logs or Info Box */}
          {stats.isRunning && stats.logs && stats.logs.length > 0 ? (
            <div className="bg-black/50 backdrop-blur-md rounded-xl p-6 border border-accent/30">
              <h3 className="text-lg font-bold text-accent mb-3 flex items-center space-x-2">
                <Terminal className="w-5 h-5" />
                <span>Live Console ({stats.logs.length} requests)</span>
              </h3>
              <div className="max-h-96 overflow-y-auto space-y-2 font-mono text-xs">
                {stats.logs.map((log, index) => (
                  <div 
                    key={`${log.timestamp}-${index}`}
                    className={`p-3 rounded-lg border ${
                      log.status === 'success' 
                        ? 'bg-accent/10 border-accent/30 text-accent' 
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-faint">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {log.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="text-bone">
                      <span className="font-semibold">{log.requester}</span> requested
                    </div>
                    <div className="text-muted">
                      &quot;{log.song}&quot; by {log.artist}
                    </div>
                    {log.error && (
                      <div className="text-red-300 mt-1 text-xs">
                        Error: {log.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-accent/10 backdrop-blur-md rounded-xl p-6 border border-accent/30">
              <h3 className="text-lg font-bold text-accent mb-3">How It Works</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-start space-x-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>The simulator sends realistic song requests to your party as different virtual users</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>Each request searches for popular party songs and submits them like a real guest</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>Burst mode simulates busy periods with 2-4 requests in quick succession</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-accent mt-0.5">•</span>
                  <span>Use this to test your admin interface, Pusher updates, and queue management</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

