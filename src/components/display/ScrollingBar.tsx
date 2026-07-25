'use client';

import type { ScrollingBarVariant } from './types';

interface ScrollingBarProps {
  variant: ScrollingBarVariant;
  displayContent: string;
  dynamicDuration: number;
  messageTextColor?: string;
  visible?: boolean;
}

export default function ScrollingBar({
  variant,
  displayContent,
  dynamicDuration,
  messageTextColor = 'text-white',
  visible = true,
}: ScrollingBarProps) {
  if (!visible) {
    return null;
  }

  if (variant === 'tv') {
    return (
      <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-3 overflow-hidden flex-shrink-0 h-16 mt-4">
        <div className="flex items-center h-full">
          <div className="text-xl mr-3">📢</div>
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
      <div className="bg-black/50 backdrop-blur-sm rounded-xl p-2 overflow-hidden flex-shrink-0 h-12 mt-3">
        <div className="flex items-center h-full">
          <div className="text-base mr-2">📢</div>
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
      <div className="bg-black/50 backdrop-blur-sm rounded-xl p-3 overflow-hidden flex-shrink-0 h-14 mt-4">
        <div className="flex items-center h-full">
          <div className="text-lg mr-3">📢</div>
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
      <div className="bg-black/30 backdrop-blur-sm rounded-lg p-1 overflow-hidden flex-shrink-0 h-8 mt-2">
        <div className="flex items-center h-full">
          <div className="text-xs mr-1">📢</div>
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
    <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 overflow-hidden flex-shrink-0 h-12 mt-3">
      <div className="flex items-center h-full">
        <div className="text-sm mr-2">📢</div>
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
