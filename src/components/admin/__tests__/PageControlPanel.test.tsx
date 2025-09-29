/**
 * Tests for Page Control Panel Component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PageControlPanel from '../PageControlPanel';

// Mock the global event hook
jest.mock('@/lib/state/global-event', () => ({
  useGlobalEvent: () => ({
    state: {
      pagesEnabled: {
        requests: false,
        display: false
      }
    },
    actions: {
      setPageEnabled: jest.fn().mockResolvedValue(undefined)
    }
  })
}));

describe('PageControlPanel', () => {
  it('renders correctly with disabled pages', () => {
    render(<PageControlPanel />);
    
    expect(screen.getByText('Page Controls')).toBeInTheDocument();
    expect(screen.getByText('Enable or disable pages for users')).toBeInTheDocument();
    expect(screen.getByText('Requests Page')).toBeInTheDocument();
    expect(screen.getByText('Display Page')).toBeInTheDocument();
  });

  it('shows correct page descriptions', () => {
    render(<PageControlPanel />);
    
    expect(screen.getByText('Allow users to submit song requests')).toBeInTheDocument();
    expect(screen.getByText('Show now playing and queue')).toBeInTheDocument();
  });

  it('displays disabled status for both pages', () => {
    render(<PageControlPanel />);
    
    const disabledElements = screen.getAllByText('Disabled');
    expect(disabledElements).toHaveLength(2);
  });

  it('shows eye-off icons for disabled pages', () => {
    render(<PageControlPanel />);
    
    const eyeOffIcons = screen.getAllByTestId('eye-off-icon');
    expect(eyeOffIcons).toHaveLength(2);
  });

  it('handles page toggle clicks', async () => {
    const mockSetPageEnabled = jest.fn().mockResolvedValue(undefined);
    
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          pagesEnabled: {
            requests: false,
            display: false
          }
        },
        actions: {
          setPageEnabled: mockSetPageEnabled
        }
      })
    }));

    render(<PageControlPanel />);
    
    const requestsToggle = screen.getByText('Requests Page').closest('div')?.querySelector('button');
    expect(requestsToggle).toBeInTheDocument();
    
    fireEvent.click(requestsToggle!);
    
    await waitFor(() => {
      expect(mockSetPageEnabled).toHaveBeenCalledWith('requests', true);
    });
  });

  it('disables toggles during transition', async () => {
    const mockSetPageEnabled = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          pagesEnabled: {
            requests: false,
            display: false
          }
        },
        actions: {
          setPageEnabled: mockSetPageEnabled
        }
      })
    }));

    render(<PageControlPanel />);
    
    const requestsToggle = screen.getByText('Requests Page').closest('div')?.querySelector('button');
    fireEvent.click(requestsToggle!);
    
    // Toggle should be disabled during transition
    expect(requestsToggle).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('applies correct styling for enabled pages', () => {
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          pagesEnabled: {
            requests: true,
            display: true
          }
        },
        actions: {
          setPageEnabled: jest.fn().mockResolvedValue(undefined)
        }
      })
    }));

    render(<PageControlPanel />);
    
    const enabledElements = screen.getAllByText('Enabled');
    expect(enabledElements).toHaveLength(2);
  });

  it('shows eye icons for enabled pages', () => {
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          pagesEnabled: {
            requests: true,
            display: true
          }
        },
        setPageEnabled: jest.fn().mockResolvedValue(undefined)
      })
    }));

    render(<PageControlPanel />);
    
    // Check for eye icons (which indicate enabled state)
    const eyeIcons = screen.getAllByRole('img', { hidden: true });
    expect(eyeIcons.length).toBeGreaterThan(0);
  });

  it('displays help text', () => {
    render(<PageControlPanel />);
    
    expect(screen.getByText('Page Control Tips:')).toBeInTheDocument();
    expect(screen.getByText('• Disable pages to prevent user access during setup')).toBeInTheDocument();
    expect(screen.getByText('• Both pages can be enabled simultaneously')).toBeInTheDocument();
    expect(screen.getByText('• Changes take effect immediately across all devices')).toBeInTheDocument();
  });

  it('applies correct styling for mixed states', () => {
    jest.doMock('@/lib/state/global-event', () => ({
      useGlobalEvent: () => ({
        state: {
          pagesEnabled: {
            requests: true,
            display: false
          }
        },
        setPageEnabled: jest.fn().mockResolvedValue(undefined)
      })
    }));

    render(<PageControlPanel />);
    
    // Check for both enabled and disabled states
    const enabledElements = screen.getAllByText('Enabled');
    const disabledElements = screen.getAllByText('Disabled');
    expect(enabledElements.length).toBeGreaterThan(0);
    expect(disabledElements.length).toBeGreaterThan(0);
  });
});
