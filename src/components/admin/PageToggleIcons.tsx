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
          relative p-2 rounded-lg border-2 transition-all
          ${requestsEnabled 
            ? 'bg-green-900/20 border-green-600 text-green-400' 
            : 'bg-gray-800 border-gray-600 text-gray-400'
          }
          ${!canControlPages ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}
          ${isToggling === 'requests' ? 'opacity-50' : ''}
        `}
        title={
          !canControlPages 
            ? 'Enable event first' 
            : `Requests Page: ${requestsEnabled ? 'Enabled' : 'Disabled'} (Click to toggle)`
        }
      >
        <Smartphone className="w-5 h-5" />
      </button>

      {/* Display Page Toggle */}
      <button
        onClick={() => handlePageToggle('display')}
        disabled={isToggling === 'display' || !canControlPages}
        className={`
          relative p-2 rounded-lg border-2 transition-all
          ${displayEnabled 
            ? 'bg-green-900/20 border-green-600 text-green-400' 
            : 'bg-gray-800 border-gray-600 text-gray-400'
          }
          ${!canControlPages ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}
          ${isToggling === 'display' ? 'opacity-50' : ''}
        `}
        title={
          !canControlPages 
            ? 'Enable event first' 
            : `Display Page: ${displayEnabled ? 'Enabled' : 'Disabled'} (Click to toggle)`
        }
      >
        <Monitor className="w-5 h-5" />
      </button>
    </>
  );
}

