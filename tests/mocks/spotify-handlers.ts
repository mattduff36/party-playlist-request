/**
 * Mock Service Worker (MSW) Handlers for Spotify API
 * 
 * These handlers intercept Spotify API requests and return mocked responses
 */

import { http, HttpResponse } from 'msw';
import { SPOTIFY_MOCK_RESPONSES } from '../fixtures/spotify-responses';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com/api';

export const spotifyHandlers = [
  // Get current playback
  http.get(`${SPOTIFY_API_BASE}/me/player`, () => {
    return HttpResponse.json(SPOTIFY_MOCK_RESPONSES.playback);
  }),
  
  // Get queue
  http.get(`${SPOTIFY_API_BASE}/me/player/queue`, () => {
    return HttpResponse.json(SPOTIFY_MOCK_RESPONSES.queue);
  }),
  
  // Get available devices
  http.get(`${SPOTIFY_API_BASE}/me/player/devices`, () => {
    return HttpResponse.json(SPOTIFY_MOCK_RESPONSES.devices);
  }),
  
  // Search for tracks
  http.get(`${SPOTIFY_API_BASE}/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    
    // Return filtered results based on query
    return HttpResponse.json(SPOTIFY_MOCK_RESPONSES.search);
  }),
  
  // Pause playback
  http.put(`${SPOTIFY_API_BASE}/me/player/pause`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
  
  // Resume playback
  http.put(`${SPOTIFY_API_BASE}/me/player/play`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
  
  // Add to queue
  http.post(`${SPOTIFY_API_BASE}/me/player/queue`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
  
  // Transfer playback
  http.put(`${SPOTIFY_API_BASE}/me/player`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
  
  // Get token (OAuth)
  http.post(`${SPOTIFY_ACCOUNTS_BASE}/token`, () => {
    return HttpResponse.json(SPOTIFY_MOCK_RESPONSES.token);
  }),
  
  // Get user profile
  http.get(`${SPOTIFY_API_BASE}/me`, () => {
    return HttpResponse.json({
      id: 'test_user_id',
      display_name: 'Test User',
      email: 'test@example.com',
    });
  }),
];


