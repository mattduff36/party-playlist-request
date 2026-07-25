/**
 * Tests for Spotify Connection Panel Component
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SpotifyConnectionPanel from '../SpotifyConnectionPanel';

// Mock fetch
global.fetch = jest.fn();

describe('SpotifyConnectionPanel', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders correctly when not connected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: false,
        device: null,
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Spotify Connection')).toBeInTheDocument();
    expect(screen.getByText('Connect your Spotify account to control playback')).toBeInTheDocument();
    expect(screen.getByText('Not Connected')).toBeInTheDocument();
  });

  it('shows connect button when not connected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: false,
        device: null,
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Connect to Spotify')).toBeInTheDocument();
  });

  it('handles connect button click', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: false,
        device: null,
      })
    });

    delete (window as any).location;
    window.location = { href: '' } as any;

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    const connectButton = screen.getByText('Connect to Spotify');
    fireEvent.click(connectButton);

    expect(window.location.href).toBe('/api/spotify/auth');
  });

  it('renders correctly when connected with active device', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: true,
        device: {
          name: 'Living Room Speaker',
          type: 'Speaker',
          volume_percent: 82,
        },
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Connected to Spotify')).toBeInTheDocument();
    expect(screen.getByText(/Active device: Living Room Speaker/)).toBeInTheDocument();
    expect(screen.queryByText('No Spotify devices found')).not.toBeInTheDocument();
  });

  it('shows disconnect button when connected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: true,
        device: null,
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Disconnect from Spotify')).toBeInTheDocument();
  });

  it('handles disconnect button click', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          connected: true,
          device: null,
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    const disconnectButton = screen.getByText('Disconnect from Spotify');
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
    });
  });

  it('displays error messages', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Connection failed' })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('handles network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Network error checking connection status')).toBeInTheDocument();
  });

  it('shows loading state during connection check', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });
});
