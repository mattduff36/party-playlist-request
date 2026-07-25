import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestManagementControlPanel from '../RequestManagementControlPanel';

const updateEventSettings = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/AdminDataContext', () => ({
  useAdminData: () => ({
    eventSettings: {
      auto_approve: false,
      decline_explicit: false,
    },
    loading: false,
    updateEventSettings,
  }),
}));

describe('RequestManagementControlPanel', () => {
  beforeEach(() => updateEventSettings.mockClear());

  it('renders request management toggles', () => {
    render(<RequestManagementControlPanel />);
    expect(screen.getByText('Request Management')).toBeInTheDocument();
    expect(screen.getByText('Auto-approve')).toBeInTheDocument();
    expect(screen.getByText('No Explicit')).toBeInTheDocument();
  });

  it('toggles auto-approve when clicked', async () => {
    render(<RequestManagementControlPanel />);
    fireEvent.click(screen.getByText('Auto-approve'));
    await waitFor(() =>
      expect(updateEventSettings).toHaveBeenCalledWith({ auto_approve: true })
    );
  });

  it('toggles decline explicit when clicked', async () => {
    render(<RequestManagementControlPanel />);
    fireEvent.click(screen.getByText('No Explicit'));
    await waitFor(() =>
      expect(updateEventSettings).toHaveBeenCalledWith({ decline_explicit: true })
    );
  });
});
