/**
 * Event State Dropdown Component
 * 
 * Compact event state control with dropdown for changing state
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Power,
  Pause,
  Play,
  Loader2
} from 'lucide-react';
import { useGlobalEvent, EventStateMachine } from '@/lib/state/global-event-client';

export default function EventStateDropdown() {
  const { state, actions } = useGlobalEvent();
  const [isOpen, setIsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleStateChange = async (newStatus: 'offline' | 'standby' | 'live') => {
    if (isTransitioning || !state || state.status === newStatus) {
      setIsOpen(false);
      return;
    }

    // Validate state transition
    if (!EventStateMachine.canTransition(state.status, newStatus)) {
      console.warn(`Invalid transition from ${state.status} to ${newStatus}`);
      actions?.setError(`Cannot transition from ${state.status} to ${newStatus}`);
      setIsOpen(false);
      return;
    }

    setIsTransitioning(true);
    try {
      // If going to offline or standby, disable pages
      // If going to offline, also disconnect Spotify
      if (newStatus === 'offline' || newStatus === 'standby') {
        const token = localStorage.getItem('admin_token');
        if (token) {
          console.log(`🔌 Going ${newStatus}: ${newStatus === 'offline' ? 'Disconnecting Spotify and disabling' : 'Disabling'} pages...`);
          
          // Disconnect from Spotify only when going offline
          if (newStatus === 'offline') {
            try {
              await fetch('/api/spotify/disconnect', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              console.log('✅ Spotify disconnected');
            } catch (spotifyError) {
              console.error('Failed to disconnect Spotify:', spotifyError);
            }
          }

          // Disable pages if they're enabled
          const disablePromises = [];
          
          if (state.pagesEnabled.requests) {
            console.log('🔌 Disabling Requests page...');
            disablePromises.push(
              fetch('/api/event/pages', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page: 'requests', enabled: false })
              })
            );
          }
          
          if (state.pagesEnabled.display) {
            console.log('🔌 Disabling Display page...');
            disablePromises.push(
              fetch('/api/event/pages', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page: 'display', enabled: false })
              })
            );
          }

          if (disablePromises.length > 0) {
            try {
              await Promise.all(disablePromises);
              console.log('✅ Pages disabled');
            } catch (pageError) {
              console.error('❌ Failed to disable pages:', pageError);
            }
          }
        }
      }

      // Update the event status
      await actions?.setEventStatus?.(newStatus);
      setIsOpen(false);
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

  // Get icon and color for current state
  const getStateIcon = () => {
    if (!state) return Power;
    switch (state.status) {
      case 'offline':
        return Power;
      case 'standby':
        return Pause;
      case 'live':
        return Play;
      default:
        return Power;
    }
  };

  const getStateColor = () => {
    if (!state) return 'text-gray-400';
    switch (state.status) {
      case 'offline':
        return 'text-gray-400';
      case 'standby':
        return 'text-yellow-400';
      case 'live':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStateDotColor = () => {
    if (!state) return 'bg-gray-500';
    switch (state.status) {
      case 'offline':
        return 'bg-gray-500';
      case 'standby':
        return 'bg-yellow-500';
      case 'live':
        return 'bg-green-500 animate-pulse';
      default:
        return 'bg-gray-500';
    }
  };

  const StateIcon = getStateIcon();

  if (!state) {
    return (
      <div className="relative p-2">
        <Power className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* State Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-700 rounded-lg transition-colors"
        title={`Event Status: ${state.status}`}
      >
        <StateIcon className={`w-5 h-5 ${getStateColor()}`} />
        
        {/* Status Indicator Dot */}
        <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${getStateDotColor()}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <StateIcon className="w-4 h-4" />
              Event Status
            </h3>
          </div>

          {/* Content */}
          <div className="p-4 space-y-2">
            {isTransitioning ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Current Status */}
                <div className="text-xs text-gray-400 mb-3">
                  Current: <span className={`font-medium ${getStateColor()}`}>{state.status.toUpperCase()}</span>
                </div>

                {/* State Buttons */}
                {(['offline', 'standby', 'live'] as const).map((status) => {
                  const isActive = state.status === status;
                  const canTransition = EventStateMachine.canTransition(state.status, status);
                  const isDisabled = isActive || !canTransition;

                  let Icon, label, color, bgColor, borderColor;
                  switch (status) {
                    case 'offline':
                      Icon = Power;
                      label = 'Offline';
                      color = 'text-gray-400';
                      bgColor = 'bg-gray-800';
                      borderColor = 'border-gray-600';
                      break;
                    case 'standby':
                      Icon = Pause;
                      label = 'Standby';
                      color = 'text-yellow-400';
                      bgColor = 'bg-yellow-900/20';
                      borderColor = 'border-yellow-600';
                      break;
                    case 'live':
                      Icon = Play;
                      label = 'Live';
                      color = 'text-green-400';
                      bgColor = 'bg-green-900/20';
                      borderColor = 'border-green-600';
                      break;
                  }

                  return (
                    <button
                      key={status}
                      onClick={() => handleStateChange(status)}
                      disabled={isDisabled}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all
                        ${isActive 
                          ? `${bgColor} ${borderColor} ${color}` 
                          : canTransition
                            ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-800 border-gray-700 text-gray-500'
                        }
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      title={!canTransition ? `Cannot transition from ${state.status} to ${status}` : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{label}</span>
                      {isActive && (
                        <span className="ml-auto text-xs">✓</span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

