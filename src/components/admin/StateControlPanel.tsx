/**
 * State Control Panel Component
 * 
 * This component provides a simplified three-button interface for controlling
 * the event state (offline/standby/live) with clear visual feedback.
 */

'use client';

import { useState, useEffect } from 'react';
import { Power, Play, Pause, AlertCircle, CheckCircle } from 'lucide-react';
import { useGlobalEvent, EventStateMachine } from '@/lib/state/global-event-client';

interface StateControlPanelProps {
  className?: string;
}

export default function StateControlPanel({ className = '' }: StateControlPanelProps) {
  const { state, actions } = useGlobalEvent();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [previousStatus, setPreviousStatus] = useState(state?.status || 'offline');

  // Safety check - if state is not available, show loading
  if (!state) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading event state...</p>
        </div>
      </div>
    );
  }

  // Show success toast when state changes
  useEffect(() => {
    if (state.status !== previousStatus && !isTransitioning) {
      setShowSuccessToast(true);
      setPreviousStatus(state.status);
      
      // Hide toast after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [state.status, previousStatus, isTransitioning]);

  const handleStateChange = async (newStatus: 'offline' | 'standby' | 'live') => {
    if (isTransitioning || !state || state.status === newStatus) return;

    // Validate state transition using the state machine
    if (!EventStateMachine.canTransition(state.status, newStatus)) {
      console.warn(`Invalid transition from ${state.status} to ${newStatus}`);
      // Show error message to user
      actions?.setError(`Cannot transition from ${state.status} to ${newStatus}`);
      return;
    }

    setIsTransitioning(true);
    try {
      await actions?.setEventStatus?.(newStatus);
    } catch (error) {
      console.error('Failed to change event status:', error);
      let errorMessage = 'Failed to update event status';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'error' in error) {
        errorMessage = (error as any).error;
      }
      
      actions?.setError?.(errorMessage);
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
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Event Control</h2>
        <p className="text-gray-400 text-sm">Control the party playlist event state</p>
      </div>

      {/* Current State Display */}
      <div className="mb-6">
        <div className={`inline-flex items-center space-x-3 px-4 py-3 rounded-lg border-2 ${currentConfig.bgColor} ${currentConfig.borderColor} transition-all duration-500 ease-in-out`}>
          <currentConfig.icon className={`w-6 h-6 ${currentConfig.color} ${isTransitioning ? 'animate-pulse' : ''}`} />
          <div>
            <div className={`font-semibold ${currentConfig.color} ${isTransitioning ? 'animate-pulse' : ''}`}>
              {currentConfig.label}
            </div>
            <div className="text-gray-400 text-sm">
              {currentConfig.description}
            </div>
          </div>
          {/* Status indicator dot */}
          <div className={`w-3 h-3 rounded-full ${currentConfig.color.replace('text-', 'bg-')} ${isTransitioning ? 'animate-pulse' : 'animate-pulse'}`}></div>
        </div>
      </div>

      {/* State Control Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {(['offline', 'standby', 'live'] as const).map((status) => {
          const config = getStateConfig(status);
          const isActive = state.status === status;
          const canTransition = EventStateMachine.canTransition(state.status, status);
          const isDisabled = isTransitioning || isActive || !canTransition;

          return (
            <button
              key={status}
              onClick={() => handleStateChange(status)}
              disabled={isDisabled}
              className={`
                flex flex-col items-center space-y-2 p-4 rounded-lg border-2 transition-all duration-300 ease-in-out
                ${isActive 
                  ? `${config.bgColor} ${config.borderColor} ${config.color} shadow-lg` 
                  : canTransition
                    ? 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600 hover:border-gray-500 hover:shadow-md'
                    : 'bg-gray-800 border-gray-700 text-gray-500'
                }
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}
                ${isActive ? 'ring-2 ring-opacity-50 ring-current' : ''}
              `}
              title={!canTransition ? `Cannot transition from ${state.status} to ${status}` : undefined}
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
        <div className="mt-4 flex items-center justify-center space-x-2 text-yellow-400 animate-pulse">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
          <span className="text-sm font-medium">Transitioning...</span>
        </div>
      )}

      {/* State Change Success Indicator */}
      {!isTransitioning && state.lastUpdated && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-green-400 animate-fade-in">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm">State updated successfully</span>
        </div>
      )}


        {/* Success Toast */}
        {showSuccessToast && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg border border-green-400 flex items-center space-x-3">
              <CheckCircle className="w-5 h-5" />
              <div>
                <div className="font-semibold">State Updated!</div>
                <div className="text-sm opacity-90">
                  Event is now {state.status}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-600 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-red-400 mb-1">Error</div>
                <div className="text-red-300 text-sm">{state.error}</div>
                <button
                  onClick={() => actions.setError(null)}
                  className="mt-2 text-red-400 hover:text-red-300 text-sm underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
