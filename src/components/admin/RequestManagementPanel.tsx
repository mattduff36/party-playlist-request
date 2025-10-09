/**
 * Request Management Panel Component
 * 
 * This component provides complete song request management functionality
 * integrated into the admin simplified page.
 */

'use client';

import { useState, useEffect } from 'react';
import { Music, CheckCircle, XCircle, Trash2, Shuffle, Search, Filter } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';

interface RequestManagementPanelProps {
  className?: string;
  showHeader?: boolean;
}

export default function RequestManagementPanel({ className = '', showHeader = true }: RequestManagementPanelProps) {
  const {
    requests,
    handleApprove,
    handleReject,
    handleDelete,
    handlePlayAgain,
    loading,
    refreshData
  } = useAdminData();

  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'played' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [isAddingRandomSong, setIsAddingRandomSong] = useState(false);
  const [allRequests, setAllRequests] = useState<any[]>([]);

  // Filter and sort the requests data
  useEffect(() => {
    if (!requests) return;
    
    let filteredRequests = [...requests];
    
    // Filter by status
    if (filterStatus !== 'all') {
      filteredRequests = filteredRequests.filter(req => req.status === filterStatus);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredRequests = filteredRequests.filter(req => 
        req.track_name.toLowerCase().includes(query) ||
        req.artist_name.toLowerCase().includes(query) ||
        req.album_name?.toLowerCase().includes(query) ||
        req.requester_nickname?.toLowerCase().includes(query)
      );
    }
    
    // Sort requests
    if (filterStatus === 'all') {
      const statusOrder = { 'pending': 1, 'approved': 2, 'rejected': 3, 'played': 4 };
      filteredRequests = filteredRequests.sort((a: any, b: any) => {
        const aOrder = statusOrder[a.status as keyof typeof statusOrder] || 5;
        const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        
        if (a.status === 'pending') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        } else if (a.status === 'approved') {
          return new Date(a.approved_at || a.created_at).getTime() - new Date(b.approved_at || b.created_at).getTime();
        } else {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
    } else if (filterStatus === 'approved') {
      filteredRequests = filteredRequests.sort((a: any, b: any) => {
        return new Date(a.approved_at || a.created_at).getTime() - new Date(b.approved_at || b.created_at).getTime();
      });
    }
    
    setAllRequests(filteredRequests);
  }, [requests, filterStatus, searchQuery]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const handleSelectRequest = (id: string) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRequests.size === allRequests.length) {
      setSelectedRequests(new Set());
    } else {
      setSelectedRequests(new Set(allRequests.map(req => req.id)));
    }
  };

  const handleBatchApprove = async (playNext = false) => {
    for (const id of selectedRequests) {
      await handleApprove(id, playNext);
    }
    setSelectedRequests(new Set());
  };

  const handleBatchReject = async () => {
    for (const id of selectedRequests) {
      await handleReject(id, 'Batch rejected by admin');
    }
    setSelectedRequests(new Set());
  };

  const handleBatchDelete = async () => {
    for (const id of selectedRequests) {
      await handleDelete(id);
    }
    setSelectedRequests(new Set());
  };

  const handleAddRandomSong = async () => {
    if (isAddingRandomSong) return;
    
    setIsAddingRandomSong(true);
    try {
      const response = await fetch('/api/admin/add-random-song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // JWT auth via cookies
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Random song added:', result.request.track.name);
      } else {
        const error = await response.text();
        console.error('❌ Failed to add random song:', error);
      }
    } catch (error) {
      console.error('❌ Error adding random song:', error);
    } finally {
      setIsAddingRandomSong(false);
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-700 rounded w-1/2 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white mb-1">Song Requests</h2>
          <p className="text-gray-400 text-sm">
            Manage song requests from users
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All ({requests?.length || 0})</option>
            <option value="pending">Pending ({requests?.filter(r => r.status === 'pending').length || 0})</option>
            <option value="approved">Approved ({requests?.filter(r => r.status === 'approved').length || 0})</option>
            <option value="rejected">Rejected ({requests?.filter(r => r.status === 'rejected').length || 0})</option>
            <option value="played">Played ({requests?.filter(r => r.status === 'played').length || 0})</option>
          </select>
          
          <button
            onClick={handleAddRandomSong}
            disabled={isAddingRandomSong}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              isAddingRandomSong 
                ? 'bg-purple-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
            title="Add Random Song"
          >
            <Shuffle className={`w-4 h-4 ${isAddingRandomSong ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isAddingRandomSong ? 'Adding...' : 'Random Song'}
            </span>
          </button>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedRequests.size > 0 && (
        <div className="mb-4 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-blue-400 text-sm">
              {selectedRequests.size} request{selectedRequests.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBatchApprove(false)}
                className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={handleBatchReject}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1 px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {allRequests.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No requests found</h3>
            <p className="text-gray-500">
              {filterStatus === 'all' ? 'No song requests yet.' : `No ${filterStatus} requests.`}
            </p>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
              <input
                type="checkbox"
                checked={selectedRequests.size === allRequests.length && allRequests.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-gray-300 text-sm">
                Select all {allRequests.length} request{allRequests.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Request Items */}
            {allRequests.map((request) => (
              <div 
                key={request.id}
                className={`p-4 rounded-lg border transition-colors ${
                  request.status === 'pending' ? 'bg-yellow-400/5 border-yellow-400/20' :
                  request.status === 'approved' ? 'bg-green-400/5 border-green-400/20' :
                  request.status === 'rejected' ? 'bg-red-400/5 border-red-400/20' :
                  'bg-blue-400/5 border-blue-400/20'
                }`}>
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedRequests.has(request.id)}
                    onChange={() => handleSelectRequest(request.id)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />

                  {/* Album Art */}
                  <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Music className="w-6 h-6 text-gray-400" />
                  </div>
                  
                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-1 break-words">
                      {request.track_name}
                    </h3>
                    <p className="text-gray-400 text-sm break-words">
                      {request.artist_name}
                      {request.album_name && ` • ${request.album_name}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                      <span>{formatDuration(request.duration_ms)}</span>
                      <span>{formatTimeAgo(request.created_at)}</span>
                      {request.requester_nickname && (
                        <span className="text-purple-300">
                          by {request.requester_nickname}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(request.id)}
                          className="flex items-center justify-center p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors min-w-[72px] min-h-[36px]"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => handleReject(request.id)}
                          className="flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors min-w-[72px] min-h-[36px]"
                          title="Decline"
                        >
                          <XCircle className="w-4 h-4 text-white" />
                        </button>
                      </>
                    )}
                    
                    {request.status === 'rejected' && (
                      <>
                        <button
                          onClick={() => handleApprove(request.id)}
                          className="flex items-center justify-center p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors min-w-[72px] min-h-[36px]"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                        </button>
                      </>
                    )}
                    
                    {request.status === 'played' && (
                      <>
                        <button
                          onClick={() => handlePlayAgain(request.id)}
                          className="flex items-center justify-center p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors min-w-[72px] min-h-[36px]"
                          title="Play Again"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                        </button>
                      </>
                    )}
                    
                    <button
                      onClick={() => handleDelete(request.id)}
                      className="flex items-center justify-center p-2 text-gray-400 hover:text-red-400 transition-colors min-h-[36px] min-w-[36px] rounded hover:bg-gray-700"
                      title="Delete Request"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}