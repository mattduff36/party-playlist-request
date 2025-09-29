import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestForm from './RequestForm';

// Mock axios
jest.mock('axios');

const mockTrack = {
  id: '1',
  uri: 'spotify:track:1',
  name: 'Test Song',
  artists: ['Test Artist'],
  album: 'Test Album',
  duration_ms: 180000,
  explicit: false
};

const defaultProps = {
  eventConfig: {
    event_title: 'Test Event',
    welcome_message: 'Welcome to the test event!',
    secondary_message: 'Secondary message',
    tertiary_message: 'Tertiary message'
  },
  onSearch: jest.fn(),
  onSubmitRequest: jest.fn(),
  searchResults: [mockTrack],
  isSearching: false,
  isSubmitting: false,
  requestStatus: 'idle' as const,
  statusMessage: '',
  nickname: '',
  onNicknameChange: jest.fn(),
  notifications: [],
  onDismissNotifications: jest.fn()
};

describe('RequestForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with event config', () => {
    render(<RequestForm {...defaultProps} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the test event!')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<RequestForm {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    expect(searchInput).toBeInTheDocument();
  });

  it('renders nickname input', () => {
    render(<RequestForm {...defaultProps} />);
    
    const nicknameInput = screen.getByPlaceholderText('Enter your nickname');
    expect(nicknameInput).toBeInTheDocument();
  });

  it('calls onSearch when search input changes', async () => {
    const mockOnSearch = jest.fn();
    render(<RequestForm {...defaultProps} onSearch={mockOnSearch} />);
    
    const searchInput = screen.getByPlaceholderText('Search for songs, artists, or albums...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    
    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('test query');
    }, { timeout: 500 });
  });

  it('calls onNicknameChange when nickname input changes', () => {
    const mockOnNicknameChange = jest.fn();
    render(<RequestForm {...defaultProps} onNicknameChange={mockOnNicknameChange} />);
    
    const nicknameInput = screen.getByPlaceholderText('Enter your nickname');
    fireEvent.change(nicknameInput, { target: { value: 'Test User' } });
    
    expect(mockOnNicknameChange).toHaveBeenCalledWith('Test User');
  });

  it('renders search results when provided', () => {
    render(<RequestForm {...defaultProps} />);
    
    expect(screen.getByText('Search Results')).toBeInTheDocument();
    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('Test Album')).toBeInTheDocument();
  });

  it('calls onSubmitRequest when request button is clicked', () => {
    const mockOnSubmitRequest = jest.fn();
    render(<RequestForm {...defaultProps} onSubmitRequest={mockOnSubmitRequest} nickname="Test User" />);
    
    const requestButton = screen.getByText('Request');
    fireEvent.click(requestButton);
    
    expect(mockOnSubmitRequest).toHaveBeenCalledWith(mockTrack);
  });

  it('disables request button when no nickname provided', () => {
    render(<RequestForm {...defaultProps} nickname="" />);
    
    const requestButton = screen.getByText('Request');
    expect(requestButton).toBeDisabled();
  });

  it('disables request button when submitting', () => {
    render(<RequestForm {...defaultProps} isSubmitting={true} nickname="Test User" />);
    
    const requestButton = screen.getByText('Submitting...');
    expect(requestButton).toBeDisabled();
  });

  it('renders loading spinner when searching', () => {
    render(<RequestForm {...defaultProps} isSearching={true} />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders status message when provided', () => {
    render(<RequestForm {...defaultProps} statusMessage="Request submitted!" requestStatus="success" />);
    
    expect(screen.getByText('Request submitted!')).toBeInTheDocument();
  });

  it('renders notifications when provided', () => {
    const notifications = [
      {
        id: '1',
        type: 'approved' as const,
        trackName: 'Test Song',
        artistName: 'Test Artist',
        timestamp: Date.now()
      }
    ];
    
    render(<RequestForm {...defaultProps} notifications={notifications} />);
    
    expect(screen.getByText('✅ Request Approved!')).toBeInTheDocument();
    expect(screen.getByText('Test Song by Test Artist')).toBeInTheDocument();
  });

  it('calls onDismissNotifications when notification is clicked', () => {
    const mockOnDismissNotifications = jest.fn();
    const notifications = [
      {
        id: '1',
        type: 'approved' as const,
        trackName: 'Test Song',
        artistName: 'Test Artist',
        timestamp: Date.now()
      }
    ];
    
    render(<RequestForm {...defaultProps} notifications={notifications} onDismissNotifications={mockOnDismissNotifications} />);
    
    const notification = screen.getByText('✅ Request Approved!');
    fireEvent.click(notification);
    
    expect(mockOnDismissNotifications).toHaveBeenCalled();
  });

  it('applies correct responsive classes', () => {
    const { container } = render(<RequestForm {...defaultProps} />);
    
    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-2xl', 'sm:text-3xl', 'md:text-4xl', 'lg:text-5xl', 'xl:text-6xl', '2xl:text-7xl');
  });

  it('formats duration correctly', () => {
    render(<RequestForm {...defaultProps} />);
    
    expect(screen.getByText('3:00')).toBeInTheDocument(); // 180000ms = 3:00
  });

  it('renders play next notification correctly', () => {
    const notifications = [
      {
        id: '1',
        type: 'play_next' as const,
        trackName: 'Next Song',
        artistName: 'Next Artist',
        timestamp: Date.now()
      }
    ];
    
    render(<RequestForm {...defaultProps} notifications={notifications} />);
    
    expect(screen.getByText('🎵 Playing Next!')).toBeInTheDocument();
    expect(screen.getByText('Next Song by Next Artist')).toBeInTheDocument();
  });
});
