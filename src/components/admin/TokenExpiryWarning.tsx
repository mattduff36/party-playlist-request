'use client';

import { useState, useEffect } from 'react';
import { Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TokenExpiryWarningProps {
  expiryTime: number; // Unix timestamp in milliseconds
  onExtendSession: () => Promise<void>;
}

export default function TokenExpiryWarning({ expiryTime, onExtendSession }: TokenExpiryWarningProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = expiryTime - now;

      if (remaining <= 0) {
        setTimeRemaining('Session expired');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes}m ${seconds}s`);

      // Show modal 15 minutes before expiry
      if (remaining <= 15 * 60 * 1000 && remaining > 0 && !isOpen) {
        setIsOpen(true);
      }

      // Auto-close modal if session extended past warning threshold
      if (remaining > 15 * 60 * 1000 && isOpen) {
        setIsOpen(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiryTime, isOpen]);

  const handleExtend = async () => {
    setIsExtending(true);
    try {
      await onExtendSession();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to extend session:', error);
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = () => {
    setIsOpen(false);
    router.push('/login');
  };

  if (!isOpen) return null;

  const remaining = expiryTime - Date.now();
  const isCritical = remaining <= 5 * 60 * 1000; // Less than 5 minutes

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className={`bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl border ${
        isCritical ? 'border-red-600' : 'border-amber-600'
      } relative animate-pulse-slow`}>
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
            isCritical ? 'bg-red-900/30' : 'bg-amber-900/30'
          }`}>
            {isCritical ? (
              <AlertTriangle className="w-8 h-8 text-red-500" />
            ) : (
              <Clock className="w-8 h-8 text-amber-500" />
            )}
          </div>
          <h3 className={`text-2xl font-bold mb-2 ${
            isCritical ? 'text-red-400' : 'text-amber-400'
          }`}>
            {isCritical ? 'Session Expiring Soon!' : 'Session Warning'}
          </h3>
          <p className="text-gray-300 text-sm mb-4">
            Your admin session will expire in:
          </p>
          <div className={`text-4xl font-mono font-bold mb-4 ${
            isCritical ? 'text-red-400' : 'text-amber-400'
          }`}>
            {timeRemaining}
          </div>
          <p className="text-gray-400 text-sm">
            {isCritical 
              ? 'Extend your session now to avoid being logged out!'
              : 'Would you like to extend your session?'}
          </p>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={handleExtend}
            disabled={isExtending}
            className={`w-full font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
              isCritical 
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isExtending ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Extending Session...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                Extend Session
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Logout Now
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Your event will remain active if you extend your session.
        </p>
      </div>
    </div>
  );
}

