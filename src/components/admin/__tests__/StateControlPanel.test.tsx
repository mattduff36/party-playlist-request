/**
 * Tests for State Control Panel Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StateControlPanel from '../StateControlPanel';

// Mock the global event hook
jest.mock('@/lib/state/global-event', () => ({
  useGlobalEvent: () => ({
    state: {
      status: 'offline',
      isConnected: true,
      error: null
    },
    actions: {
      setEventStatus: jest.fn().mockResolvedValue(undefined)
    }
  })
}));

describe('StateControlPanel', () => {
  it('renders correctly with offline status', () => {
    render(<StateControlPanel />);
    
    expect(screen.getByText('Event Control')).toBeInTheDocument();
    expect(screen.getByText('Control the party playlist event state')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Event not started')).toBeInTheDocument();
  });

  it('displays connection status', () => {
    render(<StateControlPanel />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders all three state buttons', () => {
    render(<StateControlPanel />);
    
    // Check for button text (there are multiple "Offline" texts, so we need to be more specific)
    const offlineButtons = screen.getAllByText('Offline');
    expect(offlineButtons.length).toBeGreaterThan(0);
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows correct descriptions for each state', () => {
    render(<StateControlPanel />);
    
    // There are multiple "Event not started" texts, so we need to check for all of them
    const eventNotStartedTexts = screen.getAllByText('Event not started');
    expect(eventNotStartedTexts.length).toBeGreaterThan(0);
    expect(screen.getByText('Event ready to start')).toBeInTheDocument();
    expect(screen.getByText('Event in progress')).toBeInTheDocument();
  });

  it('handles state change clicks', async () => {
    const mockSetEventStatus = jest.fn().mockResolvedValue(undefined);
    
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          eventStatus: 'offline',
          isConnected: true,
          error: null
        },
        setEventStatus: mockSetEventStatus
      })
    }));

    render(<StateControlPanel />);
    
    const standbyButton = screen.getByText('Standby').closest('button');
    expect(standbyButton).toBeInTheDocument();
    
    fireEvent.click(standbyButton!);
    
    await waitFor(() => {
      expect(mockSetEventStatus).toHaveBeenCalledWith('standby');
    });
  });

  it('disables buttons during transition', async () => {
    const mockSetEventStatus = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          eventStatus: 'offline',
          isConnected: true,
          error: null
        },
        setEventStatus: mockSetEventStatus
      })
    }));

    render(<StateControlPanel />);
    
    const standbyButton = screen.getByText('Standby').closest('button');
    fireEvent.click(standbyButton!);
    
    // Button should be disabled during transition
    expect(standbyButton).toHaveClass('opacity-50');
    expect(standbyButton).toHaveClass('cursor-not-allowed');
  });

  it('displays error when present', () => {
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          eventStatus: 'offline',
          isConnected: true,
          error: 'Connection failed'
        },
        setEventStatus: jest.fn().mockResolvedValue(undefined)
      })
    }));

    render(<StateControlPanel />);
    
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('applies correct styling for active state', () => {
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          status: 'live',
          isConnected: true,
          error: null
        },
        actions: {
          setEventStatus: jest.fn().mockResolvedValue(undefined)
        }
      })
    }));

    render(<StateControlPanel />);
    
    const liveButton = screen.getByText('Live').closest('button');
    expect(liveButton).toHaveClass('bg-green-900/20', 'border-green-600', 'text-green-400');
  });

  it('applies correct styling for inactive states', () => {
    render(<StateControlPanel />);
    
    const standbyButton = screen.getByText('Standby').closest('button');
    const liveButton = screen.getByText('Live').closest('button');
    
    expect(standbyButton).toHaveClass('bg-gray-700', 'border-gray-600', 'text-gray-400');
    expect(liveButton).toHaveClass('bg-gray-700', 'border-gray-600', 'text-gray-400');
  });
});
