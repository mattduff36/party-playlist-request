'use client';

import { CSSProperties, ReactNode } from 'react';
import {
  DisplayMood,
  moodCssVariables,
  resolveDisplayMood,
} from '@/styles/theme';

interface MoodShellProps {
  children: ReactNode;
  mood?: unknown;
  legacyPrimaryColor?: string | null;
  className?: string;
  densityClassName?: string;
}

export default function MoodShell({
  children,
  mood,
  legacyPrimaryColor,
  className = '',
  densityClassName,
}: MoodShellProps) {
  const resolved: DisplayMood = resolveDisplayMood(mood, legacyPrimaryColor);
  const vars = moodCssVariables(resolved) as CSSProperties;
  const density =
    densityClassName ??
    (resolved === 'dj' ? 'mood-density-compact text-[13px] leading-snug' : 'mood-density-comfy');

  return (
    <div
      className={`mood-shell relative ${density} ${className}`}
      style={vars}
      data-mood={resolved}
    >
      {children}
    </div>
  );
}

export function useResolvedMood(
  mood: unknown,
  legacyPrimaryColor?: string | null
): DisplayMood {
  return resolveDisplayMood(mood, legacyPrimaryColor);
}
