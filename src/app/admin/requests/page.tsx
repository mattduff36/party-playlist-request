'use client';

import { useAdminData } from '@/contexts/AdminDataContext';

// Import the external RequestsTab component we created earlier
import { useState, useEffect } from 'react';
import { Music, CheckCircle, XCircle, PlayCircle, Trash2, Shuffle } from 'lucide-react';
import SwipeToDelete from '../../../components/SwipeToDelete';

const RequestsTab = ({ requestsData, onApprove, onReject, onDelete, onPlayAgain, onAddRandomSong, isAddingRandomSong }: { 
  requestsData: any[], 
  onApprove: (id: string, playNext?: boolean) => void,
  onReject: (id: string) => void,
  onDelete: (id: string) => void,
  onPlayAgain: (id: string, playNext: boolean) => void,
  onAddRandomSong: () => void,
  isAddingRandomSong?: boolean
}) => {
  // Ensure requestsData is always an array FIRST
  const safeRequestsData = requestsData || [];
  
  console.log('📋 RequestsTab component rendering with', safeRequestsData.length, 'requests');
  console.log('📋 RequestsTab requests data:', safeRequestsData.length > 0 ? safeRequestsData.map(r => ({ id: r.id, status: r.status, track_name: r.track_name })) : 'No requests available');
  
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | 'played' | 'all'>('all');
  const [allRequests, setAllRequests] = useState<any[]>([]);

  // Filter and sort the passed requests data
  useEffect(() => {
    console.log('📋 RequestsTab: Filter changed to:', filterStatus);
    console.log('📋 RequestsTab: Processing', safeRequestsData.length, 'requests from props');
    
    // Ensure we always work with an array
    const workingData = Array.isArray(safeRequestsData) ? safeRequestsData : [];
    
    // Filter the requests data based on selected filter
    let filteredRequests = workingData;
    if (filterStatus !== 'all') {
      filteredRequests = workingData.filter(req => req.status === filterStatus);
    }
    
    // Sort requests when showing all: Pending > Approved > Rejected > Played
    if (filterStatus === 'all') {
      const statusOrder = { 'pending': 1, 'approved': 2, 'rejected': 3, 'played': 4 };
      filteredRequests = [...workingData].sort((a: any, b: any) => {
        const aOrder = statusOrder[a.status as keyof typeof statusOrder] || 5;
        const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 5;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Within same status, sort by appropriate timestamp
        if (a.status === 'pending') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); // oldest first for pending
        } else if (a.status === 'approved') {
          // For approved requests, sort by approved_at (oldest first) to match queue order
          return new Date(a.approved_at || a.created_at).getTime() - new Date(b.approved_at || b.created_at).getTime();
        } else {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest first for others
        }
      });
    } else if (filterStatus === 'approved') {
      // When showing only approved requests, sort by approved_at (oldest first) to match queue order
      filteredRequests = [...filteredRequests].sort((a: any, b: any) => {
        return new Date(a.approved_at || a.created_at).getTime() - new Date(b.approved_at || b.created_at).getTime();
      });
    }
    
    setAllRequests(filteredRequests);
  }, [filterStatus, safeRequestsData]); // Depend on safe props data

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


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">Song Requests</h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            <option value="all">All Requests ({Array.isArray(safeRequestsData) ? safeRequestsData.length : 0})</option>
            <option value="pending">Pending ({Array.isArray(safeRequestsData) ? safeRequestsData.filter(r => r.status === 'pending').length : 0})</option>
            <option value="approved">Approved ({Array.isArray(safeRequestsData) ? safeRequestsData.filter(r => r.status === 'approved').length : 0})</option>
            <option value="rejected">Rejected ({Array.isArray(safeRequestsData) ? safeRequestsData.filter(r => r.status === 'rejected').length : 0})</option>
            <option value="played">Played ({Array.isArray(safeRequestsData) ? safeRequestsData.filter(r => r.status === 'played').length : 0})</option>
          </select>
          <button
            onClick={onAddRandomSong}
            disabled={isAddingRandomSong}
            className={`flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-auto ${
              isAddingRandomSong 
                ? 'bg-purple-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
            title="Add Random Song"
          >
            <Shuffle className={`w-4 h-4 ${isAddingRandomSong ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">
              {isAddingRandomSong ? 'Adding...' : 'Random Song'}
            </span>
          </button>
        </div>
      </div>

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
          allRequests.map((request) => (
            <SwipeToDelete
              key={request.id}
              onDelete={() => onDelete(request.id)}
              className="md:pointer-events-none" // Disable swipe on desktop
            >
              <div className={`p-4 rounded-lg border transition-colors ${
                request.status === 'pending' ? 'bg-yellow-400/5 border-yellow-400/20' :
                request.status === 'approved' ? 'bg-green-400/5 border-green-400/20' :
                request.status === 'rejected' ? 'bg-red-400/5 border-red-400/20' :
                'bg-blue-400/5 border-blue-400/20'
              }`}>
                {request.status === 'pending' ? (
                  <div className="flex items-start gap-3">
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
                      <button
                        onClick={() => onApprove(request.id, true)}
                        className="flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors min-w-[36px] min-h-[36px]"
                        title="Play Next"
                      >
                        <PlayCircle className="w-4 h-4 text-white" />
                        <span className="hidden lg:inline ml-1 text-white text-xs">Play Next</span>
                      </button>
                      <button
                        onClick={() => onApprove(request.id)}
                        className="flex items-center justify-center p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors min-w-[36px] min-h-[36px]"
                        title="Accept"
                      >
                        <CheckCircle className="w-4 h-4 text-white" />
                        <span className="hidden lg:inline ml-1 text-white text-xs">Accept</span>
                      </button>
                      <button
                        onClick={() => onReject(request.id)}
                        className="flex items-center justify-center p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors min-w-[36px] min-h-[36px]"
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4 text-white" />
                        <span className="hidden lg:inline ml-1 text-white text-xs">Reject</span>
                      </button>
                      {/* Delete button - hidden on mobile, replaced with swipe gesture */}
                      <button
                        onClick={() => onDelete(request.id)}
                        className="hidden md:flex items-center justify-center p-2 text-gray-400 hover:text-red-400 transition-colors min-h-[36px] min-w-[36px] rounded hover:bg-gray-700"
                        title="Delete Request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Rejected/Played status - buttons inline like desktop */
                  <div className="flex items-center gap-3">
                    {/* Album Art Placeholder */}
                    <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Music className="w-6 h-6 text-gray-400" />
                    </div>
                    {/* Track Details */}
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
                        {request.status === 'approved' && (
                          <span className="text-xs text-gray-400 italic">• Double-click to mark played</span>
                        )}
                      </div>
                    </div>
                    {/* Actions - Wrap for better responsive design */}
                    <div className="flex flex-wrap items-center gap-1">
                      {request.status === 'rejected' && (
                        <>
                          <button
                            onClick={() => onApprove(request.id, true)}
                            className="flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors min-w-[36px] min-h-[36px]"
                            title="Play Next"
                          >
                            <PlayCircle className="w-4 h-4 text-white" />
                            <span className="hidden lg:inline ml-1 text-white text-xs">Play Next</span>
                          </button>
                          <button
                            onClick={() => onApprove(request.id)}
                            className="flex items-center justify-center p-2 bg-green-600 hover:bg-green-700 rounded transition-colors min-w-[36px] min-h-[36px]"
                            title="Accept"
                          >
                            <CheckCircle className="w-4 h-4 text-white" />
                            <span className="hidden lg:inline ml-1 text-white text-xs">Accept</span>
                          </button>
                          {request.rejection_reason && (
                            <span className="text-gray-500 text-xs hidden md:inline ml-2" title={request.rejection_reason}>
                              ({request.rejection_reason})
                            </span>
                          )}
                        </>
                      )}
                      {request.status === 'played' && (
                        <>
                          <button
                            onClick={() => onPlayAgain(request.id, true)}
                            className="flex items-center justify-center p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors min-w-[36px] min-h-[36px]"
                            title="Play Next"
                          >
                            <PlayCircle className="w-4 h-4 text-white" />
                            <span className="hidden lg:inline ml-1 text-white text-xs">Play Next</span>
                          </button>
                          <button
                            onClick={() => onPlayAgain(request.id, false)}
                            className="flex items-center justify-center p-2 bg-green-600 hover:bg-green-700 rounded transition-colors min-w-[36px] min-h-[36px]"
                            title="Add to Queue"
                          >
                            <CheckCircle className="w-4 h-4 text-white" />
                            <span className="hidden lg:inline ml-1 text-white text-xs">Add to Queue</span>
                          </button>
                        </>
                      )}
                      {/* Delete button - hidden on mobile, replaced with swipe gesture */}
                      <button
                        onClick={() => onDelete(request.id)}
                        className="hidden md:flex items-center justify-center p-2 text-gray-400 hover:text-red-400 transition-colors min-h-[36px] min-w-[36px] rounded hover:bg-gray-700"
                        title="Delete Request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </SwipeToDelete>
          ))
        )}
      </div>
    </div>
  );
};

export default function RequestsPage() {
  const {
    requests,
    handleApprove,
    handleReject,
    handleDelete,
    handlePlayAgain,
    loading,
    refreshData
  } = useAdminData();

  const [isAddingRandomSong, setIsAddingRandomSong] = useState(false);

  const handleAddRandomSong = async () => {
    if (isAddingRandomSong) return;
    
    setIsAddingRandomSong(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.error('No admin token found');
        return;
      }

      const response = await fetch('/api/admin/add-random-song', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Random song added:', result.request.track.name);
        
        // No need to refresh manually - Pusher event will update the list automatically
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
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RequestsTab
      requestsData={requests || []}
      onApprove={handleApprove}
      onReject={handleReject}
      onDelete={handleDelete}
      onPlayAgain={handlePlayAgain}
      onAddRandomSong={handleAddRandomSong}
      isAddingRandomSong={isAddingRandomSong}
    />
  );
}
