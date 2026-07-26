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
  Loader2,
  Check
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
      // If going to LIVE, enable both pages sequentially
      if (newStatus === 'live') {
        console.log('🎉 Going LIVE: Enabling Requests and Display pages...');
        
        // Enable requests page first
        if (!state.pagesEnabled.requests) {
          try {
            console.log('✅ Enabling Requests page...');
            await fetch('/api/event/pages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({ page: 'requests', enabled: true })
            });
            // Small delay to prevent race condition
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.error('❌ Failed to enable Requests page:', error);
          }
        }
        
        // Then enable display page
        if (!state.pagesEnabled.display) {
          try {
            console.log('✅ Enabling Display page...');
            await fetch('/api/event/pages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({ page: 'display', enabled: true })
            });
            console.log('✅ Pages enabled');
          } catch (error) {
            console.error('❌ Failed to enable Display page:', error);
          }
        }
      }

      // If going to offline or standby, disable pages
      // If going to offline, also disconnect Spotify
      if (newStatus === 'offline' || newStatus === 'standby') {
        console.log(`🔌 Going ${newStatus}: ${newStatus === 'offline' ? 'Disconnecting Spotify and disabling' : 'Disabling'} pages...`);
        
        // Disconnect from Spotify and stop watcher only when going offline
        if (newStatus === 'offline') {
          try {
            // Stop Spotify watcher first
            await fetch('/api/admin/spotify-watcher', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({ action: 'stop' })
            });
            console.log('✅ Spotify watcher stopped');

            // Then disconnect from Spotify
            await fetch('/api/spotify/disconnect', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include' // JWT auth via cookies
            });
            console.log('✅ Spotify disconnected');
          } catch (spotifyError) {
            console.error('Failed to disconnect Spotify:', spotifyError);
          }
        }

        // Disable pages sequentially to prevent race condition
        if (state.pagesEnabled.requests) {
          try {
            console.log('🔌 Disabling Requests page...');
            await fetch('/api/event/pages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({ page: 'requests', enabled: false })
            });
            // Small delay to prevent race condition
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
            console.error('❌ Failed to disable Requests page:', error);
          }
        }
        
        if (state.pagesEnabled.display) {
          try {
            console.log('🔌 Disabling Display page...');
            await fetch('/api/event/pages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({ page: 'display', enabled: false })
            });
            console.log('✅ Pages disabled');
          } catch (error) {
            console.error('❌ Failed to disable Display page:', error);
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
    if (!state) return 'text-muted';
    switch (state.status) {
      case 'offline':
        return 'text-muted';
      case 'standby':
        return 'text-yellow-400';
      case 'live':
        return 'text-accent';
      default:
        return 'text-muted';
    }
  };

  const getStateDotColor = () => {
    if (!state) return 'bg-surface';
    switch (state.status) {
      case 'offline':
        return 'bg-surface';
      case 'standby':
        return 'bg-yellow-500';
      case 'live':
        return 'bg-accent animate-pulse';
      default:
        return 'bg-surface';
    }
  };

  const StateIcon = getStateIcon();

  if (!state) {
    return (
      <div className="relative p-2.5">
        <Power className="w-6 h-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* State Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 hover:bg-surface rounded-lg transition-colors"
        title={`Event Status: ${state.status}`}
        aria-label={`Event Status: ${state.status}`}
      >
        <StateIcon className={`w-6 h-6 ${getStateColor()}`} />
        
        {/* Status Indicator Dot */}
        <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${getStateDotColor()}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-elevated rounded-lg shadow-xl border border-white/10 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-bone font-semibold flex items-center gap-2">
              <StateIcon className="w-4 h-4" />
              Event Status
            </h3>
          </div>

          {/* Content */}
          <div className="p-4 space-y-2">
            {isTransitioning ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 text-muted animate-spin" />
              </div>
            ) : (
              <>
                {/* Current Status */}
                <div className="text-xs text-muted mb-3">
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
                      color = 'text-muted';
                      bgColor = 'bg-elevated';
                      borderColor = 'border-white/10';
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
                      color = 'text-accent';
                      bgColor = 'bg-accent/10';
                      borderColor = 'border-accent';
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
                            ? 'bg-surface border-white/10 text-muted hover:bg-surface'
                            : 'bg-elevated border-white/10 text-faint'
                        }
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                      title={!canTransition ? `Cannot transition from ${state.status} to ${status}` : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{label}</span>
                      {isActive && (
                        <Check className="ml-auto h-4 w-4 stroke-[2.5]" aria-hidden="true" />
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

