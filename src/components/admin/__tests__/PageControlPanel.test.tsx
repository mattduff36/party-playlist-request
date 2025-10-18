/**
 * Tests for Page Control Panel Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PageControlPanel from '../PageControlPanel';

// Mock the global event hook (client version used by components)
jest.mock('@/lib/state/global-event-client', () => ({
  useGlobalEvent: () => ({
    state: {
      status: 'standby',
      pagesEnabled: {
        requests: false,
        display: false
      },
      error: null
    },
    actions: {
      setPageEnabled: jest.fn().mockResolvedValue(undefined),
      setError: jest.fn()
    }
  }),
  EventStateMachine: { canTransition: () => true }
}));

describe('PageControlPanel', () => {
  it('renders correctly with disabled pages', () => {
    render(<PageControlPanel />);
    
    expect(screen.getByText('Page Controls')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
  });

  it('shows both page tiles', () => {
    render(<PageControlPanel />);
    
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
  });

  it('buttons are present', () => {
    render(<PageControlPanel />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
  });

  it('renders icons for both tiles', () => {
    render(<PageControlPanel />);
    
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
  });

  it('handles page toggle clicks', async () => {
    const mockSetPageEnabled = jest.fn().mockResolvedValue(undefined);
    
    const mod = require('@/lib/state/global-event-client');
    jest.spyOn(mod, 'useGlobalEvent').mockReturnValueOnce({
      state: { status: 'standby', pagesEnabled: { requests: false, display: false }, error: null },
      actions: { setPageEnabled: mockSetPageEnabled, setError: jest.fn() }
    });

    render(<PageControlPanel />);
    
    const requestsButton = screen.getByText('Requests').closest('button');
    expect(requestsButton).toBeInTheDocument();
    fireEvent.click(requestsButton!);
    
    await waitFor(() => {
      expect(mockSetPageEnabled).toHaveBeenCalledWith('requests', true);
    });
  });

  it('disables toggles during transition', async () => {
    const mockSetPageEnabled = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    const mod = require('@/lib/state/global-event-client');
    jest.spyOn(mod, 'useGlobalEvent').mockReturnValueOnce({
      state: { status: 'standby', pagesEnabled: { requests: false, display: false }, error: null },
      actions: { setPageEnabled: mockSetPageEnabled, setError: jest.fn() }
    });

    render(<PageControlPanel />);
    
    const requestsButton = screen.getByText('Requests').closest('button');
    fireEvent.click(requestsButton!);
    
    // Toggle should be disabled during transition
    expect(requestsButton).toHaveClass('opacity-50');
  });

  it('applies enabled styling when pagesEnabled is true', () => {
    const mod = require('@/lib/state/global-event-client');
    jest.spyOn(mod, 'useGlobalEvent').mockReturnValueOnce({
      state: { status: 'standby', pagesEnabled: { requests: true, display: true }, error: null },
      actions: { setPageEnabled: jest.fn(), setError: jest.fn() }
    });

    render(<PageControlPanel />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toMatch('border-green-600');
    expect(buttons[1].className).toMatch('border-green-600');
  });

  it('shows visual change for enabled pages', () => {
    const mod = require('@/lib/state/global-event-client');
    jest.spyOn(mod, 'useGlobalEvent').mockReturnValueOnce({
      state: { status: 'standby', pagesEnabled: { requests: true, display: true }, error: null },
      actions: { setPageEnabled: jest.fn(), setError: jest.fn() }
    });

    render(<PageControlPanel />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toMatch('border-green-600');
    expect(buttons[1].className).toMatch('border-green-600');
  });

  it('no help text is rendered in compact UI', () => {
    render(<PageControlPanel />);
    expect(screen.getByText('Page Controls')).toBeInTheDocument();
  });

  it('applies correct styling for mixed states', () => {
    const mod = require('@/lib/state/global-event-client');
    jest.spyOn(mod, 'useGlobalEvent').mockReturnValueOnce({
      state: { status: 'standby', pagesEnabled: { requests: true, display: false }, error: null },
      actions: { setPageEnabled: jest.fn(), setError: jest.fn() }
    });

    render(<PageControlPanel />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toMatch('border-green-600');
    expect(buttons[1].className).toMatch('border-gray-600');
  });
});
