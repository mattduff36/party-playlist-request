import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoadingState from './LoadingState';

describe('LoadingState Component', () => {
  it('renders with default message and spinner', () => {
    const { container } = render(<LoadingState />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument(); // Spinner
  });

  it('renders with custom message', () => {
    render(<LoadingState message="Please wait..." />);
    
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('renders without spinner when showSpinner is false', () => {
    const { container } = render(<LoadingState showSpinner={false} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('applies correct background gradient', () => {
    const { container } = render(<LoadingState />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('bg-gradient-to-br', 'from-purple-900', 'via-blue-900', 'to-indigo-900');
  });

  it('centers content vertically and horizontally', () => {
    const { container } = render(<LoadingState />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
  });

  it('renders spinner with correct classes', () => {
    const { container } = render(<LoadingState />);
    
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toHaveClass('rounded-full', 'h-12', 'w-12', 'border-b-2', 'border-white');
  });

  it('renders text with correct styling', () => {
    render(<LoadingState message="Custom loading message" />);
    
    const text = screen.getByText('Custom loading message');
    expect(text).toHaveClass('text-white', 'text-lg');
  });
});
