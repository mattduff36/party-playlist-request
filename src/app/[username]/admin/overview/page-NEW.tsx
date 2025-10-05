/**
 * Admin Overview Page - Redesigned
 * 
 * A clean, professional admin interface focused on essential controls.
 */

'use client';

import StateControlPanel from '@/components/admin/StateControlPanel';
import PageControlPanel from '@/components/admin/PageControlPanel';
import SpotifyStatusDisplay from '@/components/admin/SpotifyStatusDisplay';
import RequestManagementPanel from '@/components/admin/RequestManagementPanel';
import { SpotifyErrorBoundary } from '@/components/error/SpotifyErrorBoundary';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { useAdminData } from '@/contexts/AdminDataContext';

export default function AdminOverviewPage() {
  const { state } = useGlobalEvent();
  const { stats } = useAdminData();
  
  // Safety check - ensure pagesEnabled exists
  if (!state || !state.pagesEnabled) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header with Status - Compact & Discreet */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Overview</h1>
            <div className="flex items-center space-x-4 mt-2">
              {/* Event Status Badge */}
              <div className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  state.status === 'live' ? 'bg-green-500 animate-pulse' :
                  state.status === 'standby' ? 'bg-yellow-500' :
                  'bg-gray-500'
                }`} />
                <span className="text-gray-400 capitalize">{state.status}</span>
              </div>
              
              {/* Quick Stats - Inline & Subtle */}
              {stats && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-sm text-gray-400">
                    {stats.total_requests || 0} total
                  </span>
                  {stats.pending_requests > 0 && (
                    <>
                      <span className="text-gray-600">•</span>
                      <span className="text-sm text-yellow-500 font-medium">
                        {stats.pending_requests} pending
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Control Panels - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StateControlPanel />
          <PageControlPanel />
        </div>

        {/* Spotify Status - Compact */}
        <SpotifyErrorBoundary>
          <SpotifyStatusDisplay />
        </SpotifyErrorBoundary>

        {/* Request Management - Full Width */}
        <RequestManagementPanel />
      </div>
    </div>
  );
}

