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
        devices: [],
        user: null
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
        devices: [],
        user: null
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });
    
    expect(screen.getByText('Connect to Spotify')).toBeInTheDocument();
  });

  it('handles connect button click', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          connected: false,
          devices: [],
          user: null
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ authUrl: 'https://spotify.com/auth' })
      });

    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });
    
    const connectButton = screen.getByText('Connect to Spotify');
    fireEvent.click(connectButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/connect', { method: 'POST' });
    });
  });

  it('renders correctly when connected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: true,
        user: { display_name: 'Test User', id: '123' },
        devices: [
          {
            id: 'device1',
            name: 'Test Device',
            type: 'computer',
            volume_percent: 50,
            is_active: true
          }
        ]
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });
    
    expect(screen.getByText('Connected to Spotify')).toBeInTheDocument();
    expect(screen.getByText('Logged in as Test User')).toBeInTheDocument();
  });

  it('shows disconnect button when connected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: true,
        user: { display_name: 'Test User', id: '123' },
        devices: []
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
          user: { display_name: 'Test User', id: '123' },
          devices: []
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
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/disconnect', { method: 'POST' });
    });
  });

  it('displays devices when connected', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: true,
        user: { display_name: 'Test User', id: '123' },
        devices: [
          {
            id: 'device1',
            name: 'Test Device',
            type: 'computer',
            volume_percent: 50,
            is_active: true
          }
        ]
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });
    
    expect(screen.getByText('Select Playback Device')).toBeInTheDocument();
    expect(screen.getByText('Test Device')).toBeInTheDocument();
  });

  it('handles device selection', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          connected: true,
          user: { display_name: 'Test User', id: '123' },
          devices: [
            {
              id: 'device1',
              name: 'Test Device',
              type: 'computer',
              volume_percent: 50,
              is_active: false
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });
    
    const deviceButton = screen.getByText('Test Device');
    fireEvent.click(deviceButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/spotify/select-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'device1' })
      });
    });
  });

  it('shows no devices message when no devices available', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: true,
        user: { display_name: 'Test User', id: '123' },
        devices: []
      })
    });

    await act(async () => {
      render(<SpotifyConnectionPanel />);
    });
    
    expect(screen.getByText('No Spotify devices found')).toBeInTheDocument();
    expect(screen.getByText('Make sure Spotify is open on one of your devices')).toBeInTheDocument();
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
