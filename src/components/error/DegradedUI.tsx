/**
 * Degraded UI Component
 * 
 * This component provides appropriate UI based on the current degradation level
 * and gracefully handles service failures.
 */

'use client';

import React from 'react';
import { AlertTriangle, Wifi, WifiOff, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useGracefulDegradation } from '@/hooks/useGracefulDegradation';

interface DegradedUIProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showStatus?: boolean;
  className?: string;
}

export default function DegradedUI({ 
  children, 
  fallback, 
  showStatus = true, 
  className = '' 
}: DegradedUIProps) {
  const { currentLevel, getAllServiceStatuses, isFeatureAvailable } = useGracefulDegradation();

  // If system is fully operational, render children normally
  if (currentLevel.level === 'full') {
    return <>{children}</>;
  }

  // If custom fallback is provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Render degraded UI based on level
  return (
    <div className={`degraded-ui degraded-ui--${currentLevel.level} ${className}`}>
      {showStatus && <DegradationStatus />}
      {renderDegradedContent(currentLevel, children)}
    </div>
  );
}

function DegradationStatus() {
  const { currentLevel, getAllServiceStatuses } = useGracefulDegradation();
  const services = getAllServiceStatuses();

  const getStatusIcon = (level: string) => {
    switch (level) {
      case 'full':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'reduced':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'minimal':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Wifi className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (level: string) => {
    switch (level) {
      case 'full':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'reduced':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'minimal':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'offline':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className={`degradation-status border rounded-lg p-3 mb-4 ${getStatusColor(currentLevel.level)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon(currentLevel.level)}
          <span className="font-medium">
            System Status: {currentLevel.description}
          </span>
        </div>
        <div className="text-sm">
          {services.filter(s => s.available).length}/{services.length} services online
        </div>
      </div>
      
      {currentLevel.level !== 'full' && (
        <div className="mt-2 text-sm">
          <div className="font-medium mb-1">Available Features:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(currentLevel.features).map(([feature, available]) => (
              <span
                key={feature}
                className={`px-2 py-1 rounded text-xs ${
                  available 
                    ? 'bg-green-200 text-green-800' 
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderDegradedContent(level: any, children: React.ReactNode) {
  switch (level.level) {
    case 'reduced':
      return (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-medium text-yellow-800">Limited Functionality</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Some features are temporarily unavailable. Core functionality remains active.
                </p>
              </div>
            </div>
          </div>
          {children}
        </div>
      );

    case 'minimal':
      return (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <h3 className="font-medium text-orange-800">Minimal Mode</h3>
                <p className="text-sm text-orange-700 mt-1">
                  System is running in minimal mode. Only basic features are available.
                </p>
              </div>
            </div>
          </div>
          {children}
        </div>
      );

    case 'offline':
      return (
        <div className="text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md mx-auto">
            <WifiOff className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">System Offline</h2>
            <p className="text-red-700 mb-4">
              The system is currently offline for maintenance. Please try again later.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );

    default:
      return children;
  }
}

