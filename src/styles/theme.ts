/**
 * Stage Signal — global app chrome design tokens.
 * Landing uses Spotify skin helpers; guest/display use mood presets.
 */

export type DisplayMood = 'club' | 'venue' | 'dj';

export const stageSignal = {
  colors: {
    ink: '#0E1114',
    elevated: '#171B21',
    surface: '#1E242C',
    bone: '#F2F0EB',
    muted: '#9AA3AD',
    faint: '#6B737C',
    accent: '#F5A623',
    accentHover: '#FFB84D',
    accentMuted: 'rgba(245, 166, 35, 0.14)',
    border: 'rgba(242, 240, 235, 0.10)',
    borderStrong: 'rgba(242, 240, 235, 0.18)',
    success: '#3DDC97',
    error: '#E85D4C',
    warning: '#F5A623',
    info: '#5B9FD4',
  },
  fonts: {
    display: 'var(--font-display)',
    sans: 'var(--font-body)',
  },
} as const;

/** Spotify marketing skin for the landing page only */
export const spotifySkin = {
  bg: '#191414',
  black: '#000000',
  green: '#1DB954',
  greenHover: '#1ed760',
  text: '#FFFFFF',
  muted: '#B3B3B3',
} as const;

export interface MoodTokens {
  id: DisplayMood;
  label: string;
  description: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  border: string;
  density: 'comfortable' | 'compact';
  radius: string;
}

export const DISPLAY_MOODS: Record<DisplayMood, MoodTokens> = {
  club: {
    id: 'club',
    label: 'Club Night',
    description: 'Dark, bold, high contrast — built for parties and clubs.',
    background: '#07080A',
    surface: '#12151A',
    text: '#F7F7F5',
    textMuted: '#A8ADB5',
    accent: '#FF3D8B',
    accentHover: '#FF6BA8',
    border: 'rgba(255, 61, 139, 0.28)',
    density: 'comfortable',
    radius: '1rem',
  },
  venue: {
    id: 'venue',
    label: 'Venue',
    description: 'Cleaner and lighter — weddings, corporate, and seated events.',
    background: '#F4F1EC',
    surface: '#FFFFFF',
    text: '#1A1C1E',
    textMuted: '#5C636A',
    accent: '#2F6F5E',
    accentHover: '#3A8873',
    border: 'rgba(26, 28, 30, 0.12)',
    density: 'comfortable',
    radius: '0.75rem',
  },
  dj: {
    id: 'dj',
    label: 'DJ Tool',
    description: 'Dense and functional — maximum info for working DJs.',
    background: '#0B0D10',
    surface: '#15191F',
    text: '#E8EAED',
    textMuted: '#8B939C',
    accent: '#F5A623',
    accentHover: '#FFC15A',
    border: 'rgba(245, 166, 35, 0.22)',
    density: 'compact',
    radius: '0.375rem',
  },
};

export function isDisplayMood(value: unknown): value is DisplayMood {
  return value === 'club' || value === 'venue' || value === 'dj';
}

/** Map legacy free-form theme colors to the closest mood preset. */
export function resolveDisplayMood(
  mood: unknown,
  legacyPrimary?: string | null
): DisplayMood {
  if (isDisplayMood(mood)) return mood;
  const primary = (legacyPrimary || '').toLowerCase();
  if (!primary || primary === '#1db954' || primary === '#1ed760') return 'club';
  // Light backgrounds historically used pale secondaries — prefer venue for light primaries
  if (primary.startsWith('#f') || primary.startsWith('#e') || primary.startsWith('#d')) {
    return 'venue';
  }
  return 'club';
}

export function moodCssVariables(mood: DisplayMood): Record<string, string> {
  const tokens = DISPLAY_MOODS[mood];
  return {
    '--mood-bg': tokens.background,
    '--mood-surface': tokens.surface,
    '--mood-text': tokens.text,
    '--mood-muted': tokens.textMuted,
    '--mood-accent': tokens.accent,
    '--mood-accent-hover': tokens.accentHover,
    '--mood-border': tokens.border,
    '--mood-radius': tokens.radius,
  };
}

/** @deprecated Use stageSignal / DISPLAY_MOODS. Kept for gradual migration. */
export const theme = {
  colors: {
    background: {
      primary: stageSignal.colors.ink,
      secondary: '#000000',
      card: 'rgba(0, 0, 0, 0.3)',
      cardHover: 'rgba(0, 0, 0, 0.5)',
    },
    brand: {
      primary: stageSignal.colors.accent,
      primaryHover: stageSignal.colors.accentHover,
      primaryLight: stageSignal.colors.accentMuted,
    },
    text: {
      primary: stageSignal.colors.bone,
      secondary: stageSignal.colors.muted,
      tertiary: stageSignal.colors.faint,
      muted: stageSignal.colors.faint,
    },
    status: {
      success: stageSignal.colors.success,
      error: stageSignal.colors.error,
      warning: stageSignal.colors.warning,
      info: stageSignal.colors.info,
    },
    border: {
      primary: stageSignal.colors.border,
      secondary: stageSignal.colors.border,
      hover: stageSignal.colors.accent,
    },
  },
  gradients: {
    primary: `linear-gradient(to bottom right, ${stageSignal.colors.ink}, #0a0a0a)`,
    card: 'linear-gradient(135deg, rgba(245, 166, 35, 0.06) 0%, rgba(0, 0, 0, 0.3) 100%)',
    overlay: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9))',
  },
  glass: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.1)',
    dark: 'rgba(0, 0, 0, 0.3)',
  },
} as const;

export const themeClasses = {
  bgPrimary: 'bg-ink',
  bgSecondary: 'bg-black',
  bgCard: 'bg-elevated',
  bgCardHover: 'bg-surface',
  bgGlass: 'bg-white/10',
  brandPrimary: 'bg-accent',
  brandHover: 'bg-accent-hover',
  brandText: 'text-accent',
  brandTextHover: 'text-accent-hover',
  textPrimary: 'text-bone',
  textSecondary: 'text-muted',
} as const;
