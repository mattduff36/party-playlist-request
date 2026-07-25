/**
 * Error boundary specifically for Spotify authentication errors
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SpotifyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a Spotify authentication error
    if (error.message.includes('invalid_client') || 
        error.message.includes('Failed to refresh token') ||
        error.message.includes('Spotify')) {
      return { hasError: true, error };
    }
    
    // Let other errors bubble up
    return { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('Spotify authentication error caught:', error.message);
    // Don't log to external services for auth errors
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Spotify Connection Issue
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Spotify authentication has expired. Please reconnect your Spotify account 
                  to continue using music features.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
