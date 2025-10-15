'use client';

/**
 * Custom React Query Hooks for API Requests
 * 
 * These hooks provide:
 * - Automatic request caching
 * - Request deduplication
 * - Stale-while-revalidate pattern
 * - Automatic refetching on window focus
 * - Error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query Keys - centralized for cache invalidation
export const QUERY_KEYS = {
  requests: (status?: string) => ['requests', status].filter(Boolean),
  stats: () => ['stats'],
  spotifyStatus: () => ['spotify-status'],
  eventStatus: () => ['event-status'],
  eventSettings: () => ['event-settings'],
  queue: () => ['queue'],
} as const;

// ============================================================================
// REQUESTS QUERIES
// ============================================================================

interface RequestsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export function useRequests(params: RequestsParams = {}) {
  const { status = 'all', limit = 50, offset = 0 } = params;
  
  return useQuery({
    queryKey: QUERY_KEYS.requests(status),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        status,
        limit: limit.toString(),
        offset: offset.toString(),
      });
      
      const response = await fetch(`/api/admin/requests?${searchParams}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }
      
      return response.json();
    },
    staleTime: 15 * 1000, // 15 seconds - matches cache header
    gcTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================================================
// STATS QUERY
// ============================================================================

export function useStats() {
  return useQuery({
    queryKey: QUERY_KEYS.stats(),
    queryFn: async () => {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      return response.json();
    },
    staleTime: 20 * 1000, // 20 seconds - matches cache header
    gcTime: 3 * 60 * 1000, // 3 minutes
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds when focused
  });
}

// ============================================================================
// SPOTIFY STATUS QUERY
// ============================================================================

export function useSpotifyStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.spotifyStatus(),
    queryFn: async () => {
      const response = await fetch('/api/spotify/status', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch Spotify status');
      }
      
      return response.json();
    },
    staleTime: 10 * 1000, // 10 seconds - matches cache header
    gcTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 15 * 1000, // Auto-refetch every 15 seconds for playback state
  });
}

// ============================================================================
// EVENT STATUS QUERY
// ============================================================================

export function useEventStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.eventStatus(),
    queryFn: async () => {
      const response = await fetch('/api/event/status', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch event status');
      }
      
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds - matches cache header
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// MUTATIONS (for write operations)
// ============================================================================

export function useApproveRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, playNext }: { id: string; playNext?: boolean }) => {
      const response = await fetch(`/api/admin/approve/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ play_next: playNext }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to approve request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch requests
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.requests() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats() });
    },
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await fetch(`/api/admin/reject/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reject request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch requests
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.requests() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats() });
    },
  });
}

export function useDeleteRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/delete/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch requests
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.requests() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats() });
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Prefetch requests - useful for hovering over tabs
 */
export function usePrefetchRequests() {
  const queryClient = useQueryClient();
  
  return (status: string) => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.requests(status),
      queryFn: async () => {
        const response = await fetch(`/api/admin/requests?status=${status}`, {
          credentials: 'include',
        });
        return response.json();
      },
    });
  };
}

/**
 * Invalidate all queries - useful after logout or major state changes
 */
export function useInvalidateAll() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries();
  };
}


