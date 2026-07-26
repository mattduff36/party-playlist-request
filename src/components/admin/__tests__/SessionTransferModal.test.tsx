import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionTransferModal from '../SessionTransferModal';

describe('SessionTransferModal', () => {
  it('uses previous-session copy by default (not another device)', () => {
    render(
      <SessionTransferModal
        isOpen
        onTransfer={async () => undefined}
        onCancel={() => undefined}
        sessionInfo={{
          sessionId: 'sess-1',
          created_at: new Date().toISOString(),
          likelyDifferentClient: false,
        }}
      />
    );

    expect(screen.getByText('Active Session Detected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'An existing admin session is still registered for this account'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/already logged in on another device/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText('Yes, Transfer')).toBeInTheDocument();
    expect(screen.getByText('No, Stay on Previous Session')).toBeInTheDocument();
  });

  it('uses another-device copy only when likelyDifferentClient is true', () => {
    render(
      <SessionTransferModal
        isOpen
        onTransfer={async () => undefined}
        onCancel={() => undefined}
        sessionInfo={{
          sessionId: 'sess-1',
          created_at: new Date().toISOString(),
          likelyDifferentClient: true,
        }}
      />
    );

    expect(
      screen.getByText(
        "You're already signed in on another device or browser"
      )
    ).toBeInTheDocument();
  });
});
