export const SPOTIFY_SEARCH_BUSY_CODE = 'SEARCH_BUSY';

export const SPOTIFY_SEARCH_BUSY_MESSAGE =
  "The party's in full swing — lots of people are picking tunes! Have a quick dance, then try your search again in a moment.";

export interface SpotifySearchErrorResponse {
  code?: string;
  error?: string;
}

export function isSpotifySearchBusyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return /\b429\b/.test(error.message);
}
