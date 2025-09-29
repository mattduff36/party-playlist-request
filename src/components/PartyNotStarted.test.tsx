import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PartyNotStarted from './PartyNotStarted';

// Mock the global event context
jest.mock('@/lib/state/global-event', () => ({
  useGlobalEvent: () => ({
    state: { status: 'offline' },
    actions: { loadEvent: jest.fn() }
  }),
  usePageState: () => ({ requests: 'party-not-started', display: 'party-not-started' }),
  useEventConfig: () => ({
    event_title: 'Test Event',
    welcome_message: 'Welcome to the test event!',
    secondary_message: 'Secondary message',
    tertiary_message: 'Tertiary message'
  }),
  useIsLoading: () => false,
  useError: () => null
}));

describe('PartyNotStarted Component', () => {
  const defaultProps = {
    variant: 'home' as const,
    eventConfig: {
      event_title: 'Test Party',
      welcome_message: 'Welcome to the test party!',
      secondary_message: 'Secondary message',
      tertiary_message: 'Tertiary message'
    }
  };

  it('renders with default content when no eventConfig provided', () => {
    render(<PartyNotStarted variant="home" />);
    
    expect(screen.getByText('PartyPlaylist.co.uk')).toBeInTheDocument();
    expect(screen.getByText('Be your own DJ!')).toBeInTheDocument();
    expect(screen.getByText('Requests are not active at the moment.')).toBeInTheDocument();
  });

  it('renders with custom eventConfig when provided', () => {
    render(<PartyNotStarted {...defaultProps} />);
    
    expect(screen.getByText('Test Party')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the test party!')).toBeInTheDocument();
  });

  it('renders admin link for beta testing', () => {
    render(<PartyNotStarted variant="home" />);
    
    const adminLink = screen.getByTitle('Admin Access');
    expect(adminLink).toBeInTheDocument();
    expect(adminLink).toHaveAttribute('href', '/admin');
  });

  it('applies correct responsive classes', () => {
    const { container } = render(<PartyNotStarted variant="home" />);
    
    // Check for responsive text sizing
    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-3xl', 'sm:text-4xl', 'md:text-5xl', 'lg:text-6xl', 'xl:text-7xl', '2xl:text-8xl');
    
    const subtitle = container.querySelector('h2');
    expect(subtitle).toHaveClass('text-xl', 'sm:text-2xl', 'md:text-3xl', 'lg:text-4xl', 'xl:text-5xl', '2xl:text-6xl');
  });

  it('renders different content for display variant', () => {
    render(<PartyNotStarted variant="display" eventConfig={defaultProps.eventConfig} />);
    
    expect(screen.getByText('Test Party')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the test party!')).toBeInTheDocument();
  });

  it('handles missing eventConfig gracefully', () => {
    render(<PartyNotStarted variant="home" eventConfig={undefined} />);
    
    expect(screen.getByText('PartyPlaylist.co.uk')).toBeInTheDocument();
    expect(screen.getByText('Requests are not active at the moment.')).toBeInTheDocument();
  });

  it('renders music note icon', () => {
    const { container } = render(<PartyNotStarted variant="home" />);
    
    const musicIcon = container.querySelector('.text-6xl');
    expect(musicIcon).toBeInTheDocument();
    expect(musicIcon).toHaveTextContent('🎵');
  });

  it('applies correct background gradient', () => {
    const { container } = render(<PartyNotStarted variant="home" />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('bg-gradient-to-br', 'from-purple-900', 'via-blue-900', 'to-indigo-900');
  });
});
