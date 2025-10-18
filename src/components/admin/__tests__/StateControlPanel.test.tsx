/**
 * Tests for State Control Panel Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StateControlPanel from '../StateControlPanel';

// Mock the global event hook (client version used by components)
jest.mock('@/lib/state/global-event-client', () => ({
  useGlobalEvent: () => ({
    state: {
      status: 'offline',
      pagesEnabled: { requests: false, display: false },
      isConnected: true,
      error: null
    },
    actions: {
      setEventStatus: jest.fn().mockResolvedValue(undefined),
      setError: jest.fn()
    }
  }),
  EventStateMachine: {
    canTransition: () => true,
  }
}));

describe('StateControlPanel', () => {
  it('renders correctly with offline status', () => {
    render(<StateControlPanel />);
    
    expect(screen.getByText('Event Control')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders header and buttons', () => {
    render(<StateControlPanel />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders all three state buttons', () => {
    render(<StateControlPanel />);
    
    // Check for button text (there are multiple "Offline" texts, so we need to be more specific)
    const offlineButtons = screen.getAllByText('Offline');
    expect(offlineButtons.length).toBeGreaterThan(0);
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows all three state labels', () => {
    render(<StateControlPanel />);
    
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('handles state change clicks (shows updating indicator)', async () => {
    render(<StateControlPanel />);
    const standbyButton = screen.getByText('Standby').closest('button');
    expect(standbyButton).toBeInTheDocument();
    fireEvent.click(standbyButton!);
    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });

  it('disables buttons during transition', async () => {
    const mockSetEventStatus = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    jest.doMock('@/lib/state/global-event-client', () => ({
      useGlobalEvent: () => ({
        state: {
          status: 'offline',
          pagesEnabled: { requests: false, display: false },
          isConnected: true,
          error: null
        },
        actions: { setEventStatus: mockSetEventStatus, setError: jest.fn() }
      }),
      EventStateMachine: { canTransition: () => true }
    }));

    render(<StateControlPanel />);
    
    const standbyButton = screen.getByText('Standby').closest('button');
    fireEvent.click(standbyButton!);
    
    // Button should be disabled during transition
    expect(standbyButton).toHaveClass('opacity-50');
    expect(standbyButton).toHaveClass('cursor-not-allowed');
  });

  it('displays error when present', () => {
    // Re-render with a manual error by mocking hook return once
    const mod = require('@/lib/state/global-event-client');
    jest.spyOn(mod, 'useGlobalEvent').mockReturnValueOnce({
      state: { status: 'offline', pagesEnabled: { requests: false, display: false }, isConnected: true, error: 'Connection failed' },
      actions: { setEventStatus: jest.fn(), setError: jest.fn() }
    });
    render(<StateControlPanel />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('applies correct styling for active state', () => {
    const mod = require('@/lib/state/global-event-client');
    jest.spyOn(mod, 'useGlobalEvent').mockReturnValueOnce({
      state: { status: 'live', pagesEnabled: { requests: true, display: true }, isConnected: true, error: null },
      actions: { setEventStatus: jest.fn(), setError: jest.fn() }
    });
    render(<StateControlPanel />);
    const liveButton = screen.getByText('Live').closest('button');
    expect(liveButton?.className).toMatch('border-green-600');
  });

  it('applies correct styling for inactive states', () => {
    render(<StateControlPanel />);
    
    const standbyButton = screen.getByText('Standby').closest('button');
    const liveButton = screen.getByText('Live').closest('button');
    
    expect(standbyButton).toHaveClass('bg-gray-700', 'border-gray-600', 'text-gray-400');
    expect(liveButton).toHaveClass('bg-gray-700', 'border-gray-600', 'text-gray-400');
  });
});
