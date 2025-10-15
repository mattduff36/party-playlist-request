'use client';

/**
 * React Query Provider
 * 
 * Provides client-side caching, request deduplication, and automatic refetching
 * for API requests throughout the application.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

// Configure default options for all queries
const queryClientConfig = {
  defaultOptions: {
    queries: {
      // Stale time: How long data is considered fresh (won't refetch)
      staleTime: 30 * 1000, // 30 seconds
      
      // Cache time: How long unused data stays in cache
      gcTime: 5 * 60 * 1000, // 5 minutes (was cacheTime in v4)
      
      // Retry configuration
      retry: 1,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus (good for real-time data)
      refetchOnWindowFocus: true,
      
      // Refetch on reconnect (good for reliability)
      refetchOnReconnect: true,
      
      // Don't refetch on mount if data is fresh
      refetchOnMount: 'always' as const,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
};

export function QueryProvider({ children }: { children: ReactNode }) {
  // Create a new QueryClient instance per component mount
  // This ensures server-side and client-side don't share state
  const [queryClient] = useState(() => new QueryClient(queryClientConfig));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Export a pre-configured query client for use outside of React components
export const createQueryClient = () => new QueryClient(queryClientConfig);


