'use client';

import { ListMusic } from 'lucide-react';

interface PartyPlaylistPickerProps {
  isConnected: boolean;
}

export function PartyPlaylistPicker({ isConnected }: PartyPlaylistPickerProps) {
  if (!isConnected) {
    return null;
  }

  return (
    <div className="bg-elevated rounded-lg p-6 opacity-70">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded bg-surface flex items-center justify-center flex-shrink-0">
          <ListMusic className="w-5 h-5 text-muted" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-bone">Party Playlist</h2>
          <p className="text-muted text-sm mt-1">
            Approved requests will be added to a chosen playlist
          </p>
          <p className="text-faint text-xs mt-2 uppercase tracking-wide">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
