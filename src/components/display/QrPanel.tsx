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
  className?: string;
  style?: CSSProperties;
}

function QrImage({ qrCodeUrl, className, style }: QrImageProps) {
  return (
    <div className="inline-flex min-h-0 max-h-full rounded-md bg-[color:var(--mood-qr-pad,#ffffff)] p-1.5">
      <img
        src={qrCodeUrl}
        alt="QR Code"
        className={`max-h-full object-contain ${className ?? ''}`}
        style={style}
      />
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
        className="mood-panel p-6 flex flex-col items-center justify-center min-h-0 min-w-0 h-full overflow-hidden"
        style={style}
      >
        {useHorizontalLayout ? (
          // Horizontal layout: QR code left, text right (centered)
          <div className="flex items-center gap-8 justify-center max-w-4xl mx-auto min-h-0 h-full max-h-full overflow-hidden">
            <QrImage
              qrCodeUrl={qrCodeUrl}
              className="max-h-full w-auto"
              style={{ width: 'min(300px, 40%)', maxHeight: '100%', aspectRatio: '1/1' }}
            />
            <div className="text-left min-w-0 overflow-hidden" style={{ width: 'min(300px, 45%)' }}>
              <p className="text-[color:var(--mood-text)] text-xl font-semibold mb-4 leading-relaxed">
                Scan the QR code to make a request, or visit:
              </p>
              <p className="text-[color:var(--mood-text)] text-lg font-bold mb-1">partyplaylist.co.uk/</p>
              <p className="text-[color:var(--mood-text)] text-lg font-bold mb-4">
                {code ? `${username}/${code}/request` : `${username}/request`}
              </p>
              {code && (
                <p className="text-[color:var(--mood-text)] text-xl font-semibold">
                  Access code{' '}
                  <span className="font-mono font-bold text-2xl">{code}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          // Vertical layout: flex-1 QR slot gets a definite height so the image can scale down
          <div className="text-center flex flex-col items-center justify-center gap-3 min-h-0 h-full w-full overflow-hidden">
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
              <QrImage
                qrCodeUrl={qrCodeUrl}
                className="w-auto h-auto max-w-xs max-h-full"
                style={{ aspectRatio: '1/1', maxHeight: '100%', width: 'auto' }}
              />
            </div>
            <p className="text-[color:var(--mood-text)] text-lg font-semibold flex-shrink-0">
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
        className="mood-panel p-3 text-center flex flex-col justify-center items-center gap-2 min-h-0 min-w-0 h-full overflow-hidden"
        style={style}
      >
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <QrImage
            qrCodeUrl={qrCodeUrl}
            className="w-auto h-auto max-w-[200px] max-h-full"
            style={{ aspectRatio: '1/1', maxHeight: '100%' }}
          />
        </div>
        <p className="text-[color:var(--mood-text)] text-sm font-semibold flex-shrink-0">
          Request your song now!
        </p>
      </div>
    );
  }

  // mobile-landscape
  return (
    <div
      className="mood-panel p-2 text-center flex flex-col justify-center items-center gap-1 min-h-0 min-w-0 h-full overflow-hidden"
      style={style}
    >
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">
        <QrImage
          qrCodeUrl={qrCodeUrl}
          className="w-auto h-auto max-w-[120px] max-h-full"
          style={{ aspectRatio: '1/1', maxHeight: '100%' }}
        />
      </div>
      <p className="text-[color:var(--mood-text)] text-xs font-semibold flex-shrink-0">Request now!</p>
    </div>
  );
}
