'use client';

import { Loader2 } from 'lucide-react';

interface ManualRequestFormProps {
  title: string;
  artists: string;
  dedication: string;
  nickname: string;
  nicknameError: string;
  isNicknameValid: boolean;
  isSubmitting: boolean;
  onTitleChange: (value: string) => void;
  onArtistsChange: (value: string) => void;
  onDedicationChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * Guest text request form for manual / request-only mode (PRD-07).
 * No Spotify search or branding.
 */
export default function ManualRequestForm({
  title,
  artists,
  dedication,
  nickname,
  nicknameError,
  isNicknameValid,
  isSubmitting,
  onTitleChange,
  onArtistsChange,
  onDedicationChange,
  onNicknameChange,
  onSubmit,
}: ManualRequestFormProps) {
  const canSubmit =
    title.trim().length > 0 &&
    artists.trim().length > 0 &&
    nickname.trim().length > 0 &&
    isNicknameValid &&
    !isSubmitting;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-bone/80">
        Request mode — enter the song details. The organiser manages the queue;
        this page does not stream or control music.
      </div>

      <div>
        <label className="mb-1 block text-sm text-bone/70">Your name</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          maxLength={40}
          className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-bone"
          placeholder="Nickname"
        />
        {nicknameError ? (
          <p className="mt-1 text-xs text-red-300">{nicknameError}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm text-bone/70">Artist</label>
        <input
          type="text"
          value={artists}
          onChange={(e) => onArtistsChange(e.target.value)}
          maxLength={120}
          className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-bone"
          placeholder="Artist name"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-bone/70">Song title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={120}
          className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-bone"
          placeholder="Song title"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-bone/70">
          Dedication / reason (optional)
        </label>
        <textarea
          value={dedication}
          onChange={(e) => onDedicationChange(e.target.value)}
          maxLength={200}
          rows={2}
          className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-bone"
          placeholder="Optional message for the organiser"
        />
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="flex w-full items-center justify-center rounded-lg bg-accent px-4 py-3 font-semibold text-ink disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          'Submit request'
        )}
      </button>
    </div>
  );
}
