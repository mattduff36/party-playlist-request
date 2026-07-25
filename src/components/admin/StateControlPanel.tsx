/**
 * State Control Panel Component
 * 
 * This component provides a simplified three-button interface for controlling
 * the event state (offline/standby/live) with clear visual feedback.
 */

'use client';

import { useState } from 'react';
import { Power, Play, Pause, AlertCircle } from 'lucide-react';
import { useGlobalEvent, EventStateMachine } from '@/lib/state/global-event-client';

interface StateControlPanelProps {
  className?: string;
}

export default function StateControlPanel({ className = '' }: StateControlPanelProps) {
  const { state, actions } = useGlobalEvent();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Safety check - if state is not available, show loading
  if (!state) {
    return (
      <div className={`bg-elevated rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-muted">Loading event state...</p>
        </div>
      </div>
    );
  }

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
      // If going to offline, also pause Spotify and disconnect
      if (newStatus === 'offline' || newStatus === 'standby') {
        console.log(`🔌 Going ${newStatus}: ${newStatus === 'offline' ? 'Pausing Spotify, disconnecting, and disabling' : 'Disabling'} pages...`);
        
        // Pause and disconnect from Spotify only when going offline
        if (newStatus === 'offline') {
          try {
            // First, pause the currently playing song (if any)
            try {
              console.log('⏸️ Pausing Spotify playback...');
              await fetch('/api/admin/playback/pause', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                credentials: 'include'
              });
              console.log('✅ Spotify paused');
            } catch (pauseError) {
              console.warn('⚠️ Could not pause Spotify (may already be paused):', pauseError);
              // Continue anyway - not critical
            }

            // Then disconnect
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
            // Continue anyway - not critical
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
          activeClass: 'bg-surface border-white/20 text-bone',
        };
      case 'standby':
        return {
          label: 'Standby',
          description: 'Event ready to start',
          icon: Pause,
          activeClass: 'bg-accent/20 border-accent text-accent',
        };
      case 'live':
        return {
          label: 'Live',
          description: 'Event in progress',
          icon: Play,
          activeClass: 'bg-accent border-accent text-ink font-semibold shadow-[0_0_0_1px_rgba(245,166,35,0.35)]',
        };
    }
  };

  return (
    <div className={`bg-elevated rounded-lg p-3 ${className}`}>
      <div className="mb-2">
        <h2 className="font-display text-lg font-semibold text-bone">Event Control</h2>
      </div>

      {/* State Control Buttons - More Compact */}
      <div className="grid grid-cols-3 gap-2">
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
                flex flex-col items-center space-y-1 p-2 rounded-lg border-2 transition-all duration-200
                ${isActive 
                  ? config.activeClass
                  : canTransition
                    ? 'bg-elevated border-white/10 text-muted hover:border-accent/40 hover:text-bone'
                    : 'bg-ink border-white/5 text-faint'
                }
                ${isDisabled && !isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={!canTransition ? `Cannot transition from ${state.status} to ${status}` : undefined}
            >
              <config.icon className="w-5 h-5" />
              <div className="font-medium text-xs">{config.label}</div>
            </button>
          );
        })}
      </div>

      {/* Transition Indicator - Compact */}
      {isTransitioning && (
        <div className="mt-1.5 flex items-center justify-center space-x-1 text-yellow-400 text-xs">
          <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-yellow-400"></div>
          <span>Updating...</span>
        </div>
      )}

      {/* Error Display - Compact */}
      {state.error && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-600 rounded text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 flex-1">{state.error}</span>
            <button
              onClick={() => actions.setError(null)}
              className="text-red-400 hover:text-red-300 underline"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
