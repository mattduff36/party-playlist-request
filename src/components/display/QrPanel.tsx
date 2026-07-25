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
        className="bg-white rounded-2xl p-6 flex items-center justify-center min-w-0"
        style={style}
      >
        {useHorizontalLayout ? (
          // Horizontal layout: QR code left, text right (centered)
          <div className="flex items-center gap-8 justify-center max-w-4xl mx-auto">
            <img
              src={qrCodeUrl}
              alt="QR Code"
              style={{ width: '300px', height: '300px', aspectRatio: '1/1' }}
            />
            <div className="text-left" style={{ width: '300px' }}>
              <p className="text-black text-xl font-semibold mb-4 leading-relaxed">
                Scan the QR code to make a request, or visit:
              </p>
              <p className="text-black text-lg font-bold mb-1">partyplaylist.co.uk/</p>
              <p className="text-black text-lg font-bold mb-4">{username}/request</p>
              {pin && (
                <p className="text-black text-xl font-semibold">
                  and enter PIN <span className="font-mono font-bold text-2xl">{pin}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          // Vertical layout: Centered
          <div className="text-center flex flex-col items-center">
            <img
              src={qrCodeUrl}
              alt="QR Code"
              className="w-full h-auto max-w-xs mb-3"
              style={{ aspectRatio: '1/1' }}
            />
            <p className="text-black text-lg font-semibold">Request your song now!</p>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'tablet-landscape') {
    return (
      <div
        className="bg-white rounded-xl p-3 text-center flex flex-col justify-center items-center min-w-0"
        style={style}
      >
        <img
          src={qrCodeUrl}
          alt="QR Code"
          className="w-full h-auto max-w-[200px] mb-2"
          style={{ aspectRatio: '1/1' }}
        />
        <p className="text-black text-sm font-semibold">Request your song now!</p>
      </div>
    );
  }

  // mobile-landscape
  return (
    <div
      className="bg-white rounded-lg p-2 text-center flex flex-col justify-center items-center min-w-0"
      style={style}
    >
      <img
        src={qrCodeUrl}
        alt="QR Code"
        className="w-full h-auto max-w-[120px] mb-1"
        style={{ aspectRatio: '1/1' }}
      />
      <p className="text-black text-xs font-semibold">Request now!</p>
    </div>
  );
}
