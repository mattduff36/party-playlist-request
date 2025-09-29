/**
 * State Control Panel Component
 * 
 * This component provides a simplified three-button interface for controlling
 * the event state (offline/standby/live) with clear visual feedback.
 */

'use client';

import { useState } from 'react';
import { Power, Play, Pause, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { useGlobalEvent } from '@/lib/state/global-event';

interface StateControlPanelProps {
  className?: string;
}

export default function StateControlPanel({ className = '' }: StateControlPanelProps) {
  const { state, actions } = useGlobalEvent();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleStateChange = async (newStatus: 'offline' | 'standby' | 'live') => {
    if (isTransitioning || state.status === newStatus) return;

    setIsTransitioning(true);
    try {
      await actions.setEventStatus(newStatus);
    } catch (error) {
      console.error('Failed to change event status:', error);
    } finally {
      setIsTransitioning(false);
    }
  };

  const getStateConfig = (status: 'offline' | 'standby' | 'live') => {
    switch (status) {
      case 'offline':
        return {
          label: 'Offline',
          description: 'Event not started',
          icon: Power,
          color: 'text-gray-400',
          bgColor: 'bg-gray-800',
          borderColor: 'border-gray-600',
          hoverColor: 'hover:bg-gray-700'
        };
      case 'standby':
        return {
          label: 'Standby',
          description: 'Event ready to start',
          icon: Pause,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-600',
          hoverColor: 'hover:bg-yellow-900/30'
        };
      case 'live':
        return {
          label: 'Live',
          description: 'Event in progress',
          icon: Play,
          color: 'text-green-400',
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-600',
          hoverColor: 'hover:bg-green-900/30'
        };
    }
  };

  const currentConfig = getStateConfig(state.status);

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Event Control</h2>
          <p className="text-gray-400 text-sm">Control the party playlist event state</p>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          {state.isConnected ? (
            <div className="flex items-center space-x-1 text-green-400">
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">Connected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-red-400">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* Current State Display */}
      <div className="mb-6">
        <div className={`inline-flex items-center space-x-3 px-4 py-3 rounded-lg border-2 ${currentConfig.bgColor} ${currentConfig.borderColor}`}>
          <currentConfig.icon className={`w-6 h-6 ${currentConfig.color}`} />
          <div>
            <div className={`font-semibold ${currentConfig.color}`}>
              {currentConfig.label}
            </div>
            <div className="text-gray-400 text-sm">
              {currentConfig.description}
            </div>
          </div>
        </div>
      </div>

      {/* State Control Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {(['offline', 'standby', 'live'] as const).map((status) => {
          const config = getStateConfig(status);
          const isActive = state.status === status;
          const isDisabled = isTransitioning || isActive;

          return (
            <button
              key={status}
              onClick={() => handleStateChange(status)}
              disabled={isDisabled}
              className={`
                flex flex-col items-center space-y-2 p-4 rounded-lg border-2 transition-all duration-200
                ${isActive 
                  ? `${config.bgColor} ${config.borderColor} ${config.color}` 
                  : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:border-gray-500'
                }
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
              `}
            >
              <config.icon className="w-8 h-8" />
              <div className="text-center">
                <div className="font-medium text-sm">{config.label}</div>
                <div className="text-xs opacity-75">{config.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Transition Indicator */}
      {isTransitioning && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-yellow-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
          <span className="text-sm">Transitioning...</span>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="mt-4 flex items-center space-x-2 text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{state.error}</span>
        </div>
      )}
    </div>
  );
}
