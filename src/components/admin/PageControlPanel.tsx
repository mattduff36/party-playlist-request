/**
 * Page Control Panel Component
 * 
 * This component provides toggles for enabling/disabling the requests and display pages
 * with real-time feedback and visual indicators.
 */

'use client';

import { useState } from 'react';
import { Eye, EyeOff, Monitor, Smartphone, ToggleLeft, ToggleRight } from 'lucide-react';
import { useGlobalEvent } from '@/lib/state/global-event';

interface PageControlPanelProps {
  className?: string;
}

export default function PageControlPanel({ className = '' }: PageControlPanelProps) {
  const { state, actions } = useGlobalEvent();
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const handlePageToggle = async (page: 'requests' | 'display', enabled: boolean) => {
    if (isToggling) return;

    setIsToggling(page);
    try {
      await actions.setPageEnabled(page, enabled);
    } catch (error) {
      console.error(`Failed to toggle ${page} page:`, error);
    } finally {
      setIsToggling(null);
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
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Page Controls</h2>
        <p className="text-gray-400 text-sm">Enable or disable pages for users</p>
      </div>

      <div className="space-y-4">
        {pages.map((page) => {
          const Icon = page.icon;
          const isEnabled = page.enabled;
          const isTogglingThis = isToggling === page.key;

          return (
            <div
              key={page.key}
              className={`
                flex items-center justify-between p-4 rounded-lg border-2 transition-all duration-200
                ${isEnabled 
                  ? 'bg-green-900/20 border-green-600' 
                  : 'bg-gray-700 border-gray-600'
                }
                ${isTogglingThis ? 'opacity-50' : ''}
              `}
            >
              <div className="flex items-center space-x-4">
                <div className={`
                  p-3 rounded-lg
                  ${isEnabled ? 'bg-green-600' : 'bg-gray-600'}
                `}>
                  <Icon className={`w-6 h-6 ${isEnabled ? 'text-white' : 'text-gray-300'}`} />
                </div>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className={`font-semibold ${isEnabled ? 'text-green-400' : 'text-gray-300'}`}>
                      {page.label}
                    </h3>
                    {isEnabled ? (
                      <Eye className="w-4 h-4 text-green-400" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-gray-400 text-sm">{page.description}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Status Indicator */}
                <div className={`
                  px-3 py-1 rounded-full text-xs font-medium
                  ${isEnabled 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-600 text-gray-300'
                  }
                `}>
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </div>

                {/* Toggle Button */}
                <button
                  onClick={() => handlePageToggle(page.key, !isEnabled)}
                  disabled={isTogglingThis}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                    ${isEnabled ? 'bg-green-600' : 'bg-gray-600'}
                    ${isTogglingThis ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                      ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toggle Indicator */}
      {isToggling && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-yellow-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
          <span className="text-sm">Updating {isToggling} page...</span>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
        <div className="flex items-start space-x-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
          <div className="text-sm text-gray-300">
            <p className="font-medium mb-1">Page Control Tips:</p>
            <ul className="space-y-1 text-gray-400">
              <li>• Disable pages to prevent user access during setup</li>
              <li>• Both pages can be enabled simultaneously</li>
              <li>• Changes take effect immediately across all devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
