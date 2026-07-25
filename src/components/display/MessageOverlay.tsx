'use client';

import type { CSSProperties } from 'react';
import { getMessageFontSize } from './getMessageFontSize';
import type { DisplayMessage, MessageOverlayVariant } from './types';

interface MessageOverlayProps {
  variant: MessageOverlayVariant;
  currentMessage: DisplayMessage | null;
  isMessageVisible: boolean;
  showMessageText: boolean;
  style?: CSSProperties;
}

export default function MessageOverlay({
  variant,
  currentMessage,
  isMessageVisible,
  showMessageText,
  style,
}: MessageOverlayProps) {
  const firstLineScale = variant === 'mobile' ? '2em' : '1.5em';
  const panelClassName =
    variant === 'tv'
      ? 'bg-black/30 backdrop-blur-sm rounded-2xl p-6 h-full flex flex-col'
      : variant === 'tablet'
        ? 'bg-black/30 backdrop-blur-sm rounded-xl p-4 h-full flex flex-col'
        : 'bg-black/30 backdrop-blur-sm rounded-lg p-2 h-full flex flex-col';
  const minWidth = variant === 'tv' ? '200px' : variant === 'tablet' ? '150px' : '100px';
  const textPadding = variant === 'tv' ? 'px-4' : variant === 'tablet' ? 'px-3' : 'px-2';

  return (
    <div
      className="min-w-0"
      style={{
        ...style,
        width: isMessageVisible ? 'auto' : '0',
        minWidth: isMessageVisible ? 'auto' : '0',
        overflow: 'hidden',
        padding: isMessageVisible ? '0' : '0',
        margin: isMessageVisible ? '0' : '0',
        opacity: isMessageVisible ? 1 : 0,
        transition: 'width 1s ease-in-out, min-width 1s ease-in-out, opacity 1s ease-in-out',
      }}
    >
      <div className={panelClassName} style={{ minWidth }}>
        <div className="flex-1 flex items-center justify-center">
          {currentMessage && (
            <div
              className={`text-center ${textPadding} overflow-hidden transition-opacity duration-300 ${
                showMessageText ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div
                className="text-white font-medium leading-tight"
                style={{
                  fontSize: getMessageFontSize(currentMessage.text, variant),
                  lineHeight: '1.3',
                  wordBreak: 'normal',
                  overflowWrap: 'normal',
                  whiteSpace: 'pre-line',
                }}
              >
                {currentMessage.text.split('\n').map((line, index) => (
                  <div key={index} style={{ fontSize: index === 0 ? firstLineScale : '1em' }}>
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
