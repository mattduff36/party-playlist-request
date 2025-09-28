'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info';
  message: string;
}

export default function MobileConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isMobile) return;

    // Override console methods to capture logs
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    const addLog = (level: 'log' | 'error' | 'warn' | 'info', args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      const logEntry: LogEntry = {
        id: logIdRef.current++,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message
      };

      setLogs(prev => {
        const newLogs = [...prev, logEntry];
        // Keep only last 50 logs to prevent memory issues
        return newLogs.slice(-50);
      });

      // Auto-scroll to bottom
      setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      }, 100);
    };

    // Override console methods
    console.log = (...args) => {
      originalConsole.log(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLog('error', args);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog('warn', args);
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      addLog('info', args);
    };

    // Show console after a short delay
    setTimeout(() => setIsVisible(true), 1000);

    // Cleanup
    return () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    };
  }, [isMobile]);

  if (!isMobile || !isVisible) return null;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-300';
      case 'warn': return 'text-yellow-300';
      case 'info': return 'text-blue-300';
      default: return 'text-gray-300';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-900/20';
      case 'warn': return 'bg-yellow-900/20';
      case 'info': return 'bg-blue-900/20';
      default: return 'bg-gray-900/20';
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 bg-black/95 border-t border-gray-600 transition-all duration-300 ${
      isMinimized ? 'h-12' : 'h-80'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-600">
        <div className="flex items-center space-x-2">
          <span className="text-green-400 text-sm font-mono">📱 Mobile Console</span>
          <span className="text-gray-400 text-xs">({logs.length} logs)</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setLogs([])}
            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div 
          ref={logContainerRef}
          className="h-64 overflow-y-auto p-2 font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              No logs yet... Console output will appear here.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`mb-1 p-1 rounded ${getLevelBg(log.level)} border-l-2 ${
                  log.level === 'error' ? 'border-red-500' :
                  log.level === 'warn' ? 'border-yellow-500' :
                  log.level === 'info' ? 'border-blue-500' :
                  'border-gray-500'
                }`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-gray-500 text-xs flex-shrink-0">
                    {log.timestamp}
                  </span>
                  <span className={`text-xs flex-shrink-0 uppercase font-bold ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                </div>
                <div className={`mt-1 ${getLevelColor(log.level)} whitespace-pre-wrap break-all`}>
                  {log.message}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating toggle button when hidden */}
      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-4 right-4 bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg z-50"
        >
          📱
        </button>
      )}
    </div>
  );
}
