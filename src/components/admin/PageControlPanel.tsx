/**
 * Page Control Panel Component
 * 
 * This component provides toggles for enabling/disabling the requests and display pages
 * with real-time feedback and visual indicators.
 */

'use client';

import { useState } from 'react';
import { Eye, EyeOff, Monitor, Smartphone, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { useGlobalEvent } from '@/lib/state/global-event-client';

interface PageControlPanelProps {
  className?: string;
}

export default function PageControlPanel({ className = '' }: PageControlPanelProps) {
  const { state, actions } = useGlobalEvent();
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Safety check - if state is not available, show loading
  if (!state) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading page controls...</p>
        </div>
      </div>
    );
  }

  // Check if page controls should be available based on event status
  const isOffline = state.status === 'offline';
  const canControlPages = !isOffline; // Only allow page controls when not offline

  const handlePageToggle = async (page: 'requests' | 'display', enabled: boolean) => {
    if (isToggling || !canControlPages) return;

    console.log('🎛️ [PageControlPanel] handlePageToggle called:', { page, enabled, isToggling, canControlPages });
    setIsToggling(page);
    setError(null);
    try {
      console.log('🎛️ [PageControlPanel] Calling actions.setPageEnabled...', { page, enabled });
      await actions?.setPageEnabled?.(page, enabled);
      console.log('✅ [PageControlPanel] actions.setPageEnabled completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${enabled ? 'enable' : 'disable'} ${page} page`;
      console.error(`❌ [PageControlPanel] Failed to toggle ${page} page:`, error);
      setError(errorMessage);
    } finally {
      setIsToggling(null);
      console.log('🎛️ [PageControlPanel] handlePageToggle finished');
    }
  };

  const pages = [
    {
      key: 'requests' as const,
      label: 'Requests Page',
      description: 'Allow users to submit song requests',
      icon: Smartphone,
      enabled: state.pagesEnabled.requests
    },
    {
      key: 'display' as const,
      label: 'Display Page',
      description: 'Show now playing and queue',
      icon: Monitor,
      enabled: state.pagesEnabled.display
    }
  ];

  return (
    <div className={`bg-gray-800 rounded-lg p-3 ${className}`}>
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-white">Page Controls</h2>
      </div>

      {/* Toggles on same line - Whole box clickable */}
      <div className="grid grid-cols-2 gap-2">
        {pages.map((page) => {
          const Icon = page.icon;
          const isEnabled = page.enabled;
          const isTogglingThis = isToggling === page.key;

          return (
            <button
              key={page.key}
              onClick={() => handlePageToggle(page.key, !isEnabled)}
              disabled={isTogglingThis || !canControlPages}
              className={`
                flex flex-col items-center space-y-1 p-2 rounded-lg border-2 transition-all duration-200
                ${isEnabled 
                  ? 'bg-green-900/20 border-green-600' 
                  : 'bg-gray-700 border-gray-600'
                }
                ${isTogglingThis ? 'opacity-50' : ''}
                ${!canControlPages ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
              `}
              title={!canControlPages ? 'Enable event first' : `Click to ${isEnabled ? 'disable' : 'enable'}`}
            >
              <Icon className={`w-5 h-5 ${isEnabled ? 'text-green-400' : 'text-gray-400'}`} />
              <div className={`font-medium text-xs ${isEnabled ? 'text-green-400' : 'text-gray-300'}`}>
                {page.key === 'requests' ? 'Requests' : 'Display'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Error Display - Compact */}
      {(error || state.error) && (
        <div className="mt-2 p-1.5 bg-red-900/20 border border-red-600 rounded text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
            <span className="text-red-300 flex-1">{error || state.error}</span>
            <button
              onClick={(e) => { e.stopPropagation(); setError(null); actions.setError(null); }}
              className="text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
