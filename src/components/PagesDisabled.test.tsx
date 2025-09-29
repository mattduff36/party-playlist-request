import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import PagesDisabled from './PagesDisabled';

describe('PagesDisabled Component', () => {
  const defaultEventConfig = {
    event_title: 'Test Event',
    welcome_message: 'Welcome to the test event!',
    secondary_message: 'Secondary message',
    tertiary_message: 'Tertiary message'
  };

  it('renders requests disabled variant correctly', () => {
    render(<PagesDisabled variant="requests" eventConfig={defaultEventConfig} />);
    
    expect(screen.getByText('Requests Disabled')).toBeInTheDocument();
    expect(screen.getByText('The DJ has temporarily disabled song requests. Check back later!')).toBeInTheDocument();
  });

  it('renders display disabled variant correctly', () => {
    render(<PagesDisabled variant="display" eventConfig={defaultEventConfig} />);
    
    expect(screen.getByText('Display Disabled')).toBeInTheDocument();
    expect(screen.getByText('The DJ has temporarily disabled the display. Check back later!')).toBeInTheDocument();
  });

  it('renders pause icon', () => {
    const { container } = render(<PagesDisabled variant="requests" />);
    
    const pauseIcon = container.querySelector('.text-yellow-400');
    expect(pauseIcon).toBeInTheDocument();
    expect(pauseIcon).toHaveTextContent('⏸️');
  });

  it('renders event config when provided', () => {
    render(<PagesDisabled variant="requests" eventConfig={defaultEventConfig} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the test event!')).toBeInTheDocument();
    expect(screen.getByText('Secondary message')).toBeInTheDocument();
    expect(screen.getByText('Tertiary message')).toBeInTheDocument();
  });

  it('handles missing eventConfig gracefully', () => {
    render(<PagesDisabled variant="requests" eventConfig={undefined} />);
    
    expect(screen.getByText('Requests Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Test Event')).not.toBeInTheDocument();
  });

  it('applies correct responsive classes', () => {
    const { container } = render(<PagesDisabled variant="requests" />);
    
    // Check for responsive text sizing
    const title = container.querySelector('h1');
    expect(title).toHaveClass('text-xl', 'sm:text-2xl', 'md:text-3xl', 'lg:text-4xl', 'xl:text-5xl', '2xl:text-6xl');
    
    const message = container.querySelector('p');
    expect(message).toHaveClass('text-base', 'sm:text-lg', 'md:text-xl', 'lg:text-2xl', 'xl:text-3xl');
  });

  it('applies correct background gradient', () => {
    const { container } = render(<PagesDisabled variant="requests" />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('bg-gradient-to-br', 'from-purple-900', 'via-blue-900', 'to-indigo-900');
  });

  it('renders with proper spacing and layout', () => {
    const { container } = render(<PagesDisabled variant="requests" />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
  });

  it('handles partial eventConfig', () => {
    const partialConfig = {
      event_title: 'Partial Event',
      welcome_message: 'Welcome!'
    };
    
    render(<PagesDisabled variant="requests" eventConfig={partialConfig} />);
    
    expect(screen.getByText('Partial Event')).toBeInTheDocument();
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
    expect(screen.queryByText('Secondary message')).not.toBeInTheDocument();
  });
});
