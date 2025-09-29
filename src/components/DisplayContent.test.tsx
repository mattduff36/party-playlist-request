import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DisplayContent from './DisplayContent';

const mockRequest = {
  id: '1',
  track_name: 'Test Song',
  artist_name: 'Test Artist',
  album_name: 'Test Album',
  duration_ms: 180000,
  requester_nickname: 'Test User',
  status: 'pending' as const,
  created_at: '2024-01-01T00:00:00Z'
};

const mockNowPlaying = {
  track_name: 'Now Playing Song',
  artist_name: 'Now Playing Artist',
  album_name: 'Now Playing Album',
  duration_ms: 240000,
  progress_ms: 120000,
  is_playing: true
};

const defaultProps = {
  eventConfig: {
    event_title: 'Test Event',
    welcome_message: 'Welcome to the test event!',
    secondary_message: 'Secondary message',
    tertiary_message: 'Tertiary message'
  },
  requests: [mockRequest],
  nowPlaying: mockNowPlaying,
  lastUpdate: new Date('2024-01-01T12:00:00Z')
};

describe('DisplayContent Component', () => {
  it('renders with event config', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the test event!')).toBeInTheDocument();
  });

  it('renders now playing section when provided', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText('Now Playing')).toBeInTheDocument();
    expect(screen.getByText('Now Playing Song')).toBeInTheDocument();
    expect(screen.getByText('Now Playing Artist')).toBeInTheDocument();
    expect(screen.getByText('Now Playing Album')).toBeInTheDocument();
  });

  it('renders progress bar for now playing', () => {
    const { container } = render(<DisplayContent {...defaultProps} />);
    
    const progressBar = container.querySelector('.bg-blue-500');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle('width: 50%'); // 120000 / 240000 = 50%
  });

  it('shows playing status correctly', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText('Playing')).toBeInTheDocument();
  });

  it('shows paused status correctly', () => {
    const pausedNowPlaying = { ...mockNowPlaying, is_playing: false };
    render(<DisplayContent {...defaultProps} nowPlaying={pausedNowPlaying} />);
    
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('renders request queue', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText('Request Queue')).toBeInTheDocument();
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('Test Album')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders empty state when no requests', () => {
    render(<DisplayContent {...defaultProps} requests={[]} />);
    
    expect(screen.getByText('No requests yet. Be the first to request a song!')).toBeInTheDocument();
  });

  it('renders request status correctly', () => {
    const approvedRequest = { ...mockRequest, status: 'approved' as const };
    render(<DisplayContent {...defaultProps} requests={[approvedRequest]} />);
    
    expect(screen.getByText('✅ Approved')).toBeInTheDocument();
  });

  it('renders rejected request status', () => {
    const rejectedRequest = { ...mockRequest, status: 'rejected' as const };
    render(<DisplayContent {...defaultProps} requests={[rejectedRequest]} />);
    
    expect(screen.getByText('❌ Rejected')).toBeInTheDocument();
  });

  it('renders played request status', () => {
    const playedRequest = { ...mockRequest, status: 'played' as const };
    render(<DisplayContent {...defaultProps} requests={[playedRequest]} />);
    
    expect(screen.getByText('🎵 Played')).toBeInTheDocument();
  });

  it('renders pending request status', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText('⏳ Pending')).toBeInTheDocument();
  });

  it('renders last update time', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('does not render last update when not provided', () => {
    render(<DisplayContent {...defaultProps} lastUpdate={null} />);
    
    expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
  });

  it('does not render now playing section when not provided', () => {
    render(<DisplayContent {...defaultProps} nowPlaying={null} />);
    
    expect(screen.queryByText('Now Playing')).not.toBeInTheDocument();
  });

  it('formats duration correctly', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText('3:00')).toBeInTheDocument(); // 180000ms = 3:00
    expect(screen.getByText('4:00')).toBeInTheDocument(); // 240000ms = 4:00
  });

  it('formats progress correctly', () => {
    render(<DisplayContent {...defaultProps} />);
    
    expect(screen.getByText('2:00')).toBeInTheDocument(); // 120000ms = 2:00
  });

  it('applies correct responsive classes', () => {
    const { container } = render(<DisplayContent {...defaultProps} />);
    
    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-2xl', 'sm:text-3xl', 'md:text-4xl', 'lg:text-5xl', 'xl:text-6xl', '2xl:text-7xl');
  });

  it('renders request numbers correctly', () => {
    const multipleRequests = [
      mockRequest,
      { ...mockRequest, id: '2', track_name: 'Second Song' },
      { ...mockRequest, id: '3', track_name: 'Third Song' }
    ];
    
    render(<DisplayContent {...defaultProps} requests={multipleRequests} />);
    
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('handles missing eventConfig gracefully', () => {
    render(<DisplayContent {...defaultProps} eventConfig={undefined} />);
    
    expect(screen.getByText('Party DJ Requests')).toBeInTheDocument();
    expect(screen.getByText('Request your favorite songs and let\'s keep the party going!')).toBeInTheDocument();
  });
});
