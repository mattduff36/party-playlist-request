'use client';

import type { CSSProperties } from 'react';
import type { QrVariant } from './types';

interface QrPanelProps {
  variant: QrVariant;
  qrCodeUrl: string;
  username: string;
  /** Access code shown for manual URL entry (QR already embeds the code) */
  pin?: string | null;
  accessCode?: string | null;
  useHorizontalLayout?: boolean;
  style?: CSSProperties;
}

interface QrImageProps {
  qrCodeUrl: string;
}

/**
 * Renders the largest square QR that fits the parent box.
 * Parent must provide a definite size (e.g. h-full + min-h-0 in a flex/grid slot).
 * Uses container query units so the square is limited by both width and height.
 */
function QrImage({ qrCodeUrl }: QrImageProps) {
  return (
    <div
      className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
      style={{ containerType: 'size' }}
    >
      <div
        className="box-border max-h-full max-w-full rounded-md bg-[color:var(--mood-qr-pad,#ffffff)] p-1.5"
        style={{
          width: 'min(100cqw, 100cqh)',
          aspectRatio: '1 / 1',
        }}
      >
        <img
          src={qrCodeUrl}
          alt="QR Code"
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  );
}

export default function QrPanel({
  variant,
  qrCodeUrl,
  username,
  pin,
  accessCode,
  useHorizontalLayout = false,
  style,
}: QrPanelProps) {
  const code = accessCode || pin;
  if (variant === 'tv') {
    return (
      <div
        className="mood-panel flex h-full min-h-0 min-w-0 flex-col items-stretch justify-center overflow-hidden p-6"
        style={style}
      >
        {useHorizontalLayout ? (
          // Horizontal: QR grows in left column; URL/access code stay readable on the right
          <div className="flex h-full min-h-0 w-full items-stretch gap-6 overflow-hidden lg:gap-8">
            <div className="min-h-0 min-w-0 flex-1">
              <QrImage qrCodeUrl={qrCodeUrl} />
            </div>
            <div className="flex w-[min(22rem,42%)] max-w-[50%] flex-shrink-0 flex-col justify-center overflow-hidden text-left">
              <p className="mb-4 text-xl font-semibold leading-relaxed text-[color:var(--mood-text)]">
                Scan the QR code to make a request, or visit:
              </p>
              <p className="mb-1 text-lg font-bold text-[color:var(--mood-text)]">
                partyplaylist.co.uk/
              </p>
              <p className="mb-4 break-all text-lg font-bold text-[color:var(--mood-text)]">
                {code ? `${username}/${code}/request` : `${username}/request`}
              </p>
              {code && (
                <p className="text-xl font-semibold text-[color:var(--mood-text)]">
                  Access code{' '}
                  <span className="font-mono text-2xl font-bold">{code}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          // Vertical: flex-1 QR slot fills leftover height above the caption
          <div className="flex h-full min-h-0 w-full flex-col items-stretch justify-center gap-3 overflow-hidden text-center">
            <div className="min-h-0 w-full flex-1">
              <QrImage qrCodeUrl={qrCodeUrl} />
            </div>
            <p className="flex-shrink-0 text-lg font-semibold text-[color:var(--mood-text)]">
              Request your song now!
            </p>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-landscape') {
    return (
      <div
        className="mood-panel flex h-full min-h-0 min-w-0 flex-col items-stretch justify-center gap-2 overflow-hidden p-3 text-center"
        style={style}
      >
        <div className="min-h-0 w-full flex-1">
          <QrImage qrCodeUrl={qrCodeUrl} />
        </div>
        <p className="flex-shrink-0 text-sm font-semibold text-[color:var(--mood-text)]">
          Request your song now!
        </p>
      </div>
    );
  }

  // mobile-landscape
  return (
    <div
      className="mood-panel flex h-full min-h-0 min-w-0 flex-col items-stretch justify-center gap-1 overflow-hidden p-2 text-center"
      style={style}
    >
      <div className="min-h-0 w-full flex-1">
        <QrImage qrCodeUrl={qrCodeUrl} />
      </div>
      <p className="flex-shrink-0 text-xs font-semibold text-[color:var(--mood-text)]">
        Request now!
      </p>
    </div>
  );
}
