'use client';

import { Music2, Lock, Loader2, AlertCircle } from 'lucide-react';

interface AccessCodeEntryFormProps {
  username: string;
  code: string;
  codeError: string;
  verifying: boolean;
  onCodeChange: (code: string) => void;
  onClearError: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AccessCodeEntryForm({
  username,
  code,
  codeError,
  verifying,
  onCodeChange,
  onClearError,
  onSubmit,
}: AccessCodeEntryFormProps) {
  return (
    <div className="mood-surface w-full max-w-md shadow-2xl p-8">
      <div className="flex flex-col items-center mb-8">
        <Music2 className="h-16 w-16 mood-accent-text mb-4" />
        <h1 className="font-display text-3xl font-bold text-center">
          {username}&apos;s Party Playlist
        </h1>
        <p className="text-[color:var(--mood-muted)] text-center mt-2">
          Enter the event access code to request songs
        </p>
      </div>

      {codeError && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center mb-6">
          <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
          <span>{codeError}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="accessCode"
            className="block text-[color:var(--mood-muted)] text-sm font-medium mb-2"
          >
            <Lock className="inline h-4 w-4 mr-2" />
            Access code
          </label>
          <input
            type="text"
            id="accessCode"
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full px-4 py-3 bg-black/10 border border-[color:var(--mood-border)] rounded-[var(--mood-radius)] focus:ring-2 focus:ring-[color:var(--mood-accent)] focus:border-transparent outline-none text-center text-2xl tracking-widest font-mono uppercase"
            style={{ color: 'var(--mood-text)' }}
            placeholder="••••••"
            value={code}
            onChange={(e) => {
              const value = e.target.value
                .replace(/[^0-9a-zA-Z]/g, '')
                .slice(0, 8)
                .toUpperCase();
              onCodeChange(value);
              onClearError();
            }}
            disabled={verifying}
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="mood-btn w-full py-3 px-4 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={verifying || (code.length !== 6 && code.length !== 8 && code.length !== 4)}
        >
          {verifying ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-5 w-5" />
              Continue
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[color:var(--mood-muted)] text-sm mt-6">
        Code is shown on the DJ&apos;s screen and in the guest link
      </p>
    </div>
  );
}
