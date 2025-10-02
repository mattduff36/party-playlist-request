/**
 * Error Boundary Component
 * 
 * This component provides comprehensive error boundary functionality
 * with fallback UI, error reporting, and recovery mechanisms.
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, X } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  isRetrying: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  onRetry?: () => void;
  maxRetries?: number;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'critical';
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    const { errorId } = this.state;

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Report error
    this.reportError(error, errorInfo, errorId);

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo, errorId);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    // Report to monitoring system
    if (typeof window !== 'undefined') {
      // Report to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('🚨 Error Boundary Caught Error:', {
          error,
          errorInfo,
          errorId,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        });
      }

      // Report to external monitoring service
      this.reportToMonitoring(error, errorInfo, errorId);
    }
  };

  private reportToMonitoring = async (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    try {
      // Report to our monitoring system
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errorId,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: Date.now(),
          level: this.props.level || 'component',
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });
    } catch (reportingError) {
      console.error('Failed to report error to monitoring:', reportingError);
    }
  };

  private handleRetry = () => {
    const { maxRetries = 3, onRetry } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // Call custom retry handler
    if (onRetry) {
      onRetry();
    }

    // Reset error state after a short delay
    this.retryTimeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
        isRetrying: false,
      });
    }, 1000);
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRetrying: false,
    });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, errorId, retryCount, isRetrying } = this.state;
    const { children, fallback, maxRetries = 3, showDetails = false, level = 'component' } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Render appropriate error UI based on level
      return (
        <div className={`error-boundary error-boundary--${level}`}>
          {this.renderErrorUI(error, errorInfo, errorId, retryCount, isRetrying, maxRetries, showDetails, level)}
        </div>
      );
    }

    return children;
  }

  private renderErrorUI = (
    error: Error | null,
    errorInfo: ErrorInfo | null,
    errorId: string,
    retryCount: number,
    isRetrying: boolean,
    maxRetries: number,
    showDetails: boolean,
    level: string
  ) => {
    const canRetry = retryCount < maxRetries;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          {/* Error Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          {/* Error Title */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {level === 'page' ? 'Something went wrong' : 'Component Error'}
            </h1>
            <p className="text-gray-600 mt-2">
              {level === 'page' 
                ? 'We encountered an unexpected error. Please try again.'
                : 'This component encountered an error and could not render properly.'
              }
            </p>
          </div>

          {/* Error ID */}
          <div className="bg-gray-100 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Error ID:</span>
              <code className="text-sm font-mono text-gray-800">{errorId}</code>
            </div>
          </div>

          {/* Error Details (if enabled) */}
          {showDetails && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center mb-2">
                <Bug className="h-4 w-4 text-red-600 mr-2" />
                <span className="text-sm font-medium text-red-800">Error Details</span>
              </div>
              <div className="text-sm text-red-700">
                <div className="font-mono break-all">{error.message}</div>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-red-600 hover:text-red-800">
                      Stack Trace
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto max-h-32 bg-red-100 p-2 rounded">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {canRetry && (
              <button
                onClick={this.handleRetry}
                disabled={isRetrying}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </>
                )}
              </button>
            )}

            <div className="flex space-x-2">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4 mr-2" />
                Reset
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </button>
            </div>

            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Page
            </button>
          </div>

          {/* Retry Count */}
          {retryCount > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Retry attempts: {retryCount}/{maxRetries}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
