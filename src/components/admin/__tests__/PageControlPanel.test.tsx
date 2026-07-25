import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PageControlPanel from '../PageControlPanel';

const setPageEnabled = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/state/global-event-client', () => ({
  useGlobalEvent: () => ({
    state: {
      status: 'live',
      error: null,
      pagesEnabled: { requests: false, display: false },
    },
    actions: { setPageEnabled },
  }),
}));

describe('PageControlPanel', () => {
  beforeEach(() => setPageEnabled.mockClear());

  it('renders page controls', () => {
    render(<PageControlPanel />);
    expect(screen.getByText('Page Controls')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Display')).toBeInTheDocument();
  });

  it('toggles a page when clicked', async () => {
    render(<PageControlPanel />);
    fireEvent.click(screen.getByText('Requests'));
    await waitFor(() => expect(setPageEnabled).toHaveBeenCalledWith('requests', true));
  });
});
