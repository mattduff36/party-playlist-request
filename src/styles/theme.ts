/**
 * Stage Signal — global app chrome design tokens.
 * Landing uses Spotify skin helpers; guest/display use mood presets.
 */

export type DisplayMood = 'club' | 'venue' | 'dj' | 'neon' | 'amber' | 'dayrose';

/** Default mood for guest request + TV display (DJ Tool). */
export const DEFAULT_DISPLAY_MOOD: DisplayMood = 'dj';

export const DISPLAY_MOOD_IDS: DisplayMood[] = [
  'club',
  'venue',
  'dj',
  'neon',
  'amber',
  'dayrose',
];

export const stageSignal = {
  colors: {
    ink: '#0E1114',
    elevated: '#171B21',
    surface: '#1E242C',
    bone: '#F2F0EB',
    muted: '#9AA3AD',
    faint: '#6B737C',
    accent: '#1DB954',
    accentHover: '#1ed760',
    accentMuted: 'rgba(29, 185, 84, 0.14)',
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
    description: 'Dark, bold, high contrast - built for parties and clubs.',
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
    description: 'Cleaner and lighter - weddings, corporate, and seated events.',
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
    description: 'Dense and functional - maximum info for working DJs.',
    background: '#0B0D10',
    surface: '#15191F',
    text: '#E8EAED',
    textMuted: '#8B939C',
    accent: '#1DB954',
    accentHover: '#1ed760',
    border: 'rgba(29, 185, 84, 0.22)',
    density: 'compact',
    radius: '0.375rem',
  },
  neon: {
    id: 'neon',
    label: 'Neon Pulse',
    description: 'Electric cyan on deep indigo - late-night energy.',
    background: '#06080F',
    surface: '#101628',
    text: '#EAF2FF',
    textMuted: '#8FA3C4',
    accent: '#22D3EE',
    accentHover: '#67E8F9',
    border: 'rgba(34, 211, 238, 0.35)',
    density: 'comfortable',
    radius: '0.5rem',
  },
  amber: {
    id: 'amber',
    label: 'Amber Lounge',
    description: 'Warm copper and espresso - cocktail bars and late sets.',
    background: '#120C08',
    surface: '#1E1510',
    text: '#F7EDE3',
    textMuted: '#B9A090',
    accent: '#E8A04B',
    accentHover: '#F0B86A',
    border: 'rgba(232, 160, 75, 0.32)',
    density: 'comfortable',
    radius: '1.25rem',
  },
  dayrose: {
    id: 'dayrose',
    label: 'Day Rose',
    description: 'Warm daylight with soft rose accents - brunch, garden parties, and daytime events.',
    background: '#F2E4D6',
    surface: '#FAF3EB',
    text: '#1A1416',
    textMuted: '#6A5C61',
    accent: '#C45C7A',
    accentHover: '#D47890',
    border: 'rgba(168, 96, 110, 0.28)',
    density: 'comfortable',
    radius: '1rem',
  },
};

export function isDisplayMood(value: unknown): value is DisplayMood {
  return (
    typeof value === 'string' &&
    (DISPLAY_MOOD_IDS as string[]).includes(value)
  );
}

/**
 * True when a settings payload includes `display_mood` from the server.
 * `null` counts as confirmed (resolve to DEFAULT_DISPLAY_MOOD); missing key does not.
 */
export function hasConfirmedDisplayMood(settings: unknown): boolean {
  return (
    !!settings &&
    typeof settings === 'object' &&
    'display_mood' in (settings as Record<string, unknown>)
  );
}

/**
 * Last-resort settings when mood confirmation APIs fail or time out.
 * Prefer waiting for a server-confirmed `display_mood`; only use after failure.
 */
export function fallbackDisplayMoodSettings(): { display_mood: DisplayMood } {
  return { display_mood: DEFAULT_DISPLAY_MOOD };
}

/** Map legacy free-form theme colors / removed moods to the closest mood preset. */
export function resolveDisplayMood(
  mood: unknown,
  legacyPrimary?: string | null
): DisplayMood {
  if (isDisplayMood(mood)) return mood;
  // Frost Stage removed (too similar to Neon Pulse) — keep displays working
  if (mood === 'frost') return 'dayrose';
  const primary = (legacyPrimary || '').toLowerCase();
  if (!primary || primary === '#1db954' || primary === '#1ed760') {
    return DEFAULT_DISPLAY_MOOD;
  }
  // Light backgrounds historically used pale secondaries — prefer venue for light primaries
  if (primary.startsWith('#f') || primary.startsWith('#e') || primary.startsWith('#d')) {
    return 'venue';
  }
  return DEFAULT_DISPLAY_MOOD;
}

/**
 * QR module colors from mood tokens.
 * `dark` paints data modules; `light` paints the pad / quiet zone.
 * Pad uses `surface` so the QR matches the QR section (`mood-panel`), not the page `background`.
 * Dark moods use brighter accent modules on a dark pad (inverted QR).
 * Light moods use darker accent modules on a light pad (standard QR).
 * The qrcode package accepts either polarity when contrast is usable.
 */
export function qrModuleColors(mood: DisplayMood): { dark: string; light: string } {
  const tokens = DISPLAY_MOODS[mood];
  // Day Rose accent-on-surface is borderline for cameras (~3.3:1);
  // deepen modules slightly while staying rose-toned (~4.8:1).
  const modules = mood === 'dayrose' ? '#A04560' : tokens.accent;
  return { dark: modules, light: tokens.surface };
}

export function moodCssVariables(mood: DisplayMood): Record<string, string> {
  const tokens = DISPLAY_MOODS[mood];
  const qr = qrModuleColors(mood);
  return {
    '--mood-bg': tokens.background,
    '--mood-surface': tokens.surface,
    '--mood-text': tokens.text,
    '--mood-muted': tokens.textMuted,
    '--mood-accent': tokens.accent,
    '--mood-accent-hover': tokens.accentHover,
    '--mood-border': tokens.border,
    '--mood-radius': tokens.radius,
    '--mood-qr-pad': qr.light,
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
    card: 'linear-gradient(135deg, rgba(29, 185, 84, 0.06) 0%, rgba(0, 0, 0, 0.3) 100%)',
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
