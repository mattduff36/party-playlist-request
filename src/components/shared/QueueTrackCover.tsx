'use client';

import { Music } from 'lucide-react';

interface QueueTrackCoverProps {
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  iconClassName?: string;
}

const sizeClasses: Record<NonNullable<QueueTrackCoverProps['size']>, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

/**
 * Shared album-cover thumb for admin Queue and display Up Next rows.
 * Uses Spotify CDN URLs already on the track; falls back to a music icon.
 */
export default function QueueTrackCover({
  imageUrl,
  size = 'md',
  className = '',
  iconClassName = 'w-4 h-4 text-muted',
}: QueueTrackCoverProps) {
  return (
    <div
      className={`${sizeClasses[size]} rounded flex-shrink-0 overflow-hidden flex items-center justify-center ${className}`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <Music className={iconClassName} aria-hidden="true" />
      )}
    </div>
  );
}
