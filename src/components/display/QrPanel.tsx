'use client';

import type { CSSProperties } from 'react';
import type { QrVariant } from './types';

interface QrPanelProps {
  variant: QrVariant;
  qrCodeUrl: string;
  username: string;
  pin?: string | null;
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
    <div className="inline-flex shrink-0 rounded-md bg-[color:var(--mood-qr-pad,#ffffff)] p-1.5">
      <img
        src={qrCodeUrl}
        alt="QR Code"
        className={className}
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
  useHorizontalLayout = false,
  style,
}: QrPanelProps) {
  if (variant === 'tv') {
    return (
      <div
        className="mood-panel p-6 flex items-center justify-center min-w-0"
        style={style}
      >
        {useHorizontalLayout ? (
          // Horizontal layout: QR code left, text right (centered)
          <div className="flex items-center gap-8 justify-center max-w-4xl mx-auto">
            <QrImage
              qrCodeUrl={qrCodeUrl}
              style={{ width: '300px', height: '300px', aspectRatio: '1/1' }}
            />
            <div className="text-left" style={{ width: '300px' }}>
              <p className="text-[color:var(--mood-text)] text-xl font-semibold mb-4 leading-relaxed">
                Scan the QR code to make a request, or visit:
              </p>
              <p className="text-[color:var(--mood-text)] text-lg font-bold mb-1">partyplaylist.co.uk/</p>
              <p className="text-[color:var(--mood-text)] text-lg font-bold mb-4">{username}/request</p>
              {pin && (
                <p className="text-[color:var(--mood-text)] text-xl font-semibold">
                  and enter PIN <span className="font-mono font-bold text-2xl">{pin}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          // Vertical layout: Centered
          <div className="text-center flex flex-col items-center gap-3">
            <QrImage
              qrCodeUrl={qrCodeUrl}
              className="w-full h-auto max-w-xs"
              style={{ aspectRatio: '1/1' }}
            />
            <p className="text-[color:var(--mood-text)] text-lg font-semibold">Request your song now!</p>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-landscape') {
    return (
      <div
        className="mood-panel p-3 text-center flex flex-col justify-center items-center gap-2 min-w-0"
        style={style}
      >
        <QrImage
          qrCodeUrl={qrCodeUrl}
          className="w-full h-auto max-w-[200px]"
          style={{ aspectRatio: '1/1' }}
        />
        <p className="text-[color:var(--mood-text)] text-sm font-semibold">Request your song now!</p>
      </div>
    );
  }

  // mobile-landscape
  return (
    <div
      className="mood-panel p-2 text-center flex flex-col justify-center items-center gap-1 min-w-0"
      style={style}
    >
      <QrImage
        qrCodeUrl={qrCodeUrl}
        className="w-full h-auto max-w-[120px]"
        style={{ aspectRatio: '1/1' }}
      />
      <p className="text-[color:var(--mood-text)] text-xs font-semibold">Request now!</p>
    </div>
  );
}
