/**
 * Notification Initializer
 * 
 * Registers global notification handlers for use throughout the app
 */

'use client';

import { useEffect } from 'react';
import { useNotificationHelpers } from '@/contexts/NotificationContext';
import { setGlobalNotificationHandler } from '@/lib/notifications';

export default function NotificationInitializer() {
  const { notifyError, notifyWarning, notifyInfo, notifyDebug, notifySuccess } = useNotificationHelpers();

  useEffect(() => {
    // Register the notification functions globally
    setGlobalNotificationHandler({
      error: notifyError,
      warning: notifyWarning,
      info: notifyInfo,
      debug: notifyDebug,
      success: notifySuccess,
    });

    // Cleanup on unmount
    return () => {
      setGlobalNotificationHandler(null);
    };
  }, [notifyError, notifyWarning, notifyInfo, notifyDebug, notifySuccess]);

  return null; // This component doesn't render anything
}

