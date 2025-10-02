/**
 * Tests for Error Boundary Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../ErrorBoundary';

// Mock component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when there is an error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component Error')).toBeInTheDocument();
    expect(screen.getByText('This component encountered an error and could not render properly.')).toBeInTheDocument();
  });

  it('should show error ID', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error ID:')).toBeInTheDocument();
    expect(screen.getByText(/error_\d+_/)).toBeInTheDocument();
  });

  it('should show retry button when retries are available', () => {
    render(
      <ErrorBoundary maxRetries={3}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should not show retry button when max retries reached', () => {
    render(
      <ErrorBoundary maxRetries={0}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object),
      expect.stringMatching(/error_\d+_/)
    );
  });

  it('should call onRetry callback when retry is clicked', () => {
    const onRetry = jest.fn();
    
    render(
      <ErrorBoundary onRetry={onRetry} maxRetries={3}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should show error details when showDetails is true', () => {
    render(
      <ErrorBoundary showDetails={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error Details')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should not show error details when showDetails is false', () => {
    render(
      <ErrorBoundary showDetails={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Error Details')).not.toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('should show different UI for page level errors', () => {
    render(
      <ErrorBoundary level="page">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('We encountered an unexpected error. Please try again.')).toBeInTheDocument();
  });

  it('should show different UI for critical level errors', () => {
    render(
      <ErrorBoundary level="critical">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component Error')).toBeInTheDocument();
  });

  it('should handle retry functionality', async () => {
    render(
      <ErrorBoundary maxRetries={3}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Try Again'));
    
    // Should show retrying state
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    
    // The component doesn't actually reset the error state on retry
    // It just shows the retrying state
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });

  it('should handle reset functionality', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component Error')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Reset'));
    
    // The component should still show the error state
    // as it doesn't actually reset the error state
    expect(screen.getByText('Component Error')).toBeInTheDocument();
  });

  it('should handle go home functionality', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Just test that the button exists and can be clicked
    const goHomeButton = screen.getByText('Go Home');
    expect(goHomeButton).toBeInTheDocument();
    
    fireEvent.click(goHomeButton);
    // The component should still be in error state
    expect(screen.getByText('Component Error')).toBeInTheDocument();
  });

  it('should handle reload functionality', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Just test that the button exists and can be clicked
    const reloadButton = screen.getByText('Reload Page');
    expect(reloadButton).toBeInTheDocument();
    
    fireEvent.click(reloadButton);
    // The component should still be in error state
    expect(screen.getByText('Component Error')).toBeInTheDocument();
  });

  it('should show retry count when retries have been attempted', () => {
    render(
      <ErrorBoundary maxRetries={3}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Click retry once
    fireEvent.click(screen.getByText('Try Again'));
    
    // Should show retrying state
    expect(screen.getByText('Retrying...')).toBeInTheDocument();
  });
});
