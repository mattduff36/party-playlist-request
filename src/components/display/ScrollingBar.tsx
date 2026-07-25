'use client';

import { Megaphone } from 'lucide-react';
import type { ScrollingBarVariant } from './types';

interface ScrollingBarProps {
  variant: ScrollingBarVariant;
  displayContent: string;
  dynamicDuration: number;
  messageTextColor?: string;
  visible?: boolean;
}

interface ScrollingBarIconProps {
  className: string;
}

function ScrollingBarIcon({ className }: ScrollingBarIconProps) {
  return (
    <Megaphone
      className={`${className} mood-accent-text shrink-0`}
      aria-hidden="true"
    />
  );
}

export default function ScrollingBar({
  variant,
  displayContent,
  dynamicDuration,
  messageTextColor = 'text-[color:var(--mood-text)]',
  visible = true,
}: ScrollingBarProps) {
  if (!visible) {
    return null;
  }

  if (variant === 'tv') {
    return (
      <div className="mood-panel p-3 overflow-hidden flex-shrink-0 h-16 mt-4">
        <div className="flex items-center h-full">
          <ScrollingBarIcon className="w-5 h-5 mr-3" />
          <div className="flex-1 overflow-hidden">
            {displayContent && (
              <div
                className={`whitespace-nowrap text-lg font-medium ${messageTextColor}`}
                style={{
                  animation: `marquee ${dynamicDuration}s linear infinite`,
                }}
              >
                {displayContent}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'tablet-landscape') {
    return (
      <div className="mood-panel p-2 overflow-hidden flex-shrink-0 h-12 mt-3">
        <div className="flex items-center h-full">
          <ScrollingBarIcon className="w-4 h-4 mr-2" />
          <div className="flex-1 overflow-hidden">
            {displayContent && (
              <div
                className={`whitespace-nowrap text-sm font-medium ${messageTextColor}`}
                style={{
                  animation: `marquee ${dynamicDuration}s linear infinite`,
                }}
              >
                {displayContent}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'tablet-portrait') {
    return (
      <div className="mood-panel p-3 overflow-hidden flex-shrink-0 h-14 mt-4">
        <div className="flex items-center h-full">
          <ScrollingBarIcon className="w-5 h-5 mr-3" />
          <div className="flex-1 overflow-hidden">
            {displayContent && (
              <div
                className={`whitespace-nowrap text-base font-medium ${messageTextColor}`}
                style={{
                  animation: `marquee ${dynamicDuration}s linear infinite`,
                }}
              >
                {displayContent}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'mobile-landscape') {
    return (
      <div className="mood-panel p-1 overflow-hidden flex-shrink-0 h-8 mt-2">
        <div className="flex items-center h-full">
          <ScrollingBarIcon className="w-3 h-3 mr-1" />
          <div className="flex-1 overflow-hidden">
            {displayContent && (
              <div className={`animate-marquee whitespace-nowrap text-xs font-medium ${messageTextColor}`}>
                {displayContent}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // mobile-portrait
  return (
    <div className="mood-panel p-2 overflow-hidden flex-shrink-0 h-12 mt-3">
      <div className="flex items-center h-full">
        <ScrollingBarIcon className="w-4 h-4 mr-2" />
        <div className="flex-1 overflow-hidden">
          {displayContent && (
            <div className={`animate-marquee whitespace-nowrap text-xs font-medium ${messageTextColor}`}>
              {displayContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
