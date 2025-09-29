/**
 * Request Management Panel Component
 * 
 * This component provides a streamlined interface for managing song requests
 * with immediate feedback and batch operations.
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Music, 
  Clock, 
  User, 
  Play,
  Pause,
  MoreVertical,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';

interface Request {
  id: string;
  track_name: string;
  artist_name: string;
  album_name?: string;
  requester_nickname?: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  image_url?: string;
}

interface RequestManagementPanelProps {
  className?: string;
}

export default function RequestManagementPanel({ className = '' }: RequestManagementPanelProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/requests');
      const data = await response.json();
      
      if (response.ok) {
        setRequests(data.requests || []);
      } else {
        console.error('Failed to fetch requests:', data.error);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle single request action
  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject' | 'delete', playNext = false) => {
    setActionLoading(requestId);
    
    try {
      const response = await fetch(`/api/admin/requests/${requestId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playNext })
      });
      
      if (response.ok) {
        // Update local state immediately for optimistic UI
        setRequests(prev => prev.map(req => 
          req.id === requestId 
            ? { 
                ...req, 
                status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : req.status,
                approved_at: action === 'approve' ? new Date().toISOString() : req.approved_at,
                approved_by: action === 'approve' ? 'admin' : req.approved_by
              }
            : req
        ));
        
        // Remove from selected if it was selected
        setSelectedRequests(prev => {
          const newSet = new Set(prev);
          newSet.delete(requestId);
          return newSet;
        });
      } else {
        const data = await response.json();
        console.error(`Failed to ${action} request:`, data.error);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle batch actions
  const handleBatchAction = async (action: 'approve' | 'reject' | 'delete') => {
    if (selectedRequests.size === 0) return;
    
    setActionLoading('batch');
    
    try {
      const response = await fetch('/api/admin/requests/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          requestIds: Array.from(selectedRequests), 
          action 
        })
      });
      
      if (response.ok) {
        // Update local state
        setRequests(prev => prev.map(req => 
          selectedRequests.has(req.id)
            ? { 
                ...req, 
                status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : req.status,
                approved_at: action === 'approve' ? new Date().toISOString() : req.approved_at,
                approved_by: action === 'approve' ? 'admin' : req.approved_by
              }
            : req
        ));
        
        setSelectedRequests(new Set());
      } else {
        const data = await response.json();
        console.error(`Failed to batch ${action} requests:`, data.error);
      }
    } catch (error) {
      console.error(`Error batch ${action}ing requests:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle request selection
  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  // Select all visible requests
  const selectAllVisible = () => {
    const visibleRequests = filteredRequests.map(req => req.id);
    setSelectedRequests(new Set(visibleRequests));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedRequests(new Set());
  };

  // Filter and search requests
  const filteredRequests = requests.filter(req => {
    const matchesFilter = filter === 'all' || req.status === filter;
    const matchesSearch = searchTerm === '' || 
      req.track_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.artist_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.requester_nickname && req.requester_nickname.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  // Load requests on mount
  useEffect(() => {
    fetchRequests();
  }, []);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'approved':
        return 'text-green-400 bg-green-900/20';
      case 'rejected':
        return 'text-red-400 bg-red-900/20';
      case 'played':
        return 'text-blue-400 bg-blue-900/20';
      default:
        return 'text-gray-400 bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">Request Management</h2>
          <p className="text-gray-400 text-sm">
            {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''} 
            {filter !== 'all' && ` (${filter})`}
          </p>
        </div>
        
        <button
          onClick={fetchRequests}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${filter === filterType 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions */}
      {selectedRequests.size > 0 && (
        <div className="mb-4 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-blue-400 font-medium">
              {selectedRequests.size} request{selectedRequests.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBatchAction('approve')}
                disabled={actionLoading === 'batch'}
                className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Approve All</span>
              </button>
              <button
                onClick={() => handleBatchAction('reject')}
                disabled={actionLoading === 'batch'}
                className="flex items-center space-x-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject All</span>
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-8">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">
              {searchTerm ? 'No requests match your search' : 'No requests found'}
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <div
              key={request.id}
              className={`
                flex items-center space-x-4 p-4 rounded-lg border-2 transition-all duration-200
                ${selectedRequests.has(request.id) 
                  ? 'bg-blue-900/20 border-blue-600' 
                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                }
              `}
            >
              {/* Selection Checkbox */}
              <input
                type="checkbox"
                checked={selectedRequests.has(request.id)}
                onChange={() => toggleRequestSelection(request.id)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />

              {/* Album Art */}
              <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {request.image_url ? (
                  <img 
                    src={request.image_url} 
                    alt="Album art" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-6 h-6 text-gray-400" />
                )}
              </div>

              {/* Request Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-medium text-white truncate">
                    {request.track_name}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                <p className="text-gray-400 text-sm truncate">
                  {request.artist_name}
                  {request.album_name && ` • ${request.album_name}`}
                </p>
                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(request.created_at)}</span>
                  </span>
                  {request.requester_nickname && (
                    <span className="flex items-center space-x-1">
                      <User className="w-3 h-3" />
                      <span>{request.requester_nickname}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {request.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleRequestAction(request.id, 'approve')}
                      disabled={actionLoading === request.id}
                      className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                      title="Approve request"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleRequestAction(request.id, 'reject')}
                      disabled={actionLoading === request.id}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title="Reject request"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => handleRequestAction(request.id, 'delete')}
                  disabled={actionLoading === request.id}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  title="Delete request"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
