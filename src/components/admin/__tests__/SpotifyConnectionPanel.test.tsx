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
    sessionStorage.clear();
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

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    const connectButton = await screen.findByRole('button', { name: /Connect to Spotify/i });
    fireEvent.click(connectButton);

    // jsdom cannot assign window.location.href (non-configurable Location).
    // connectToSpotify sets the connecting gate before redirecting to /api/spotify/auth.
    expect(screen.getByText('Connecting to Spotify...')).toBeInTheDocument();
    expect(sessionStorage.getItem('spotify_oauth_pending')).toBe('1');
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
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/spotify/disconnect',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });
  });

  it('clears OAuth pending flag on disconnect so reconnect gate does not reopen', async () => {
    sessionStorage.setItem('spotify_oauth_pending', '1');

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            connected: true,
            device: null,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    fireEvent.click(screen.getByText('Disconnect from Spotify'));

    await waitFor(() => {
      expect(sessionStorage.getItem('spotify_oauth_pending')).toBeNull();
    });

    expect(await screen.findByText('Not Connected')).toBeInTheDocument();
    expect(screen.getByText('Connect to Spotify')).toBeInTheDocument();
    expect(screen.queryByText('Connecting to Spotify...')).not.toBeInTheDocument();
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

  it('shows checking state before status resolves', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });

    expect(screen.getByText('Checking Spotify connection...')).toBeInTheDocument();
    expect(screen.queryByText('Not Connected')).not.toBeInTheDocument();
  });
});
