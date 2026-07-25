import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import StateControlPanel from '../StateControlPanel';

jest.mock('@/lib/state/global-event-client', () => ({
  useGlobalEvent: () => ({
    state: {
      status: 'offline',
      isConnected: true,
      error: null,
      pagesEnabled: { requests: false, display: false },
    },
    actions: {
      setEventStatus: jest.fn().mockResolvedValue(undefined),
      setError: jest.fn(),
    },
  }),
  EventStateMachine: {
    canTransition: () => true,
  },
}));

describe('StateControlPanel', () => {
  it('renders event control and state buttons', () => {
    render(<StateControlPanel />);
    expect(screen.getByText('Event Control')).toBeInTheDocument();
    expect(screen.getByText('Standby')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getAllByText('Offline').length).toBeGreaterThan(0);
  });
});
