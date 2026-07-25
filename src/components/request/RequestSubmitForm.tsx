'use client';

import { Music2, Lock, Loader2, AlertCircle } from 'lucide-react';

interface PinEntryFormProps {
  username: string;
  pin: string;
  pinError: string;
  verifying: boolean;
  onPinChange: (pin: string) => void;
  onClearPinError: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function PinEntryForm({
  username,
  pin,
  pinError,
  verifying,
  onPinChange,
  onClearPinError,
  onSubmit,
}: PinEntryFormProps) {
  return (
    <div className="mood-surface w-full max-w-md shadow-2xl p-8">
      <div className="flex flex-col items-center mb-8">
        <Music2 className="h-16 w-16 mood-accent-text mb-4" />
        <h1 className="font-display text-3xl font-bold text-center">
          {username}&apos;s Party Playlist
        </h1>
        <p className="text-[color:var(--mood-muted)] text-center mt-2">
          Enter the 4-digit PIN to request songs
        </p>
      </div>

      {pinError && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center mb-6">
          <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
          <span>{pinError}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label htmlFor="pin" className="block text-[color:var(--mood-muted)] text-sm font-medium mb-2">
            <Lock className="inline h-4 w-4 mr-2" />
            Event PIN
          </label>
          <input
            type="text"
            id="pin"
            maxLength={4}
            pattern="[0-9]{4}"
            className="w-full px-4 py-3 bg-black/10 border border-[color:var(--mood-border)] rounded-[var(--mood-radius)] focus:ring-2 focus:ring-[color:var(--mood-accent)] focus:border-transparent outline-none text-center text-2xl tracking-widest font-mono"
            style={{ color: 'var(--mood-text)' }}
            placeholder="••••"
            value={pin}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
              onPinChange(value);
              onClearPinError();
            }}
            disabled={verifying}
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="mood-btn w-full py-3 px-4 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={verifying || pin.length !== 4}
        >
          {verifying ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Lock className="mr-2 h-5 w-5" />
              Access Playlist
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[color:var(--mood-muted)] text-sm mt-6">
        PIN displayed on the DJ&apos;s screen
      </p>
    </div>
  );
}

interface RequestSubmitFormProps {
  nickname: string;
  nicknameError: string;
  onNicknameChange: (nickname: string) => void;
  showSuccessModal: boolean;
  requestStatus: 'idle' | 'success' | 'error';
  statusMessage: string;
  onMakeAnotherRequest: () => void;
  onImDone: () => void;
  children?: React.ReactNode;
}

export default function RequestSubmitForm({
  nickname,
  nicknameError,
  onNicknameChange,
  showSuccessModal,
  requestStatus,
  statusMessage,
  onMakeAnotherRequest,
  onImDone,
  children,
}: RequestSubmitFormProps) {
  return (
    <>
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-[color:var(--mood-accent)]/15 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 mood-accent-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-[color:var(--mood-text)] mb-4">Thank you for your request!</h3>
            <p className="text-[color:var(--mood-muted)] mb-8">It has been submitted successfully.</p>
            <div className="flex gap-3">
              <button
                onClick={onMakeAnotherRequest}
                className="flex-1 mood-accent-bg text-white py-3 px-6 rounded-lg font-semibold hover:mood-accent-bg transition-colors"
              >
                Make another Request
              </button>
              <button
                onClick={onImDone}
                className="flex-1 bg-[color:var(--mood-surface)] text-[color:var(--mood-text)] py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition-colors"
              >
                I'm done
              </button>
            </div>
          </div>
        </div>
      )}

      {requestStatus === 'error' && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-red-500 text-white px-8 py-6 rounded-2xl shadow-2xl border-4 border-red-400 max-w-md mx-4 transform animate-pulse">
            <div className="flex items-center justify-center">
              <span className="text-4xl mr-4">❌</span>
              <span className="text-xl font-bold text-center">{statusMessage}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-start justify-center px-3 py-4">
        <div className="max-w-xl w-full flex flex-col h-full space-y-3">
          {/* Name Input */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4">
            <input
              type="text"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder="👤 Your name"
              className={`w-full px-4 py-3 text-base bg-white/20 border rounded-lg text-white placeholder-[color:var(--mood-muted)] focus:outline-none focus:ring-2 focus:border-transparent ${
                nicknameError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-white/30 focus:ring-[color:var(--mood-accent)]'
              }`}
              style={{
                fontSize: '16px',
                transform: 'translateZ(0)', // Prevent iOS zoom
                WebkitAppearance: 'none', // Remove iOS styling
                WebkitTextSizeAdjust: '100%', // Prevent iOS zoom
                textSizeAdjust: '100%', // Prevent iOS zoom
                zoom: '1', // Prevent iOS zoom
              }}
              required
            />
            {nicknameError && (
              <p className="text-red-400 text-sm mt-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {nicknameError}
              </p>
            )}
          </div>

          {children}
        </div>
      </div>
    </>
  );
}
