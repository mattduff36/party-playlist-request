/**
 * Higher-Order Component for Error Boundaries
 * 
 * This HOC provides a convenient way to wrap components with error boundaries
 * and graceful degradation.
 */

'use client';

import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import DegradedUI from './DegradedUI';

interface WithErrorBoundaryOptions {
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void;
  onRetry?: () => void;
  maxRetries?: number;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'critical';
  enableGracefulDegradation?: boolean;
  showDegradationStatus?: boolean;
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const {
    fallback,
    onError,
    onRetry,
    maxRetries = 3,
    showDetails = false,
    level = 'component',
    enableGracefulDegradation = true,
    showDegradationStatus = true,
  } = options;

  const WithErrorBoundaryComponent = (props: P) => {
    const errorBoundaryProps = {
      fallback,
      onError,
      onRetry,
      maxRetries,
      showDetails,
      level,
    };

    if (enableGracefulDegradation) {
      return (
        <ErrorBoundary {...errorBoundaryProps}>
          <DegradedUI showStatus={showDegradationStatus}>
            <WrappedComponent {...props} />
          </DegradedUI>
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

export default withErrorBoundary;

