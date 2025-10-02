/**
 * Simplified Admin Overview Page
 * 
 * This page provides a streamlined admin interface with all current functionality
 * organized into clear, easy-to-use panels.
 */

'use client';

import StateControlPanel from '@/components/admin/StateControlPanel';
import PageControlPanel from '@/components/admin/PageControlPanel';
import SpotifyStatusDisplay from '@/components/admin/SpotifyStatusDisplay';
import AdminNotificationSystem from '@/components/admin/AdminNotificationSystem';
import RequestManagementPanel from '@/components/admin/RequestManagementPanel';
import { SpotifyErrorBoundary } from '@/components/error/SpotifyErrorBoundary';
import { useGlobalEvent } from '@/lib/state/global-event-client';
import { useAdminData } from '@/contexts/AdminDataContext';
import { 
  Music, 
  Users, 
  Monitor, 
  Smartphone
} from 'lucide-react';

export default function SimplifiedAdminPage() {
  const { state } = useGlobalEvent();
  const { stats } = useAdminData();
  
  // Safety check - ensure pagesEnabled exists
  if (!state || !state.pagesEnabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-gray-400 text-sm">Simplified party playlist management</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <AdminNotificationSystem />
              
              <div className="flex items-center space-x-2 text-gray-400">
                <div className={`w-2 h-2 rounded-full ${
                  state.status === 'live' ? 'bg-green-400 animate-pulse' :
                  state.status === 'standby' ? 'bg-yellow-400' :
                  'bg-red-400'
                }`}></div>
                <span className="text-sm capitalize">{state.status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Main Content */}
      <div className="p-6">
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-600 rounded-lg">
                  <Music className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-400">Total Requests</p>
                  <p className="text-2xl font-bold text-white">{stats?.total_requests || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-600 rounded-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-white">{stats?.pending_requests || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center">
                <div className={`p-3 ${state.pagesEnabled.display ? 'bg-green-600' : 'bg-gray-600'} rounded-lg`}>
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-400">Display Page</p>
                  <p className="text-2xl font-bold text-white">{state.pagesEnabled.display ? 'On' : 'Off'}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center">
                <div className={`p-3 ${state.pagesEnabled.requests ? 'bg-purple-600' : 'bg-gray-600'} rounded-lg`}>
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-400">Requests Page</p>
                  <p className="text-2xl font-bold text-white">{state.pagesEnabled.requests ? 'On' : 'Off'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Control Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StateControlPanel />
            <PageControlPanel />
          </div>

          {/* Spotify Status */}
          <SpotifyErrorBoundary>
            <SpotifyStatusDisplay />
          </SpotifyErrorBoundary>

          {/* Request Management */}
          <RequestManagementPanel />
        </div>
      </div>
    </div>
  );
}
