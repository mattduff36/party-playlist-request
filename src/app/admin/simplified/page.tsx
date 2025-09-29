/**
 * Simplified Admin Overview Page
 * 
 * This page provides a streamlined admin interface with all current functionality
 * organized into clear, easy-to-use panels.
 */

'use client';

import { useState } from 'react';
import StateControlPanel from '@/components/admin/StateControlPanel';
import PageControlPanel from '@/components/admin/PageControlPanel';
import SpotifyConnectionPanel from '@/components/admin/SpotifyConnectionPanel';
import SpotifyStatusDisplay from '@/components/admin/SpotifyStatusDisplay';
import RequestManagementPanel from '@/components/admin/RequestManagementPanel';
import AdminNotificationSystem from '@/components/admin/AdminNotificationSystem';
import { 
  Settings, 
  Music, 
  Users, 
  Monitor, 
  Smartphone,
  BarChart3,
  Wifi
} from 'lucide-react';

export default function SimplifiedAdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'spotify' | 'settings'>('overview');

  const tabs = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: BarChart3,
      description: 'Event control and status'
    },
    {
      id: 'requests' as const,
      label: 'Requests',
      icon: Music,
      description: 'Manage song requests'
    },
    {
      id: 'spotify' as const,
      label: 'Spotify',
      icon: Wifi,
      description: 'Connection and playback'
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
      description: 'Page controls and config'
    }
  ];

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
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="px-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 transition-colors
                    ${isActive 
                      ? 'border-blue-500 text-blue-400' 
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium">{tab.label}</div>
                    <div className="text-xs opacity-75">{tab.description}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
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
                    <p className="text-2xl font-bold text-white">0</p>
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
                    <p className="text-2xl font-bold text-white">0</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-600 rounded-lg">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-400">Display Page</p>
                    <p className="text-2xl font-bold text-white">Off</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-600 rounded-lg">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-400">Requests Page</p>
                    <p className="text-2xl font-bold text-white">Off</p>
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
            <SpotifyStatusDisplay />
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-6">
            <RequestManagementPanel />
          </div>
        )}

        {activeTab === 'spotify' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SpotifyConnectionPanel />
              <SpotifyStatusDisplay />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PageControlPanel />
              <StateControlPanel />
            </div>
            
            {/* Additional Settings */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">System Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div>
                    <h3 className="font-medium text-white">Auto-refresh</h3>
                    <p className="text-gray-400 text-sm">Automatically refresh data every 30 seconds</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                  <div>
                    <h3 className="font-medium text-white">Sound notifications</h3>
                    <p className="text-gray-400 text-sm">Play sound when new requests arrive</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
