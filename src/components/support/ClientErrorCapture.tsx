'use client';

import { useEffect } from 'react';

const recent = new Set<string>();

function dedupeKey(message: string): string {
  return `${message}`.slice(0, 200);
}

/**
 * Captures unhandled window errors / promise rejections once per message.
 */
export default function ClientErrorCapture() {
  useEffect(() => {
    const report = (message: string, stack?: string) => {
      const key = dedupeKey(message);
      if (recent.has(key)) return;
      recent.add(key);
      setTimeout(() => recent.delete(key), 60_000);

      void fetch('/api/support/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId: `win_${Date.now()}`,
          message,
          stack: stack || null,
          url: window.location.href,
          userAgent: navigator.userAgent,
          level: 'error',
        }),
      }).catch(() => undefined);
    };

    const onError = (event: ErrorEvent) => {
      report(event.message || 'Window error', event.error?.stack);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection';
      const stack = reason instanceof Error ? reason.stack : undefined;
      report(message, stack);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
