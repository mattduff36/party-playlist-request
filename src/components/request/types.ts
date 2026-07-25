export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  duration_ms: number;
  explicit: boolean;
  preview_url?: string;
  image?: string;
}

export interface SearchResult {
  tracks: Track[];
  query: string;
  total: number;
}

export interface SearchFeedback {
  message: string;
}

export interface RequestResponse {
  success: boolean;
  message: string;
  request?: {
    id: string;
    track: {
      name: string;
      artists: string[];
      album: string;
    };
  };
}

export interface RequestNotification {
  id: string;
  type: 'approved' | 'play_next';
  trackName: string;
  artistName: string;
  timestamp: number;
}
