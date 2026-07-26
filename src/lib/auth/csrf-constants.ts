/**
 * CSRF header/cookie names shared by browser and server.
 * Kept free of next/server so client bundles and jsdom tests stay clean.
 */

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
