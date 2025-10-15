'use client';

import { useState } from 'react';
import { AlertTriangle, Smartphone, RefreshCw, X } from 'lucide-react';

interface SessionTransferModalProps {
  isOpen: boolean;
  onTransfer: () => Promise<void>;
  onCancel: () => void;
  sessionInfo?: {
    created_at: string;
    device_info?: string;
  };
}

export default function SessionTransferModal({ 
  isOpen, 
  onTransfer, 
  onCancel,
  sessionInfo 
}: SessionTransferModalProps) {
  const [isTransferring, setIsTransferring] = useState(false);

  if (!isOpen) return null;

  const handleTransfer = async () => {
    setIsTransferring(true);
    try {
      await onTransfer();
    } catch (error) {
      console.error('Transfer failed:', error);
      setIsTransferring(false);
    }
  };

  const formatSessionAge = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - created.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl border border-amber-600 relative">
        <button
          onClick={onCancel}
          disabled={isTransferring}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          title="Cancel"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-900/30 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-2xl font-bold text-amber-400 mb-2">
            Active Session Detected
          </h3>
          <p className="text-gray-300 text-sm mb-4">
            You're already logged in on another device
          </p>

          {sessionInfo && (
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center space-x-2 text-gray-300 mb-2">
                <Smartphone className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-medium">Current Session</span>
              </div>
              <p className="text-xs text-gray-400">
                Started {formatSessionAge(sessionInfo.created_at)}
              </p>
              {sessionInfo.device_info && (
                <p className="text-xs text-gray-500 mt-1">
                  {sessionInfo.device_info}
                </p>
              )}
            </div>
          )}

          <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-4 mb-4">
            <p className="text-amber-300 text-sm font-medium mb-2">
              Do you want to transfer the event to this device?
            </p>
            <p className="text-gray-400 text-xs">
              Your other session will be automatically logged out, and your event will continue here.
            </p>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={handleTransfer}
            disabled={isTransferring}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isTransferring ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <Smartphone className="w-5 h-5 mr-2" />
                Yes, Transfer to This Device
              </>
            )}
          </button>

          <button
            onClick={onCancel}
            disabled={isTransferring}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            No, Stay on Other Device
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Only one admin session can be active at a time
        </p>
      </div>
    </div>
  );
}


