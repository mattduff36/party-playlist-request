/**
 * Request Management Control Panel
 *
 * Compact Auto-approve / No Explicit toggles for the Song Requests toolbar.
 */

'use client';

import { useState } from 'react';
import { CheckCircle, ShieldOff, AlertCircle, X } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';

interface RequestManagementControlPanelProps {
  className?: string;
  /** card = standalone panel; inline = compact toolbar controls */
  variant?: 'card' | 'inline';
}

interface RequestToggleOption {
  key: 'auto_approve' | 'decline_explicit';
  label: string;
  title: string;
  icon: typeof CheckCircle;
  enabled: boolean;
}

export default function RequestManagementControlPanel({
  className = '',
  variant = 'inline',
}: RequestManagementControlPanelProps) {
  const { eventSettings, loading, updateEventSettings } = useAdminData();
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isInline = variant === 'inline';

  if (loading && !eventSettings) {
    if (isInline) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <div className="h-9 w-28 animate-pulse rounded-lg bg-surface" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-surface" />
        </div>
      );
    }

    return (
      <div className={`bg-elevated rounded-lg p-3 ${className}`}>
        <div className="mb-2">
          <h2 className="font-display text-lg font-semibold text-bone">Request Management</h2>
        </div>
        <div className="text-center py-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto mb-2"></div>
          <p className="text-muted text-xs">Loading...</p>
        </div>
      </div>
    );
  }

  const handleToggle = async (
    key: 'auto_approve' | 'decline_explicit',
    enabled: boolean
  ) => {
    if (isToggling) return;

    setIsToggling(key);
    setError(null);
    try {
      await updateEventSettings({ [key]: enabled });
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : `Failed to ${enabled ? 'enable' : 'disable'} ${key}`;
      console.error(`Failed to toggle ${key}:`, err);
      setError(errorMessage);
    } finally {
      setIsToggling(null);
    }
  };

  const options: RequestToggleOption[] = [
    {
      key: 'auto_approve',
      label: 'Auto-approve',
      title: 'Auto-approve all requests',
      icon: CheckCircle,
      enabled: Boolean(eventSettings?.auto_approve),
    },
    {
      key: 'decline_explicit',
      label: 'No Explicit',
      title: 'Auto-decline explicit songs',
      icon: ShieldOff,
      enabled: Boolean(eventSettings?.decline_explicit),
    },
  ];

  const toggleButtons = (
    <div className={isInline ? 'flex flex-wrap items-center gap-2' : 'grid grid-cols-2 gap-2'}>
      {options.map((option) => {
        const Icon = option.icon;
        const isEnabled = option.enabled;
        const isTogglingThis = isToggling === option.key;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => handleToggle(option.key, !isEnabled)}
            disabled={isTogglingThis}
            className={`
              flex items-center gap-1.5 rounded-lg border-2 transition-all duration-200
              ${isInline ? 'px-3 py-2' : 'flex-col space-y-1 p-2'}
              ${
                isEnabled
                  ? 'bg-accent border-accent text-ink font-semibold'
                  : 'bg-elevated border-white/10 text-muted hover:border-accent/40'
              }
              ${isTogglingThis ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
            `}
            title={`Click to ${isEnabled ? 'disable' : 'enable'}: ${option.title}`}
          >
            <Icon className={`w-4 h-4 ${isEnabled ? 'text-ink' : 'text-muted'}`} />
            <span className={`font-medium text-xs ${isEnabled ? 'text-ink' : 'text-muted'}`}>
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  const errorBanner = error ? (
    <div
      className={`${isInline ? 'mt-2 w-full' : 'mt-2'} p-1.5 bg-red-900/20 border border-red-600 rounded text-xs`}
    >
      <div className="flex items-center space-x-2">
        <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
        <span className="text-red-300 flex-1">{error}</span>
        <button
          type="button"
          onClick={() => setError(null)}
          className="text-red-400 hover:text-red-300"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  ) : null;

  if (isInline) {
    return (
      <div className={`flex flex-col ${className}`}>
        {toggleButtons}
        {errorBanner}
      </div>
    );
  }

  return (
    <div className={`bg-elevated rounded-lg p-3 ${className}`}>
      <div className="mb-2">
        <h2 className="font-display text-lg font-semibold text-bone">Request Management</h2>
      </div>
      {toggleButtons}
      {errorBanner}
    </div>
  );
}
