/**
 * Page Toggle Icons Component
 * 
 * Displays two toggleable icons in the top bar for Requests and Display pages.
 */

'use client';

import { useState } from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import { useGlobalEvent } from '@/lib/state/global-event-client';

export default function PageToggleIcons() {
  const { state, actions } = useGlobalEvent();
  const [isToggling, setIsToggling] = useState<string | null>(null);

  if (!state) return null;

  const isOffline = state.status === 'offline';
  const canControlPages = !isOffline;

  const handlePageToggle = async (page: 'requests' | 'display') => {
    if (isToggling || !canControlPages) return;

    const currentEnabled = state.pagesEnabled[page];
    setIsToggling(page);
    
    try {
      await actions?.setPageEnabled?.(page, !currentEnabled);
    } catch (error) {
      console.error(`Failed to toggle ${page} page:`, error);
    } finally {
      setIsToggling(null);
    }
  };

  const requestsEnabled = state.pagesEnabled.requests;
  const displayEnabled = state.pagesEnabled.display;

  return (
    <>
      {/* Requests Page Toggle */}
      <button
        onClick={() => handlePageToggle('requests')}
        disabled={isToggling === 'requests' || !canControlPages}
        className={`
          relative p-2 rounded-lg transition-colors
          ${requestsEnabled 
            ? 'text-green-400 hover:bg-green-900/20' 
            : 'text-gray-400 hover:bg-gray-700'
          }
          ${!canControlPages ? 'opacity-50 cursor-not-allowed' : ''}
          ${isToggling === 'requests' ? 'opacity-50' : ''}
        `}
        title={
          !canControlPages 
            ? 'Enable event first' 
            : `Requests Page: ${requestsEnabled ? 'Enabled' : 'Disabled'} (Click to toggle)`
        }
      >
        <Smartphone className="w-5 h-5" />
        {/* Status Dot */}
        <span className={`
          absolute top-1 right-1 w-2 h-2 rounded-full
          ${requestsEnabled ? 'bg-green-400' : 'bg-gray-600'}
        `} />
      </button>

      {/* Display Page Toggle */}
      <button
        onClick={() => handlePageToggle('display')}
        disabled={isToggling === 'display' || !canControlPages}
        className={`
          relative p-2 rounded-lg transition-colors
          ${displayEnabled 
            ? 'text-green-400 hover:bg-green-900/20' 
            : 'text-gray-400 hover:bg-gray-700'
          }
          ${!canControlPages ? 'opacity-50 cursor-not-allowed' : ''}
          ${isToggling === 'display' ? 'opacity-50' : ''}
        `}
        title={
          !canControlPages 
            ? 'Enable event first' 
            : `Display Page: ${displayEnabled ? 'Enabled' : 'Disabled'} (Click to toggle)`
        }
      >
        <Monitor className="w-5 h-5" />
        {/* Status Dot */}
        <span className={`
          absolute top-1 right-1 w-2 h-2 rounded-full
          ${displayEnabled ? 'bg-green-400' : 'bg-gray-600'}
        `} />
      </button>
    </>
  );
}

