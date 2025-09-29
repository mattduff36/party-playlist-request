import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorState from './ErrorState';

describe('ErrorState Component', () => {
  const defaultProps = {
    error: 'Something went wrong!'
  };

  it('renders error message correctly', () => {
    render(<ErrorState {...defaultProps} />);
    
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
  });

  it('renders warning icon', () => {
    const { container } = render(<ErrorState {...defaultProps} />);
    
    const warningIcon = container.querySelector('.text-red-400');
    expect(warningIcon).toBeInTheDocument();
    expect(warningIcon).toHaveTextContent('⚠️');
  });

  it('renders retry button when onRetry is provided', () => {
    const mockRetry = jest.fn();
    render(<ErrorState {...defaultProps} onRetry={mockRetry} />);
    
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).toHaveClass('bg-blue-600', 'hover:bg-blue-700');
  });

  it('calls onRetry when retry button is clicked', () => {
    const mockRetry = jest.fn();
    render(<ErrorState {...defaultProps} onRetry={mockRetry} />);
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('renders custom retry button label', () => {
    const mockRetry = jest.fn();
    render(<ErrorState {...defaultProps} onRetry={mockRetry} retryLabel="Try Again" />);
    
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState {...defaultProps} />);
    
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('applies correct background gradient', () => {
    const { container } = render(<ErrorState {...defaultProps} />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('bg-gradient-to-br', 'from-purple-900', 'via-blue-900', 'to-indigo-900');
  });

  it('centers content vertically and horizontally', () => {
    const { container } = render(<ErrorState {...defaultProps} />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
  });

  it('renders error title with correct styling', () => {
    render(<ErrorState {...defaultProps} />);
    
    const title = screen.getByText('Connection Error');
    expect(title).toHaveClass('text-white', 'text-2xl', 'font-bold');
  });

  it('renders error message with correct styling', () => {
    render(<ErrorState {...defaultProps} />);
    
    const message = screen.getByText('Something went wrong!');
    expect(message).toHaveClass('text-gray-300');
  });

  it('handles long error messages', () => {
    const longError = 'This is a very long error message that should be handled gracefully and not break the layout or cause any issues with the component rendering';
    render(<ErrorState error={longError} />);
    
    expect(screen.getByText(longError)).toBeInTheDocument();
  });
});
