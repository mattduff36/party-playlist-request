/**
 * Neutral adult/private-event templates (PRD-08).
 * Templates initialise settings; they do not lock them.
 * No child-targeted templates while platform policy is unresolved.
 */

export interface EventTemplate {
  id: string;
  label: string;
  description: string;
  /** Wedding reception included only with careful, non-promotional wording */
  settings: {
    event_title: string;
    welcome_message: string;
    secondary_message: string;
    venue_info?: string;
    auto_approve: boolean;
    decline_explicit: boolean;
    request_limit: number | null;
    display_mood: string | null;
  };
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'blank',
    label: 'Blank / custom',
    description: 'Start from defaults and customise everything.',
    settings: {
      event_title: 'Party Playlist',
      welcome_message: 'Welcome — request a track for the night.',
      secondary_message: 'Keep it friendly and danceable.',
      auto_approve: false,
      decline_explicit: true,
      request_limit: 10,
      display_mood: 'dj',
    },
  },
  {
    id: 'birthday',
    label: 'Birthday party',
    description: 'Private adult birthday celebration defaults.',
    settings: {
      event_title: 'Birthday Party',
      welcome_message: 'Happy birthday — request a song!',
      secondary_message: 'Help build the celebration playlist.',
      auto_approve: false,
      decline_explicit: true,
      request_limit: 8,
      display_mood: 'party',
    },
  },
  {
    id: 'anniversary',
    label: 'Anniversary',
    description: 'Private anniversary gathering defaults.',
    settings: {
      event_title: 'Anniversary Celebration',
      welcome_message: 'Celebrate with us — request a favourite.',
      secondary_message: 'Romantic, classic, or dancefloor — your pick.',
      auto_approve: false,
      decline_explicit: true,
      request_limit: 8,
      display_mood: 'elegant',
    },
  },
  {
    id: 'house_party',
    label: 'House party',
    description: 'Casual private house party defaults.',
    settings: {
      event_title: 'House Party',
      welcome_message: 'Scan and request — keep the dancefloor moving.',
      secondary_message: 'One request at a time keeps things fair.',
      auto_approve: false,
      decline_explicit: true,
      request_limit: 5,
      display_mood: 'party',
    },
  },
  {
    id: 'wedding_reception',
    label: 'Wedding reception',
    description:
      'Private reception defaults. Organisers remain responsible for venue licensing and account eligibility.',
    settings: {
      event_title: 'Wedding Reception',
      welcome_message: 'Celebrate with us — request a track for the reception.',
      secondary_message: 'Family-friendly requests preferred.',
      auto_approve: false,
      decline_explicit: true,
      request_limit: 6,
      display_mood: 'elegant',
    },
  },
];

export function getEventTemplate(id: string): EventTemplate | null {
  return EVENT_TEMPLATES.find((t) => t.id === id) ?? null;
}
