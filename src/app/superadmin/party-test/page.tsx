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
  AlertCircle
} from 'lucide-react';

interface SimulationStats {
  isRunning: boolean;
  requestsSent: number;
  requestsSuccessful: number;
  requestsFailed: number;
  startedAt: string | null;
  lastRequestAt: string | null;
  activeRequesters: string[];
}

export default function PartyTestPage() {
  const [stats, setStats] = useState<SimulationStats>({
    isRunning: false,
    requestsSent: 0,
    requestsSuccessful: 0,
    requestsFailed: 0,
    startedAt: null,
    lastRequestAt: null,
    activeRequesters: []
  });

  const [config, setConfig] = useState({
    targetUrl: '',
    requestInterval: 30000, // 30 seconds
    uniqueRequesters: 5,
    burstMode: false,
    explicitSongs: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Poll for stats every 2 seconds when running
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/superadmin/party-simulator', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/superadmin/party-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to start simulation');
        return;
      }

      setStats(data.stats);
    } catch (error: any) {
      setError(error.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/superadmin/party-simulator', {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to stop simulation');
        return;
      }

      setStats(data.stats);
    } catch (error: any) {
      setError(error.message || 'Network error');
    } finally {
      setLoading(false);
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
        <h1 className="text-4xl font-bold text-white mb-2">Party Simulator</h1>
        <p className="text-gray-300">Test your party with simulated requests from virtual users</p>
      </div>

      {/* Status Banner */}
      {stats.isRunning && (
        <div className="bg-[#1DB954]/20 border-2 border-[#1DB954] rounded-xl p-4 mb-6 flex items-center space-x-3">
          <Radio className="w-6 h-6 text-[#1DB954] animate-pulse" />
          <div>
            <p className="text-white font-bold">Simulation Running</p>
            <p className="text-gray-300 text-sm">
              Duration: {formatDuration(stats.startedAt)} • Last request: {formatTimestamp(stats.lastRequestAt)}
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 flex items-center space-x-3">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <p className="text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Configuration</h2>

          <div className="space-y-6">
            {/* Target URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Request Page URL
              </label>
              <input
                type="url"
                value={config.targetUrl}
                onChange={(e) => setConfig({ ...config, targetUrl: e.target.value })}
                disabled={stats.isRunning}
                placeholder="http://localhost:3000/testuser2/request"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954] disabled:opacity-50"
              />
              <p className="text-xs text-gray-400 mt-1">
                Copy the request page URL from your test user's party
              </p>
            </div>

            {/* Request Interval */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Request Interval</span>
                </span>
                <span className="text-[#1DB954] font-mono">{config.requestInterval / 1000}s</span>
              </label>
              <input
                type="range"
                min="5000"
                max="120000"
                step="5000"
                value={config.requestInterval}
                onChange={(e) => setConfig({ ...config, requestInterval: parseInt(e.target.value) })}
                disabled={stats.isRunning}
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Fast (5s)</span>
                <span>Slow (2m)</span>
              </div>
            </div>

            {/* Unique Requesters */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Unique Requesters</span>
                </span>
                <span className="text-[#1DB954] font-mono">{config.uniqueRequesters}</span>
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
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 person</span>
                <span>20 people</span>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="burst-mode"
                  checked={config.burstMode}
                  onChange={(e) => setConfig({ ...config, burstMode: e.target.checked })}
                  disabled={stats.isRunning}
                  className="w-4 h-4 rounded disabled:opacity-50"
                />
                <label htmlFor="burst-mode" className="text-sm text-gray-300 flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>Burst Mode (occasional multiple requests at once)</span>
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="explicit-songs"
                  checked={config.explicitSongs}
                  onChange={(e) => setConfig({ ...config, explicitSongs: e.target.checked })}
                  disabled={stats.isRunning}
                  className="w-4 h-4 rounded disabled:opacity-50"
                />
                <label htmlFor="explicit-songs" className="text-sm text-gray-300 flex items-center space-x-2">
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
                  disabled={loading || !config.targetUrl}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black rounded-full font-bold transition-all duration-300 shadow-lg hover:shadow-[#1DB954]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" />
                  <span>{loading ? 'Starting...' : 'Start Simulation'}</span>
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition-all duration-300 shadow-lg hover:shadow-red-500/50 disabled:opacity-50"
                >
                  <Square className="w-5 h-5" />
                  <span>{loading ? 'Stopping...' : 'Stop Simulation'}</span>
                </button>
              )}

              {config.targetUrl && (
                <a
                  href={config.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center space-x-2 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20"
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
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm">Total Requests</span>
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-white">{stats.requestsSent}</p>
            </div>

            {/* Success Rate */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm">Success Rate</span>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-white">{getSuccessRate()}%</p>
            </div>

            {/* Successful */}
            <div className="bg-green-500/20 backdrop-blur-md rounded-xl p-6 border border-green-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-300 text-sm">Successful</span>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-green-400">{stats.requestsSuccessful}</p>
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
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                <Users className="w-5 h-5 text-[#1DB954]" />
                <span>Active Requesters ({stats.activeRequesters.length})</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.activeRequesters.map((name) => (
                  <span
                    key={name}
                    className="px-3 py-1 bg-[#1DB954]/20 text-[#1DB954] rounded-full text-sm font-medium border border-[#1DB954]/30"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-500/10 backdrop-blur-md rounded-xl p-6 border border-blue-500/30">
            <h3 className="text-lg font-bold text-blue-300 mb-3">How It Works</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start space-x-2">
                <span className="text-[#1DB954] mt-0.5">•</span>
                <span>The simulator sends realistic song requests to your party as different virtual users</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[#1DB954] mt-0.5">•</span>
                <span>Each request searches for popular party songs and submits them like a real guest</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[#1DB954] mt-0.5">•</span>
                <span>Burst mode simulates busy periods with 2-4 requests in quick succession</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[#1DB954] mt-0.5">•</span>
                <span>Use this to test your admin interface, Pusher updates, and queue management</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

